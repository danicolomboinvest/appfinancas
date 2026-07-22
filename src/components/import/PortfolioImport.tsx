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

function formatQty(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
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
 * Importação da carteira: sobe o extrato de posição da corretora/B3 (CSV/Excel/PDF) e o
 * servidor compara com a carteira atual, a revisão mostra só o que interessa: NOVOS
 * (entram na carteira) e MUDANÇAS (quantidade/valor atualizados, "antes → depois").
 * O que não mudou é só um contador; reimportar o mesmo extrato nunca duplica nada.
 */
export function PortfolioImport({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [holdings, setHoldings] = useState<ParsedHoldingItem[]>([]);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    // Limite do corpo da Server Action é 8 MB, barra antes com mensagem clara.
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
      // Sem mudança fica fora da revisão, só conta no aviso.
      setHoldings(result.holdings.filter((h) => h.status !== "unchanged"));
      setUnchangedCount(result.holdings.filter((h) => h.status === "unchanged").length);
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
      investedValue: h.investedValue,
      assetClass: h.assetClass,
      fixedIncomeIndex: h.fixedIncomeIndex,
      mode: h.status === "changed" ? "update" : "create",
    }));
    startTransition(async () => {
      const result = await importPortfolioAction(confirmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setUpdatedCount(result.updated);
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
    const news = holdings.filter((h) => h.status === "new");
    const changes = holdings.filter((h) => h.status === "changed");
    const nothingToDo = holdings.length === 0;

    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {nothingToDo ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-muted">
            Sua carteira já está em dia com esse extrato, {unchangedCount} ativo{unchangedCount === 1 ? "" : "s"} conferido
            {unchangedCount === 1 ? "" : "s"}, nenhuma mudança encontrada. 🎉
          </p>
        ) : (
          <>
            {news.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink">
                  Novos na carteira <span className="text-ink-faint">({news.length})</span>
                </p>
                <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {news.map((h) => (
                    <li key={h.key} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{h.ticker}</p>
                        <p className="text-caption text-ink-faint">
                          {h.quantity > 0 ? `${formatQty(h.quantity)} · ` : ""}
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
              </div>
            )}

            {changes.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink">
                  Mudanças <span className="text-ink-faint">({changes.length})</span>
                </p>
                <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {changes.map((h) => {
                    const qtyChanged =
                      h.quantity > 0 && h.prevQuantity !== null && Math.abs(h.quantity - h.prevQuantity) > 1e-6;
                    return (
                      <li key={h.key} className="flex items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{h.ticker}</p>
                          <p className="text-caption text-ink-faint">
                            {qtyChanged && (
                              <>
                                {formatQty(h.prevQuantity as number)} → <span className="text-ink">{formatQty(h.quantity)}</span>
                                {" · "}
                              </>
                            )}
                            {h.prevValue !== null ? `${formatBRL(h.prevValue)} → ` : ""}
                            <span className="text-ink">{formatBRL(h.value)}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(h.key)}
                          className="text-caption text-ink-faint hover:text-danger"
                          aria-label={`Não atualizar ${h.ticker}`}
                        >
                          Pular
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {unchangedCount > 0 && (
              <p className="text-caption text-ink-faint">
                {unchangedCount} ativo{unchangedCount === 1 ? "" : "s"} sem mudança, já {unchangedCount === 1 ? "está" : "estão"} na
                carteira e {unchangedCount === 1 ? "fica" : "ficam"} como {unchangedCount === 1 ? "está" : "estão"}.
              </p>
            )}
          </>
        )}

        {nothingToDo ? (
          <Button type="button" onClick={onDone}>
            Concluir
          </Button>
        ) : (
          <Button type="button" onClick={handleImport} disabled={isPending}>
            {isPending
              ? "Aplicando..."
              : [
                  news.length > 0 ? `Adicionar ${news.length}` : null,
                  changes.length > 0 ? `atualizar ${changes.length}` : null,
                ]
                  .filter(Boolean)
                  .join(" e ")
                  .replace(/^atualizar/, "Atualizar")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">
        {[
          createdCount > 0 ? `${createdCount} novo${createdCount === 1 ? "" : "s"} na carteira` : null,
          updatedCount > 0 ? `${updatedCount} atualizado${updatedCount === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Nada pra mudar, carteira já estava em dia."}
      </p>
      <Button type="button" onClick={onDone}>
        Concluir
      </Button>
    </div>
  );
}
