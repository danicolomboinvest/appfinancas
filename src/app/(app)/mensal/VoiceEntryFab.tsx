"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mic } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { EntryForm } from "./[year]/[month]/EntryForm";
import { getRecentSubcategoriesAction, getCustomCategoriesAction } from "./actions";
import { currentYearMonthFromPath } from "./QuickExpenseFab";
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

const BAR_COUNT = 24;

/** Loop de animação fora do componente — funções aninhadas no corpo do componente que chamam
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
 * Botão "segurar para falar" (mesma linguagem do WhatsApp) — grava enquanto o dedo/mouse
 * fica pressionado e mostra uma onda animada reagindo ao volume da voz em tempo real, para
 * a pessoa ver que está gravando de verdade, não só um ícone piscando. Solta = envia.
 *
 * Duas APIs em paralelo: SpeechRecognition faz a transcrição (mesmo parser de sempre);
 * getUserMedia + AnalyserNode só alimenta a barrinha visual — se a segunda falhar (raro),
 * a gravação/transcrição continua normalmente, só sem a onda.
 */
export function VoiceEntryFab() {
  const pathname = usePathname();
  const [recording, setRecording] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [parsed, setParsed] = useState<ParsedVoiceEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recentSubcategories, setRecentSubcategories] = useState<Partial<Record<ParentCategory, string[]>>>({});
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const { year, month } = currentYearMonthFromPath(pathname);

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
      // Sem acesso ao stream bruto (ex.: permissão negada só para isso) — a transcrição
      // continua funcionando via SpeechRecognition, só fica sem a onda animada.
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
    latestResultsRef.current = null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      latestResultsRef.current = event.results;
    };
    recognition.onerror = () => {
      isHeldRef.current = false;
      setRecording(false);
      stopVisualizer();
    };
    recognition.onend = () => {
      const results = latestResultsRef.current;
      if (results) {
        const transcript = joinFinalTranscript(results);
        if (transcript.trim()) {
          const result = parseVoiceEntry(transcript);
          setParsed(result);
          getRecentSubcategoriesAction().then(setRecentSubcategories);
          getCustomCategoriesAction().then(setCustomCategories);
          setModalOpen(true);
        }
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

  return (
    <>
      {recording && (
        <div
          className="fixed bottom-[228px] right-5 z-30 flex items-center gap-2.5 rounded-full border border-border-strong bg-surface/95 py-2.5 pl-3 pr-4 shadow-premium backdrop-blur-xl md:bottom-32"
          role="status"
          aria-live="polite"
        >
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-danger" />
          <div className="flex h-6 items-center gap-[3px]">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                className="w-[3px] shrink-0 rounded-full bg-accent"
                style={{ height: "8%" }}
              />
            ))}
          </div>
          <span ref={timerElRef} className="text-xs font-medium tabular-nums text-ink-muted">
            0:00
          </span>
        </div>
      )}

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
        title={unsupported ? "Reconhecimento de voz não disponível neste navegador" : "Segure para falar"}
        style={{ touchAction: "none" }}
        className={`fixed bottom-[168px] right-5 z-30 flex h-12 w-12 select-none items-center justify-center rounded-full border shadow-premium transition-transform md:bottom-20 ${
          recording
            ? "scale-110 border-danger bg-danger text-canvas"
            : "border-border-strong bg-surface text-ink hover:scale-105 active:scale-95"
        }`}
      >
        <Mic size={18} strokeWidth={2} />
      </button>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confira o lançamento por voz">
        {parsed && (
          <EntryForm
            year={year}
            month={month}
            recentSubcategories={recentSubcategories}
            customCategories={customCategories}
            layout="stacked"
            onSuccess={() => setModalOpen(false)}
            defaultDescription={parsed.description}
            defaultAmount={parsed.amount ?? undefined}
            defaultCategory={parsed.category}
            defaultParentCategory={parsed.parentCategory ?? undefined}
          />
        )}
      </Modal>
    </>
  );
}
