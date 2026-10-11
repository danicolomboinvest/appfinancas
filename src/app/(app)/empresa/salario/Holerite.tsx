"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, House, PiggyBank } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { trocarPerfilAction } from "@/app/(app)/perfis/actions";
import type { Mes } from "@/lib/empresa/regras";
import { MESES } from "@/lib/empresa/resumo";
import { transferirSalarioAction } from "../actions";
import { BOTAO_PRINCIPAL, BOTAO_SECUNDARIO, Cartao, LinhaDoRecibo, Picote, Titulo, Voltar } from "../partes";

/**
 * O holerite do mês (protótipo aprovado): lucro do mês, o que fica no caixa e "Você recebe". O botão
 * passa a nota da empresa para o Pessoal e carimba "Pago". Nada sai do banco: é o registro.
 */
export function Holerite(p: { mes: Mes; empresa: string; pessoa: string; lucro: number; salario: number; pago: boolean; temPessoal: boolean; pessoalId: string | null; negocio: { com: string; sem: string } }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [salvando, iniciar] = useTransition();
  const [pago, setPago] = useState(p.pago);
  const [indo, setIndo] = useState(false);
  const titulo = `${MESES[p.mes.mes - 1][0].toUpperCase()}${MESES[p.mes.mes - 1].slice(1)} ${p.mes.ano}`;
  const fica = p.lucro - p.salario;

  function transferir() {
    iniciar(async () => {
      const r = await transferirSalarioAction({ ano: p.mes.ano, mes: p.mes.mes, valor: p.salario });
      if (!r.ok) return showError(r.erro);
      const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setIndo(true);
      setTimeout(() => {
        setPago(true);
        showToast("Salário no seu Pessoal");
        router.refresh();
      }, semAnimacao ? 0 : 420);
    });
  }

  return (
    <>
      <Voltar>{p.empresa}</Voltar>
      <Titulo>Seu salário</Titulo>
      <div className="relative rounded-3xl border border-border bg-surface px-4 pb-6 pt-4">
        <div className="flex items-center justify-between border-b border-dotted border-border-strong pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          <span>Holerite</span>
          <span>{titulo}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 border-b border-dotted border-border-strong py-3">
          <span className="min-w-0">
            <small className="block text-xs font-semibold uppercase tracking-wider text-ink-faint">Empresa</small>
            <b className="block truncate text-[15px] font-medium text-ink">{p.empresa}</b>
          </span>
          <span className="min-w-0">
            <small className="block text-xs font-semibold uppercase tracking-wider text-ink-faint">Para</small>
            <b className="block truncate text-[15px] font-medium text-ink">{p.pessoa}</b>
          </span>
        </div>
        <div className="pt-2">
          <LinhaDoRecibo rotulo="Lucro do mês" valor={p.lucro < 0 ? `−${m0(-p.lucro)}` : m0(p.lucro)} />
          <LinhaDoRecibo rotulo="Fica no caixa" valor={m0(Math.abs(fica))} menos={fica > 0} />
        </div>
        <HeroiDoTema className="relative mt-3">
          <p className="text-sm text-heroi-suave">Você recebe</p>
          <ValorDestaque texto={m0(p.salario)} />
          {pago && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-2 border-success px-3 py-1 text-center text-lg font-bold uppercase tracking-widest text-success">
              Pago
            </span>
          )}
        </HeroiDoTema>
        <Picote />
      </div>

      <Cartao className="flex items-center gap-3 px-4 py-4">
        <span className="flex flex-col items-center gap-1 text-xs text-ink-muted">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink">
            <PiggyBank size={18} strokeWidth={1.6} aria-hidden />
          </span>
          {p.negocio.sem[0].toUpperCase() + p.negocio.sem.slice(1)}
        </span>
        <span className="relative h-8 flex-1 border-b border-dashed border-border-strong">
          <span className={`absolute bottom-[-14px] rounded-lg bg-success-soft px-2 py-1 text-xs font-medium tabular-nums text-success transition-[left] duration-500 ${pago || indo ? "left-[calc(100%-5.5rem)]" : "left-0"}`}>{m0(p.salario)}</span>
        </span>
        <span className="flex flex-col items-center gap-1 text-xs text-ink-muted">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink">
            <House size={18} strokeWidth={1.6} aria-hidden />
          </span>
          Pessoal
        </span>
      </Cartao>

      {pago ? (
        <>
          <p className="flex items-center justify-center gap-2 text-sm text-ink">
            <Check size={16} className="text-success" aria-hidden /> Entrou no seu Pessoal como Pró-labore.
          </p>
          {p.pessoalId && (
            <button
              type="button"
              className={BOTAO_SECUNDARIO}
              onClick={() =>
                iniciar(async () => {
                  const r = await trocarPerfilAction(p.pessoalId!);
                  if (!r.ok) return showError(r.error);
                  router.push("/mensal");
                })
              }
            >
              Ver no Pessoal
            </button>
          )}
        </>
      ) : p.salario <= 0 ? (
        <p className="px-1 text-center text-sm text-ink-muted">Sem lucro neste mês para tirar salário.</p>
      ) : !p.temPessoal ? (
        <p className="px-1 text-center text-sm text-ink-muted">Crie o seu perfil Pessoal para o salário entrar lá.</p>
      ) : (
        <>
          <button type="button" className={BOTAO_PRINCIPAL} disabled={salvando} onClick={transferir}>
            <ArrowRight size={18} aria-hidden /> Transferir para o Pessoal
          </button>
          <p className="text-center text-sm text-ink-muted">Nada sai do banco: é o registro.</p>
        </>
      )}
    </>
  );
}
