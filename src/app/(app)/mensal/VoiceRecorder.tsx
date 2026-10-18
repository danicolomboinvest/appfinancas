"use client";

import { registrarErroNoCliente } from "@/lib/erros/erro-do-cliente";
import { useEffect, useRef, useState } from "react";
import { useInstallPlatform, useIsStandalone } from "@/lib/pwa/install";
import { Mic } from "lucide-react";
import { parseVoiceEntry, type ParsedVoiceEntry } from "@/lib/entries/voice-expense-parser";
import { entenderFalaAction } from "./actions";
import { ENERGIA_DO_EMPURRAO, alturaDaBarra, energiaDepois, ondaPodeAbrirMicrofone } from "@/lib/entries/onda-do-microfone";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";

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
  /** Começo da fala e do som: empurram a onda sem microfone (nem todo navegador avisa). */
  onspeechstart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
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

/**
 * O que foi dito. Os resultados finais primeiro; sem nenhum final, o último parcial (12/10/2026):
 * no Android, soltar o botão para o reconhecimento antes de ele fechar a frase, e o que chegava era
 * só o parcial. Sem esse plano B, a cliente falava e ouvia "Não entendemos o que foi dito".
 */
export function joinFinalTranscript(results: ArrayLike<SpeechRecognitionResultLike>): string {
  let finais = "";
  let parcial = "";
  for (let i = 0; i < results.length; i++) {
    const texto = results[i]?.[0]?.transcript ?? "";
    if (results[i]?.isFinal === false) parcial = texto;
    else finais += (finais && texto && !finais.endsWith(" ") && !texto.startsWith(" ") ? " " : "") + texto;
  }
  return (finais.trim() ? finais : parcial).trim();
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
 * pessoa achava que o app tinha travado. As frases vêm da voz do tema: é texto que a pessoa
 * lê num momento de frustração, e cada tema pode acalmar do seu jeito. */
function errorMessageFor(code: string, t: Titulos): string {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
    case "service-not-allowed":
      return t.impVozErroPermissao;
    case "no-speech":
      return t.impVozErroSemFala;
    case "network":
      return t.impVozErroRede;
    case "audio-capture":
      return t.impVozErroSemMicrofone;
    default:
      // O código vai junto: sem ele, "não foi possível gravar" não diz o que aconteceu, e quem
      // manda o print pro suporte já manda a causa.
      return code ? `${t.impVozErroGenerico} (${code})` : t.impVozErroGenerico;
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
 * A onda quando não dá para abrir o microfone (iPhone, ou antes do analisador ficar pronto): reage
 * à energia que o reconhecimento de fala vai empurrando (lib/entries/onda-do-microfone.ts) e
 * também conta o tempo, que antes ficava parado em 0:00 no iPhone.
 */
function runOndaDaFala(
  voz: { energia: number; em: number },
  barEls: (HTMLDivElement | null)[],
  timerEl: HTMLSpanElement | null,
  startedAt: number,
  rafHolder: { id: number | null },
) {
  const agora = Date.now();
  const energia = energiaDepois(voz.energia, agora - voz.em);
  barEls.forEach((bar, i) => bar?.style.setProperty("height", `${Math.round(alturaDaBarra(i, agora, energia) * 100)}%`));
  if (timerEl) timerEl.textContent = formatElapsed(agora - startedAt);
  rafHolder.id = requestAnimationFrame(() => runOndaDaFala(voz, barEls, timerEl, startedAt, rafHolder));
}

/**
 * A frase entendida no servidor, com as regras e as categorias DELA (o mesmo motor da importação).
 * Sem internet, ou se o servidor demorar, o aparelho entende sozinho (dicionário e palavras
 * faladas, sem as regras dela): o lançamento nunca fica parado esperando.
 */
async function entender(transcricao: string): Promise<ParsedVoiceEntry> {
  const local = () => parseVoiceEntry(transcricao);
  try {
    const espera = new Promise<null>((r) => setTimeout(() => r(null), 3000));
    return (await Promise.race([entenderFalaAction(transcricao), espera])) ?? local();
  } catch (err) {
    registrarErroNoCliente("voz", err);
    return local();
  }
}

/**
 * "Segurar para falar" (mesma linguagem do WhatsApp), agora INLINE dentro do fluxo de registro —
 * não é mais um botão solto na tela. Grava enquanto o dedo fica pressionado, mostra uma onda
 * reagindo ao volume em tempo real, e ao soltar transcreve e devolve o lançamento por `onParsed`.
 *
 * Duas APIs em paralelo: SpeechRecognition faz a transcrição; getUserMedia + AnalyserNode só
 * alimenta a onda visual, se a segunda falhar, a transcrição continua, só sem a onda.
 */
export function VoiceRecorder({ onParsed, onDigitar }: { onParsed: (parsed: ParsedVoiceEntry) => void; /** Saída quando o microfone não dá: abre o Digitar. */ onDigitar?: () => void }) {
  const plataforma = useInstallPlatform();
  const instalado = useIsStandalone();
  const { voz } = useProfileTheme();
  const [recording, setRecording] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Instrução, não erro: tocou e soltou sem segurar. Sai em cinza, não em vermelho. */
  const [dica, setDica] = useState<string | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const latestResultsRef = useRef<ArrayLike<SpeechRecognitionResultLike> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafHolderRef = useRef<{ id: number | null }>({ id: null });
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerElRef = useRef<HTMLSpanElement | null>(null);
  const isHeldRef = useRef(false);
  const apertouEmRef = useRef(0);
  const toqueRapidoRef = useRef(false);
  /** A energia da onda sem microfone e quando ela levou o último empurrão. */
  const vozRef = useRef({ energia: 0, em: 0 });
  const gravouEmRef = useRef(0);

  function empurrarOnda() {
    // Muda no lugar: o loop da onda segura este mesmo objeto.
    vozRef.current.energia = ENERGIA_DO_EMPURRAO;
    vozRef.current.em = Date.now();
  }

  function cancelarLoop() {
    if (rafHolderRef.current.id !== null) {
      cancelAnimationFrame(rafHolderRef.current.id);
      rafHolderRef.current.id = null;
    }
  }

  function stopVisualizer() {
    cancelarLoop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    barRefs.current.forEach((bar) => bar?.style.setProperty("height", "8%"));
  }

  /** A onda que reage à fala (e o relógio). Na segunda tentativa o relógio continua de onde estava. */
  function ligarOndaDaFala() {
    vozRef.current.energia = 0;
    vozRef.current.em = Date.now();
    cancelarLoop();
    rafHolderRef.current.id = requestAnimationFrame(() =>
      runOndaDaFala(vozRef.current, barRefs.current, timerElRef.current, gravouEmRef.current, rafHolderRef.current),
    );
  }

  async function startVisualizer() {
    // Já começa reagindo à fala; se o analisador ficar pronto, ele assume com o volume de verdade.
    gravouEmRef.current = Date.now();
    ligarOndaDaFala();
    try {
      if (!ondaPodeAbrirMicrofone(navigator.userAgent)) return;
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) return;
      // A onda é decorativa; o getUserMedia dela dispara um SEGUNDO pedido de permissão de
      // microfone além do que o SpeechRecognition já faz (no iPhone viravam dois avisos toda
      // visita). Só liga a onda se a permissão JÁ está concedida; senão, grava sem onda com
      // um pedido só. Navegador sem Permissions API (ou sem "microphone"): mesma decisão
      // conservadora, sem onda, sem pedido extra.
      const permissions = navigator.permissions;
      if (!permissions?.query) return;
      const status = await permissions.query({ name: "microphone" as PermissionName });
      if (status.state !== "granted") return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      // Soltou o botão enquanto o analisador abria: não religa nada.
      if (!isHeldRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close().catch(() => {});
        return;
      }
      const levels = new Array(BAR_COUNT).fill(0.08);
      cancelarLoop();
      rafHolderRef.current.id = requestAnimationFrame(() =>
        runVisualizerLoop(analyser, levels, barRefs.current, timerElRef.current, gravouEmRef.current, rafHolderRef.current),
      );
    } catch {
      // Sem acesso ao stream bruto, a transcrição continua via SpeechRecognition, só sem a onda.
    }
  }

  function startRecording(tentativa = 1) {
    if (isHeldRef.current && tentativa === 1) return;
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      registrarErroNoCliente("voz", "sem SpeechRecognition neste aparelho");
      setUnsupported(true);
      return;
    }
    isHeldRef.current = true;
    setRecording(true);
    setErrorMessage(null);
    setDica(null);
    if (tentativa === 1) {
      apertouEmRef.current = Date.now();
      toqueRapidoRef.current = false;
    }
    latestResultsRef.current = null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    // Parciais ligados: no Android o final pode não chegar quando ela solta o botão (ver joinFinalTranscript).
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      latestResultsRef.current = event.results;
      empurrarOnda();
    };
    recognition.onspeechstart = empurrarOnda;
    recognition.onsoundstart = empurrarOnda;
    recognition.onerror = (event) => {
      // Toque rápido: o reconhecimento parou antes de ouvir qualquer coisa, e o erro que vem
      // ("no-speech", "aborted") é consequência do jeito de usar, não falha. A dica já está na tela.
      if (toqueRapidoRef.current) {
        stopVisualizer();
        return;
      }
      // "aborted" com o dedo ainda no botão é o reconhecimento cortado por outro uso do
      // microfone, não uma falha da pessoa: tenta de novo uma vez, sem a onda. Com o dedo já
      // solto, foi o próprio app que parou, e o "onend" cuida do que foi dito.
      if (event.error === "aborted") {
        if (isHeldRef.current && tentativa === 1) {
          recognition.onend = null;
          stopVisualizer();
          startRecording(2);
          return;
        }
        if (!isHeldRef.current) return;
      }
      isHeldRef.current = false;
      setRecording(false);
      if (event.error !== "no-speech") registrarErroNoCliente("voz", `SpeechRecognition: ${event.error}`);
      setErrorMessage(errorMessageFor(event.error, voz.titulos));
      stopVisualizer();
    };
    // Captura o onParsed do momento em que a gravação começou, o closure vive só até soltar
    // o botão, então não há risco real de callback obsoleto.
    recognition.onend = () => {
      const results = latestResultsRef.current;
      const transcript = results ? joinFinalTranscript(results) : "";
      if (transcript.trim()) {
        setDica(null);
        entender(transcript).then(onParsed);
      } else if (toqueRapidoRef.current) {
        // A dica de segurar o botão já apareceu ao soltar.
      } else {
        // "onerror" já tratou os casos de falha explícita, aqui é o caso de terminar sem
        // erro mas sem nenhuma fala reconhecida (silêncio, murmúrio), que antes não avisava nada.
        setErrorMessage((prev) => prev ?? voz.titulos.impVozNaoEntendi);
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      registrarErroNoCliente("voz", err);
      // start() lança se o navegador ainda não soltou o reconhecimento anterior (toque duplo
      // rápido). Antes isso subia como erro da tela; agora vira o aviso de sempre.
      isHeldRef.current = false;
      setRecording(false);
      setErrorMessage(voz.titulos.impVozErroGenerico);
      return;
    }
    if (tentativa === 1) startVisualizer();
    else ligarOndaDaFala();
  }

  function stopRecording() {
    if (!isHeldRef.current) return;
    isHeldRef.current = false;
    // Menos de 0,7 s com o dedo no botão é toque, não fala: quem toca e solta esperando que o app
    // grave sozinho via "não foi possível gravar" e achava que estava quebrado.
    if (Date.now() - apertouEmRef.current < 700) {
      toqueRapidoRef.current = true;
      setDica(voz.titulos.impVozToqueRapido);
    }
    setRecording(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopVisualizer();
  }

  useEffect(() => stopVisualizer, []);

  if (unsupported) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-sm text-ink-muted">{voz.titulos.impVozNaoSuportado}</p>
        {onDigitar && <BotaoDigitar onClick={onDigitar} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* Onda de volume, sempre presente pra reservar o espaço; anima só durante a gravação. */}
      <div data-onda className="flex h-14 items-center gap-[3px]">
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
          startRecording(1);
        }}
        onPointerUp={stopRecording}
        onPointerCancel={stopRecording}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Segure para falar o lançamento"
        style={{ touchAction: "none" }}
        className={`flex h-24 w-24 select-none items-center justify-center rounded-full shadow-premium transition-transform ${
          recording ? "scale-110 bg-danger text-canvas" : "bg-ink text-canvas hover:scale-105 active:scale-95"
        }`}
      >
        <Mic size={32} strokeWidth={1.8} />
      </button>

      <div className="flex flex-col items-center gap-1">
        <span ref={timerElRef} data-relogio-da-voz className={`text-sm font-medium tabular-nums text-ink-muted ${recording ? "" : "invisible"}`}>
          0:00
        </span>
        <span className={`text-xs ${errorMessage ? "text-danger" : dica ? "font-medium text-ink-muted" : "text-ink-faint"}`}>
          {errorMessage ?? dica ?? (recording ? voz.titulos.impVozSolte : voz.titulos.impVozSegure)}
        </span>
      </div>

      {/* Microfone bloqueado, sem rede ou sem entender (14/10/2026): em 4 dias foram 9 falhas de
          voz em produção, e a única saída era voltar e achar o Digitar. Agora ele está aqui. */}
      {errorMessage && onDigitar && <BotaoDigitar onClick={onDigitar} />}

      {/* No iPhone o Safari pergunta a permissão do microfone A CADA carregamento de página: é
          regra do navegador, não do app (o app já pede uma vez só, não duas). Quem sofre com
          isso são as pessoas que usam pelo navegador, então a saída fica aqui, na hora em que
          o incômodo acontece. */}
      {plataforma === "ios-safari" && !instalado && (
        <p className="max-w-xs text-center text-caption text-ink-faint">
          {/* A pergunta vem da voz do tema; o caminho dentro do Safari é fixo, porque é o nome
              dos menus do iPhone, não uma frase nossa. */}
          {voz.titulos.impVozSafariDica} Toque em <b>aA</b> na barra de endereço › <b>Configurações do Site</b> ›{" "}
          <b>Microfone: Permitir</b>. Ou instale o app na tela de início, em Mais › Instalar.
        </p>
      )}
    </div>
  );
}

function BotaoDigitar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mx-auto min-h-11 rounded-full bg-surface-2 px-5 text-[15px] font-medium text-ink">
      Digitar em vez disso
    </button>
  );
}
