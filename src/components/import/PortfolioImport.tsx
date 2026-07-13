"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check } from "lucide-react";
import type { AssetClass } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
  parsePortfolioAction,
  importPortfolioAction,
  type ParsedHoldingItem,
  type ConfirmedHolding,
} from "@/app/(app)/carteira/import-actions";

type Phase = "upload" | "confirm" | "done";

const CLASS_LABEL: Record<AssetClass, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  OUTRO: "Outro",
};
const CLASS_VALUES = Object.keys(CLASS_LABEL) as AssetClass[];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** O arquivo vai CRU num FormData (string grande de base64 estoura o limite de serialização
 * das actions). O encoding diz ao servidor como interpretar os bytes. */
function buildUploadForm(file: File): FormData {
  const name = file.name.toLowerCase();
  const encoding = name.endsWith(".xlsx") || name.endsWith(".xls") ? "xlsx" : name.endsWith(".pdf") ? "pdf" : "text";
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", encoding);
  return formData;
}

/**
 * Importação da carteira (item 5.1): sobe o extrato de posição da corretora/B3 (CSV), identifica
 * os ativos pelo ticker + quantidade e cria tudo de uma vez. A classe é inferida pelo ticker e
 * fica editável antes de confirmar.
 */
export function PortfolioImport({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [holdings, setHoldings] = useState<ParsedHoldingItem[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    // Limite do corpo da Server Action é 8 MB — barra antes com mensagem clara.
    if (file.size > 7.5 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. ~7 MB). Exporte um relatório menor e tente de novo.");
      return;
    }
    const formData = buildUploadForm(file);
    startTransition(async () => {
      const result = await parsePortfolioAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHoldings(result.holdings);
      setPhase("confirm");
    });
  }

  function setClass(key: number, assetClass: AssetClass) {
    setHoldings((prev) => prev.map((h) => (h.key === key ? { ...h, assetClass } : h)));
  }

  function remove(key: number) {
    setHoldings((prev) => prev.filter((h) => h.key !== key));
  }

  function handleImport() {
    const confirmed: ConfirmedHolding[] = holdings.map((h) => ({
      ticker: h.ticker,
      quantity: h.quantity,
      value: h.value,
      assetClass: h.assetClass,
    }));
    startTransition(async () => {
      const result = await importPortfolioAction(confirmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setPhase("done");
    });
  }

  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? "Lendo arquivo..." : "Escolher extrato da corretora"}</span>
          <span className="text-caption text-ink-faint">Posição da corretora ou da B3 (CSV, Excel ou PDF)</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-sm text-ink-muted">
          {holdings.length} ativo{holdings.length === 1 ? "" : "s"} identificado{holdings.length === 1 ? "" : "s"}. Ajuste a classe se precisar.
        </p>
        <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {holdings.map((h) => (
            <li key={h.key} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{h.ticker}</p>
                <p className="text-caption text-ink-faint">
                  {h.quantity > 0 ? `${h.quantity} · ` : ""}
                  {h.value > 0 ? formatBRL(h.value) : "sem valor"}
                </p>
              </div>
              <select
                value={h.assetClass}
                onChange={(e) => setClass(h.key, e.target.value as AssetClass)}
                className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {CLASS_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABEL[c]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(h.key)}
                className="text-caption text-ink-faint hover:text-danger"
                aria-label={`Remover ${h.ticker}`}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <Button type="button" onClick={handleImport} disabled={isPending || holdings.length === 0}>
          {isPending ? "Importando..." : `Importar ${holdings.length} ativo${holdings.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">{createdCount} ativos importados para a carteira.</p>
      <Button type="button" onClick={onDone}>
        Concluir
      </Button>
    </div>
  );
}
