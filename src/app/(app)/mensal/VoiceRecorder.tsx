"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { parseVoiceEntry, type ParsedVoiceEntry } from "@/lib/entries/voice-expense-parser";

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternative> {
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getAudioContextConstructor(): typeof AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function joinFinalTranscript(results: ArrayLike<SpeechRecognitionResultLike>): string {
  let transcript = "";
  for (let i = 0; i < results.length; i++) {
    transcript += results[i][0].transcript;
  }
  return transcript;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const BAR_COUNT = 28;

/** Mensagem amigável por código de erro do SpeechRecognition, item 8/revisão pré-lançamento:
 * antes, qualquer erro (permissão negada, sem fala, rede) parava a gravação em silêncio e a
 * pessoa achava que o app tinha travado. */
function errorMessageFor(code: string): string {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
    case "service-not-allowed":
      return "Permita o acesso ao microfone nas configurações do navegador e tente de novo.";
    case "no-speech":
      return "Não conseguimos te ouvir. Aproxime o microfone e tente de novo.";
    case "network":
      return "Falha de conexão durante a gravação. Tente de novo.";
    case "audio-capture":
      return "Nenhum microfone encontrado neste dispositivo.";
    default:
      return "Não foi possível gravar agora. Tente de novo.";
  }
}

/** Loop de animação fora do componente, funções aninhadas no corpo do componente que chamam
 * APIs impuras (Date.now) são sinalizadas pelo lint de pureza do React Compiler mesmo quando
 * só rodam via requestAnimationFrame, nunca durante o render. */
function runVisualizerLoop(
  analyser: AnalyserNode,
  levels: number[],
  barEls: (HTMLDivElement | null)[],
  timerEl: HTMLSpanElement | null,
  startedAt: number,
  rafHolder: { id: number | null },
) {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    const centered = (data[i] - 128) / 128;
    sumSquares += centered * centered;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  const level = Math.min(1, rms * 5);

  levels.shift();
  levels.push(Math.max(0.08, level));
  levels.forEach((value, i) => {
    barEls[i]?.style.setProperty("height", `${Math.round(value * 100)}%`);
  });

  if (timerEl) {
    timerEl.textContent = formatElapsed(Date.now() - startedAt);
  }

  rafHolder.id = requestAnimationFrame(() => runVisualizerLoop(analyser, levels, barEls, timerEl, startedAt, rafHolder));
}

/**
 * "Segurar para falar" (mesma linguagem do WhatsApp), agora INLINE dentro do fluxo de registro —
 * não é mais um botão solto na tela. Grava enquanto o dedo fica pressionado, mostra uma onda
 * reagindo ao volume em tempo real, e ao soltar transcreve e devolve o lançamento por `onParsed`.
 *
 * Duas APIs em paralelo: SpeechRecognition faz a transcrição; getUserMedia + AnalyserNode só
 * alimenta a onda visual, se a segunda falhar, a transcrição continua, só sem a onda.
 */
export function VoiceRecorder({ onParsed }: { onParsed: (parsed: ParsedVoiceEntry) => void }) {
  const [recording, setRecording] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const latestResultsRef = useRef<ArrayLike<SpeechRecognitionResultLike> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafHolderRef = useRef<{ id: number | null }>({ id: null });
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerElRef = useRef<HTMLSpanElement | null>(null);
  const isHeldRef = useRef(false);

  function stopVisualizer() {
    if (rafHolderRef.current.id !== null) {
      cancelAnimationFrame(rafHolderRef.current.id);
      rafHolderRef.current.id = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    barRefs.current.forEach((bar) => bar?.style.setProperty("height", "8%"));
  }

  async function startVisualizer() {
    try {
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const levels = new Array(BAR_COUNT).fill(0.08);
      const startedAt = Date.now();
      rafHolderRef.current.id = requestAnimationFrame(() =>
        runVisualizerLoop(analyser, levels, barRefs.current, timerElRef.current, startedAt, rafHolderRef.current),
      );
    } catch {
      // Sem acesso ao stream bruto, a transcrição continua via SpeechRecognition, só sem a onda.
    }
  }

  function startRecording() {
    if (isHeldRef.current) return;
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setUnsupported(true);
      return;
    }
    isHeldRef.current = true;
    setRecording(true);
    setErrorMessage(null);
    latestResultsRef.current = null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      latestResultsRef.current = event.results;
    };
    recognition.onerror = (event) => {
      isHeldRef.current = false;
      setRecording(false);
      setErrorMessage(errorMessageFor(event.error));
      stopVisualizer();
    };
    // Captura o onParsed do momento em que a gravação começou, o closure vive só até soltar
    // o botão, então não há risco real de callback obsoleto.
    recognition.onend = () => {
      const results = latestResultsRef.current;
      const transcript = results ? joinFinalTranscript(results) : "";
      if (transcript.trim()) {
        onParsed(parseVoiceEntry(transcript));
      } else {
        // "onerror" já tratou os casos de falha explícita, aqui é o caso de terminar sem
        // erro mas sem nenhuma fala reconhecida (silêncio, murmúrio), que antes não avisava nada.
        setErrorMessage((prev) => prev ?? "Não entendemos o que foi dito. Tente falar de novo.");
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    startVisualizer();
  }

  function stopRecording() {
    if (!isHeldRef.current) return;
    isHeldRef.current = false;
    setRecording(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopVisualizer();
  }

  useEffect(() => stopVisualizer, []);

  if (unsupported) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-sm text-ink-muted">
        Seu navegador não suporta reconhecimento de voz. Use a opção de digitar.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* Onda de volume, sempre presente pra reservar o espaço; anima só durante a gravação. */}
      <div className="flex h-14 items-center gap-[3px]">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className={`w-[3px] shrink-0 rounded-full transition-colors ${recording ? "bg-accent" : "bg-border-strong"}`}
            style={{ height: "8%" }}
          />
        ))}
      </div>

      <button
        type="button"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          startRecording();
        }}
        onPointerUp={stopRecording}
        onPointerCancel={stopRecording}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Segure para falar o lançamento"
        style={{ touchAction: "none" }}
        className={`flex h-20 w-20 select-none items-center justify-center rounded-full border shadow-premium transition-transform ${
          recording
            ? "scale-110 border-danger bg-danger text-canvas"
            : "border-border-strong bg-surface text-ink hover:scale-105 active:scale-95"
        }`}
      >
        <Mic size={28} strokeWidth={2} />
      </button>

      <div className="flex flex-col items-center gap-1">
        <span ref={timerElRef} className="text-sm font-medium tabular-nums text-ink-muted">
          0:00
        </span>
        <span className={`text-xs ${errorMessage ? "text-danger" : "text-ink-faint"}`}>
          {errorMessage ?? (recording ? "Solte para transcrever" : "Segure para falar")}
        </span>
      </div>
    </div>
  );
}
