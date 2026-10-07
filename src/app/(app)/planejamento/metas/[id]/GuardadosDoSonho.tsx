"use client";

import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast-context";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { formatMoney } from "@/lib/money";
import { editarGuardadoDoSonhoAction, excluirGuardadoDoSonhoAction } from "../actions";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type GuardadoDoSonho = { id: string; amount: number; year: number; month: number; description: string | null; futuro: boolean };

/**
 * "O que você guardou" para este sonho, com cada registro corrigível ali mesmo (01/10/2026).
 *
 * Cliente marcou "Guardei R$ X em outubro" com o valor errado e não achou onde corrigir: foi
 * parar no "Já guardado" do formulário e apagou dado para desfazer. Aqui ela toca no registro,
 * muda o valor ou o mês, ou exclui. O total do sonho é calculado destes lançamentos, então a
 * página refaz a conta na hora.
 */
export function GuardadosDoSonho({ itens }: { itens: GuardadoDoSonho[] }) {
  const money = useMoney();
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <Card id="guardado" className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">O que você guardou</p>
        <p className="text-caption text-ink-muted">Marcou um valor errado? Toque no registro para corrigir ou excluir.</p>
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-ink-muted">Nada registrado ainda. Quando você marcar &quot;Guardei&quot; na lista de sonhos, aparece aqui.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {itens.map((it) =>
            aberto === it.id ? (
              <li key={it.id} className="bg-surface-2 p-3">
                <EditarGuardado item={it} onFechar={() => setAberto(null)} />
              </li>
            ) : (
              <li key={it.id}>
                <button type="button" onClick={() => setAberto(it.id)} className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {MESES[it.month - 1]} de {it.year}
                      {it.futuro && <span className="text-ink-faint">, ainda vai acontecer</span>}
                    </span>
                    {it.description && <span className="block truncate text-caption text-ink-faint">{it.description}</span>}
                  </span>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${it.amount < 0 ? "text-danger" : "text-accent-strong"}`}>
                    {it.amount < 0 ? `Tirei ${money(Math.abs(it.amount))}` : money(it.amount)}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </Card>
  );
}

function EditarGuardado({ item, onFechar }: { item: GuardadoDoSonho; onFechar: () => void }) {
  const currency = useCurrency();
  const { showToast, showError } = useToast();
  const [cents, setCents] = useState<number | null>(Math.round(Math.abs(item.amount) * 100));
  const [mes, setMes] = useState(`${item.year}-${String(item.month).padStart(2, "0")}`);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    if (!cents) return;
    iniciar(async () => {
      const r = await editarGuardadoDoSonhoAction(item.id, cents / 100, mes);
      if (r.error) return showError(r.error);
      showToast("Corrigido. O total do sonho já foi refeito.");
      onFechar();
    });
  }

  function excluir() {
    // Dois toques: excluir dinheiro guardado por engano seria pior que o erro que ela veio corrigir.
    if (!confirmarExclusao) return setConfirmarExclusao(true);
    iniciar(async () => {
      const r = await excluirGuardadoDoSonhoAction(item.id);
      if (r.error) return showError(r.error);
      showToast("Registro excluído. O total do sonho já foi refeito.");
      onFechar();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Valor</span>
          <input
            type="text"
            inputMode="numeric"
            value={!cents ? "" : formatMoney(cents / 100, currency)}
            // Selecionado ao tocar: o que ela digita SUBSTITUI o valor errado. Sem isso os dígitos
            // novos entravam depois dos antigos (1.428,57 virava 142.851.500,00 no teste).
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const digitos = e.target.value.replace(/\D/g, "");
              setCents(digitos === "" ? null : Number(digitos));
            }}
            // 16px: abaixo disso o Safari do iPhone dá zoom ao tocar no campo.
            className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-base tabular-nums text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Mês</span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendente || !cents}
          onClick={salvar}
          className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onFechar} className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink">
          Cancelar
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={excluir}
          className={`ml-auto min-h-11 rounded-full px-4 text-sm font-semibold ${confirmarExclusao ? "bg-danger text-on-accent" : "text-danger hover:bg-danger-soft"}`}
        >
          {confirmarExclusao ? "Toque de novo para excluir" : "Excluir"}
        </button>
      </div>
    </div>
  );
}
