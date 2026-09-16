"use client";

import { useState, useTransition } from "react";
import { Bookmark, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { saveSimulationAction } from "@/app/(app)/simuladores/actions";
import type { WizardValues } from "./SimulatorWizard";

/**
 * Guardar o cenário que acabou de ser calculado.
 *
 * Sem isto, simular era escrever sete números, ler uma resposta e perder tudo — não dava pra
 * comparar dois cenários ("e se eu der 20% de entrada?"), voltar depois nem mostrar pra
 * alguém. O nome é opcional de propósito: quem só quer guardar não deve ser obrigado a
 * batizar, e quem está comparando cenários precisa distinguir um do outro.
 */
export function SaveSimulation({
  type,
  values,
  resumo,
}: {
  type: "FINANCIAR_VS_ALUGAR" | "AMORTIZAR_VS_INVESTIR" | "CONSORCIO_VS_FINANCIAMENTO" | "MARCACAO_MERCADO" | "CARRO";
  values: WizardValues;
  /** Frase do resultado, ex.: "Alugar sai R$ 125 mil à frente em 20 anos." */
  resumo: string;
}) {
  const { showToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pendente, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await saveSimulationAction({ type, name: nome, inputs: values, resumo });
      if (r.error) {
        showToast(r.error);
        return;
      }
      setSalvo(true);
      setAberto(false);
      showToast("Simulação salva. Ela fica na lista de simuladores.");
    });
  }

  if (salvo) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-caption font-medium text-success">
        <Check size={14} strokeWidth={3} />
        Simulação salva
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
      >
        <Bookmark size={15} strokeWidth={2} />
        Salvar esta simulação
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={80}
        placeholder="Dê um nome (opcional)"
        className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={pendente}
        onClick={salvar}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
      >
        {pendente ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" onClick={() => setAberto(false)} className="text-caption text-ink-muted hover:text-ink">
        cancelar
      </button>
    </div>
  );
}
