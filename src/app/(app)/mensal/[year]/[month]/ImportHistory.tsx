"use client";

import { useState, useTransition } from "react";
import { FileText, CreditCard, Trash2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useToast } from "@/components/ui/toast-context";
import { deleteImportBatchAction } from "../../import-actions";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

export type ImportBatchView = {
  id: string;
  docType: string;
  fileName: string | null;
  /** ISO string (Date não atravessa a fronteira server → client component). */
  createdAt: string;
  entryCount: number;
  /** Fatura: o total da fatura. Extrato/banco: o saldo com sinal (ver lib/import/total-do-lote). */
  totalAmount: number;
  months: string[];
};


/** No fuso de Brasília dos dois lados: sem ele, o servidor (em UTC) escrevia uma hora e o celular
 * outra, e o React reclamava que o texto da página não batia (erro 418 em produção, 07/10/2026). */
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
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
  const { showToast, showError } = useToast();
  // Rótulos e avisos vêm da voz do tema; o que apaga continua sendo o servidor.
  const { voz } = useProfileTheme();
  const t = voz.titulos;
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
      // Sem o try, a internet caindo no meio do "desfazer" trocava o app inteiro pela tela de erro.
      let result: Awaited<ReturnType<typeof deleteImportBatchAction>>;
      try {
        result = await deleteImportBatchAction(batch.id);
      } catch (err) {
        console.error("deleteImportBatchAction falhou", err);
        setConfirmingId(null);
        showError(t.acaoFalhou);
        return;
      }
      setConfirmingId(null);
      if (!result.ok) return;
      setRemovedIds((prev) => new Set(prev).add(batch.id));
      showToast(t.impHistoricoDesfeita(result.removed));
    });
  }

  return (
    <CollapsibleSection label={t.impHistoricoTitulo}>
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
                    {batch.docType === "fatura" ? t.impHistoricoFatura : batch.docType === "openfinance" ? t.impHistoricoBanco : t.impHistoricoExtrato}
                    {batch.fileName ? `, ${batch.fileName}` : ""}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    <span className="tabular-nums">{formatDateTime(batch.createdAt)}</span>
                    {", "}
                    {t.impHistoricoLancamentos(batch.entryCount)}
                    {", "}
                    {/* Extrato mostra o saldo com sinal, como na confirmação: somar renda e gasto
                        juntos dava um número maior que o arquivo e parecia importação duplicada. */}
                    <span className="tabular-nums">
                      {batch.docType === "fatura" ? money(batch.totalAmount) : `${batch.totalAmount >= 0 ? "+" : "−"} ${money(Math.abs(batch.totalAmount))}`}
                    </span>
                    {batch.months.length > 0 && `, ${batch.months.map(formatMonthChip).join(", ")}`}
                  </p>
                  {/* O "Remover" do pagamento no extrato apaga de vez (não há onde guardar o que
                      saiu): desfazer a fatura depois deixava o mês sem as compras E sem o pagamento. */}
                  {confirming && batch.docType === "fatura" && <p className="mt-1 text-xs text-danger">{t.impHistoricoFaturaAviso}</p>}
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
                {confirming ? t.impHistoricoConfirmar : t.impHistoricoDesfazer}
              </Button>
            </Card>
          );
        })}
        <p className="text-xs text-ink-faint">{t.impHistoricoNota}</p>
      </div>
    </CollapsibleSection>
  );
}
