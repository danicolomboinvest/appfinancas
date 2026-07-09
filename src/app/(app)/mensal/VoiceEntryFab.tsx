"use client";

import { useState } from "react";
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

/**
 * Botão fixo "Registrar por voz" — transcrição via Web Speech API do navegador (grátis, sem
 * chave de API) + parser de regras (src/lib/entries/voice-expense-parser.ts, também sem custo).
 * Só pré-preenche o EntryForm existente; o usuário sempre revisa e confirma antes de salvar.
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

  function handleClick() {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setUnsupported(true);
      return;
    }
    if (recording) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setRecording(true);
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const result = parseVoiceEntry(transcript);
      setParsed(result);
      getRecentSubcategoriesAction().then(setRecentSubcategories);
      getCustomCategoriesAction().then(setCustomCategories);
      setModalOpen(true);
    };

    recognition.start();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Registrar por voz"
        title={unsupported ? "Reconhecimento de voz não disponível neste navegador" : "Registrar por voz"}
        className={`fixed bottom-20 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border shadow-premium transition-transform hover:scale-105 active:scale-95 ${
          recording ? "animate-pulse border-danger bg-danger text-canvas" : "border-border-strong bg-surface text-ink"
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
