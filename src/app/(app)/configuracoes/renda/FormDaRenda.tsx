"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { Button } from "@/components/ui/Button";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { DIA_MAXIMO_DO_MES, diaDeInicioDoMes, intervaloDoMes } from "@/lib/mes/periodo";
import { salvarRendaAction, type RendaState } from "../perfil/actions";

const inicial: RendaState = {};
const ATALHOS = [1, 5, 10, 15, 20];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function FormDaRenda({ renda, dia, diaInicioMes }: { renda: number | null; dia: number | null; diaInicioMes: number | null }) {
  const [state, acao, pendente] = useActionState(salvarRendaAction, inicial);
  // Fica na tela depois de salvar: o próprio botão diz "Salvo" (14/10/2026).
  const { salvou } = useSuccessToast(pendente, state.error);
  const [diaPagto, setDiaPagto] = useState(dia ? String(dia) : "");
  // Dia em que o mês começa (21/10/2026). 1 = o mês de sempre. O cartão fica fechado enquanto
  // a pessoa não precisa dele.
  const [inicio, setInicio] = useState(diaInicioMes ?? 1);
  const [aberto, setAberto] = useState(diaInicioMes !== null);
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const intervalo = intervaloDoMes(hoje.getFullYear(), mesAtual, inicio);
  const mesmoDoPagamento = diaDeInicioDoMes(diaPagto);

  return (
    <form action={acao} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <CurrencyField label="Renda do mês" name="renda" required defaultValue={renda ?? undefined} />
      {/* Quem recebe em outra moeda procurava aqui e não achava (20/10/2026, cliente na Argentina). */}
      <Link href="/configuracoes/moeda" className="-mt-2 self-start text-[13px] font-medium text-ink-muted underline underline-offset-2">
        Recebe em outra moeda? Trocar a moeda
      </Link>
      <Field label="Dia do pagamento" name="dia" type="number" min={1} max={31} required value={diaPagto} onChange={(e) => setDiaPagto(e.target.value)} placeholder="5" />

      <input type="hidden" name="diaInicioMes" value={inicio} />
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 text-left"
        >
          <span className="flex flex-col">
            <span className="text-[15px] font-medium text-ink">Meu mês não começa no dia 1</span>
            <span className="text-[13px] text-ink-muted">Hoje: 1 a 31</span>
          </span>
          <ChevronRight size={20} aria-hidden className="text-ink-faint" />
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
          <p className="text-[15px] font-medium text-ink">Seu mês começa no dia</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Um dia antes"
              onClick={() => setInicio((d) => Math.max(1, d - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-border"
            >
              <Minus size={20} aria-hidden />
            </button>
            <span className="min-w-20 text-center text-[52px] font-light leading-none tabular-nums text-ink">{inicio}</span>
            <button
              type="button"
              aria-label="Um dia depois"
              onClick={() => setInicio((d) => Math.min(DIA_MAXIMO_DO_MES, d + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-border"
            >
              <Plus size={20} aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Atalhos">
            {ATALHOS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={inicio === d}
                onClick={() => setInicio(d)}
                className={`flex h-10 min-w-11 items-center justify-center rounded-full px-3 text-[15px] tabular-nums ${
                  inicio === d ? "bg-ink font-semibold text-canvas" : "bg-surface text-ink ring-1 ring-border"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-center text-[14px] text-ink-muted">
            {intervalo ? (
              <>
                {MESES[mesAtual - 1]} vai de <b className="font-semibold text-ink">{intervalo}</b>
              </>
            ) : (
              <>O mês de sempre, do dia 1 ao fim</>
            )}
          </p>
          {mesmoDoPagamento && mesmoDoPagamento !== inicio && (
            <button type="button" onClick={() => setInicio(mesmoDoPagamento)} className="min-h-10 self-center text-[14px] font-medium text-accent-strong">
              Usar o mesmo dia do meu pagamento
            </button>
          )}
          <p className="text-[13px] leading-snug text-ink-muted">
            Vale para o que você lançar daqui para frente. O que já está no app fica no mês em que estava.
          </p>
        </div>
      )}

      <Button type="submit" disabled={pendente} className="min-h-12 w-full">
        {pendente ? "Salvando…" : salvou ? "Salvo" : "Salvar"}
      </Button>
    </form>
  );
}
