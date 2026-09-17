"use client";

import { useState, useTransition } from "react";
import { FileText, CreditCard, Trash2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useToast } from "@/components/ui/toast-context";
import { deleteImportBatchAction } from "../../import-actions";
import { useMoney } from "@/components/money/MoneyProvider";

export type ImportBatchView = {
  id: string;
  docType: string;
  fileName: string | null;
  /** ISO string (Date não atravessa a fronteira server → client component). */
  createdAt: string;
  entryCount: number;
  totalAmount: number;
  months: string[];
};


function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** "2026/7" → "jul/2026" nos chips de mês do lote. */
function formatMonthChip(ym: string) {
  const [y, m] = ym.split("/").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(". de ", "/");
}

/**
 * Histórico do que foi importado em massa (extrato/fatura), com opção de desfazer um lote
 * inteiro — pra quando um arquivo subiu errado ou duplicado, sem caçar lançamento por
 * lançamento. Apagar é destrutivo (some tudo que aquele upload criou), então exige um
 * segundo toque de confirmação no próprio botão.
 */
export function ImportHistory({ batches }: { batches: ImportBatchView[] }) {
  const money = useMoney();
  const { showToast } = useToast();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = batches.filter((b) => !removedIds.has(b.id));
  if (visible.length === 0) return null;

  function handleDelete(batch: ImportBatchView) {
    if (confirmingId !== batch.id) {
      setConfirmingId(batch.id);
      return;
    }
    startTransition(async () => {
      const result = await deleteImportBatchAction(batch.id);
      setConfirmingId(null);
      if (!result.ok) return;
      setRemovedIds((prev) => new Set(prev).add(batch.id));
      showToast(`Importação desfeita: ${result.removed} lançamento${result.removed === 1 ? "" : "s"} removido${result.removed === 1 ? "" : "s"}.`);
    });
  }

  return (
    <CollapsibleSection label="Histórico de importações">
      <div className="flex flex-col gap-2">
        {visible.map((batch) => {
          const Icon = batch.docType === "fatura" ? CreditCard : batch.docType === "openfinance" ? Landmark : FileText;
          const confirming = confirmingId === batch.id;
          return (
            <Card key={batch.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {batch.docType === "fatura" ? "Fatura" : batch.docType === "openfinance" ? "Banco conectado" : "Extrato"}
                    {batch.fileName ? ` · ${batch.fileName}` : ""}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    <span className="tabular-nums">{formatDateTime(batch.createdAt)}</span>
                    {" · "}
                    {batch.entryCount} lançamento{batch.entryCount === 1 ? "" : "s"}
                    {" · "}
                    <span className="tabular-nums">{money(batch.totalAmount)}</span>
                    {batch.months.length > 0 && ` · ${batch.months.map(formatMonthChip).join(", ")}`}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={confirming ? "danger" : "secondary"}
                disabled={isPending}
                onClick={() => handleDelete(batch)}
                onBlur={() => setConfirmingId((id) => (id === batch.id ? null : id))}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {confirming ? "Confirmar exclusão?" : "Desfazer"}
              </Button>
            </Card>
          );
        })}
        <p className="text-xs text-ink-faint">
          Desfazer uma importação apaga todos os lançamentos que aquele arquivo criou. Importações feitas antes deste
          histórico existir não aparecem aqui.
        </p>
      </div>
    </CollapsibleSection>
  );
}
