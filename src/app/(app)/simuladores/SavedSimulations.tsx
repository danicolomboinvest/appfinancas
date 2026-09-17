"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { deleteSimulationAction } from "./actions";

const ROTA: Record<string, string> = {
  FINANCIAR_VS_ALUGAR: "/simuladores/financiar-vs-alugar",
  AMORTIZAR_VS_INVESTIR: "/simuladores/amortizar-vs-investir",
  CONSORCIO_VS_FINANCIAMENTO: "/simuladores/consorcio",
  MARCACAO_MERCADO: "/simuladores/marcacao-mercado",
  CARRO: "/simuladores/carro",
};

const NOME_DO_TIPO: Record<string, string> = {
  FINANCIAR_VS_ALUGAR: "Financiar vs. Alugar",
  AMORTIZAR_VS_INVESTIR: "Amortizar vs. Investir",
  CONSORCIO_VS_FINANCIAMENTO: "Consórcio vs. Financiamento",
  MARCACAO_MERCADO: "Marcação a Mercado",
  CARRO: "Carro: Assinar vs. Comprar",
};

export type SavedSimulation = {
  id: string;
  type: string;
  name: string | null;
  resumo: string;
  createdAt: string;
};

/**
 * As simulações guardadas, no topo da lista de simuladores.
 *
 * Reabrir leva os valores salvos pela URL (`?s=<id>`), e o cálculo é refeito do zero com a
 * fórmula atual — guardar o resultado pronto faria um número velho reaparecer como se fosse
 * verdade de hoje se a conta mudasse.
 */
export function SavedSimulations({ items }: { items: SavedSimulation[] }) {
  const [pendente, startTransition] = useTransition();
  if (items.length === 0) return null;

  return (
    <Section title="Suas simulações salvas">
      <ul className="flex flex-col">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
              <Bookmark size={17} strokeWidth={2} />
            </span>
            <Link href={`${ROTA[s.type] ?? "/simuladores"}?s=${s.id}`} className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{s.name ?? NOME_DO_TIPO[s.type] ?? "Simulação"}</p>
              <p className="mt-0.5 flex min-w-0 items-baseline gap-1 text-caption text-ink-muted">
                <span className="truncate">{s.resumo}</span>
                <span className="shrink-0">· {s.createdAt}</span>
              </p>
            </Link>
            <button
              type="button"
              aria-label="Apagar simulação"
              disabled={pendente}
              onClick={() => startTransition(() => void deleteSimulationAction(s.id))}
              className="shrink-0 rounded-full p-2 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
