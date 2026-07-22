"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  parseIrpfAction,
  applyIrpfAction,
  type IrpfPreviewItem,
  type WalletAssetOption,
} from "@/app/(app)/carteira/irpf-actions";

type Phase = "upload" | "confirm" | "done";

const KIND_LABEL: Record<IrpfPreviewItem["kind"], string> = { acao: "Ação", fii: "FII", etf: "ETF" };

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildForm(file: File): FormData {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", "pdf");
  return formData;
}

/** Escolha de ativo por linha: o id do ativo casado, ou "" pra ignorar aquele preço médio. */
type Choice = Record<number, string>;

/**
 * Importa o preço médio (custo de aquisição) das ações e FIIs a partir do PDF da declaração de
 * IR — o dado que os extratos de corretora quase nunca trazem. Sobe o PDF, o servidor lê a seção
 * "Bens e Direitos" e casa com a carteira; a revisão mostra o "antes → depois" do valor investido
 * e deixa escolher o ativo à mão quando a declaração só traz o nome da empresa (sem ticker).
 */
export function IrpfImport({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [items, setItems] = useState<IrpfPreviewItem[]>([]);
  const [wallet, setWallet] = useState<WalletAssetOption[]>([]);
  const [choice, setChoice] = useState<Choice>({});
  const [updated, setUpdated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    if (file.size > 7.5 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. ~7 MB).");
      return;
    }
    startTransition(async () => {
      const result = await parseIrpfAction(buildForm(file));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems(result.items);
      setWallet(result.walletAssets);
      // Pré-seleciona o ativo casado automaticamente; o resto começa "não aplicar".
      setChoice(Object.fromEntries(result.items.map((i) => [i.key, i.matchedAssetId ?? ""])));
      setPhase("confirm");
    });
  }

  function pickAsset(key: number, assetId: string) {
    setChoice((prev) => ({ ...prev, [key]: assetId }));
  }

  function handleApply() {
    const walletById = new Map(wallet.map((w) => [w.id, w]));
    const confirmed = items
      .filter((i) => choice[i.key])
      .map((i) => ({ assetId: choice[i.key], averagePrice: i.averagePrice, irQuantity: i.irQuantity }))
      // Não deixa dois ativos da declaração apontarem pro mesmo ativo da carteira.
      .filter((c, idx, arr) => arr.findIndex((x) => x.assetId === c.assetId) === idx)
      .filter((c) => walletById.has(c.assetId));

    if (confirmed.length === 0) {
      setError("Selecione ao menos um ativo pra aplicar o preço médio.");
      return;
    }
    startTransition(async () => {
      const result = await applyIrpfAction(confirmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUpdated(result.updated);
      setPhase("done");
    });
  }

  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-sm text-ink-muted">
          Sua declaração de IR tem o <span className="text-ink">preço médio</span> de cada ação e FII (o custo de
          aquisição) — o que os extratos de corretora não trazem. Suba o PDF do recibo da declaração e eu preencho o
          investido de cada ativo, pra o lucro/prejuízo calcular certo.
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? "Lendo declaração..." : "Escolher PDF da declaração"}</span>
          <span className="text-caption text-ink-faint">Recibo da Declaração de Ajuste Anual (PDF de texto)</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
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
    // Conta ATIVOS DA CARTEIRA distintos (não linhas): duas linhas apontando pro mesmo ativo
    // aplicam uma vez só — o botão promete exatamente o que a action vai fazer.
    const selectedCount = new Set(items.map((i) => choice[i.key]).filter(Boolean)).size;
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-sm text-ink-muted">
          Encontrei <span className="text-ink">{items.length}</span> ativo{items.length === 1 ? "" : "s"} com preço médio.
          Confira o ativo da sua carteira em cada linha (as que a declaração só traz o nome da empresa vêm sem casar —
          escolha à mão ou deixe de fora).
        </p>

        <ul className="flex max-h-[24rem] flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {items.map((i) => {
            const target = choice[i.key] ?? "";
            const qty = wallet.find((w) => w.id === target)?.quantity ?? i.irQuantity;
            const newInvested = qty && qty > 0 ? i.averagePrice * qty : null;
            return (
              <li key={i.key} className="flex flex-col gap-1.5 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {i.irTicker ?? i.irName}
                      <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">
                        {KIND_LABEL[i.kind]}
                      </span>
                    </p>
                    <p className="text-caption text-ink-faint">
                      Preço médio <span className="text-ink-muted tabular-nums">{formatBRL(i.averagePrice)}</span>
                      {i.irQuantity ? ` · ${i.irQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} na declaração` : ""}
                    </p>
                  </div>
                  {newInvested !== null && target && (
                    <p className="shrink-0 text-right text-caption tabular-nums text-ink-faint">
                      investido{" "}
                      {i.currentInvested !== null ? `${formatBRL(i.currentInvested)} → ` : ""}
                      <span className="text-ink">{formatBRL(newInvested)}</span>
                    </p>
                  )}
                </div>
                <select
                  value={target}
                  onChange={(e) => pickAsset(i.key, e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">— não aplicar —</option>
                  {wallet.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>

        <p className="text-caption text-ink-faint">
          O preço médio vira o valor investido (preço médio × quantidade da carteira). A cotação atual não muda — só o
          investido, que é a base do lucro/prejuízo.
        </p>

        <Button type="button" onClick={handleApply} disabled={isPending || selectedCount === 0}>
          {isPending ? "Aplicando..." : `Aplicar em ${selectedCount} ativo${selectedCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">
        Preço médio preenchido em {updated} ativo{updated === 1 ? "" : "s"}. Agora o lucro/prejuízo deles calcula certo.
      </p>
      <Button type="button" onClick={onDone}>
        Concluir
      </Button>
    </div>
  );
}
