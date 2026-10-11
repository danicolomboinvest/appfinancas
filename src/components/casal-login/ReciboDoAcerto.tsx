"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { marcarAcertoAction } from "@/app/(app)/divisao/casal-actions";
import { direcao } from "@/lib/casal-login/conta-por-conta";
import { BOTAO_ESCURO, Bolinha } from "./visual";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type DadosDoRecibo = {
  ano: number;
  mes: number;
  nomes: { A: string; B: string };
  letraTitular: "A" | "B";
  saldoA: number;
  pagou: { A: number; B: number };
  parte: { A: number; B: number };
  totalDaCasa: number;
  /** "Pela renda · 55 e 45", "Meio a meio", "Combinado · 60 e 40" ou "Por conta". */
  jeito: string;
  acertado: boolean;
  semDono: number;
};

/**
 * O acerto do mês como um recibo (direção B da proposta aprovada, casal-acerto-proposta.html):
 * quem manda à esquerda, quem recebe à direita, o dinheiro correndo pela seta, o valor grande e
 * uma linha de apoio. "Ver a conta" desenrola a parte e o que cada um pagou; "Já mandei" carimba
 * o mês com "Acertado", e "Desfazer" tira o carimbo.
 */
export function ReciboDoAcerto({ d }: { d: DadosDoRecibo }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [conta, setConta] = useState(false);
  const [ocupado, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const dir = direcao(d.saldoA);
  const nomeDoMes = MESES[d.mes - 1];
  const cor = (l: "A" | "B") => (l === d.letraTitular ? "titular" : "par");
  const de = dir?.de ?? (d.letraTitular === "A" ? "B" : "A");
  const para = dir?.para ?? d.letraTitular;

  if (d.totalDaCasa === 0 && d.semDono === 0) {
    return (
      <section className="rounded-[22px] bg-surface p-5 text-center shadow-[inset_0_0_0_1px_var(--color-border)]" aria-label={`Acerto de ${nomeDoMes}`}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Acerto de {nomeDoMes}</p>
        <p className="mt-3 text-[15px] text-ink-muted">Ainda não há gasto da casa com quem pagou. Ao lançar, escolha quem pagou e o acerto sai sozinho.</p>
      </section>
    );
  }

  function alternar() {
    setErro(null);
    start(async () => {
      const r = await marcarAcertoAction(d.ano, d.mes, !d.acertado);
      if (r.ok) router.refresh();
      else setErro(r.mensagem);
    });
  }

  return (
    <section aria-label={`Acerto de ${nomeDoMes}`} className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border),0_10px_30px_-18px_rgba(0,0,0,0.18)]">
        <div className="px-5 pb-5 pt-5 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Acerto de {nomeDoMes}</p>
          <div className="mt-4 flex items-center justify-center gap-2" aria-hidden>
            <Bolinha nome={d.nomes[de]} cor={cor(de)} size={48} />
            <span className="flex flex-1 items-center justify-between px-1 text-ink-faint">
              <span className="h-px flex-1 border-t border-dashed border-border-strong" />
              <i className="mx-2 size-1.5 rounded-full" style={{ background: cor(de) === "titular" ? "var(--color-accent-strong)" : "#4E7396" }} />
              <span className="h-px flex-1 border-t border-dashed border-border-strong" />
              <i className="mx-2 size-1.5 rounded-full bg-ink-muted" />
              <span className="h-px flex-1 border-t border-dashed border-border-strong" />
              <ChevronRight size={16} strokeWidth={2} className="-mr-1 text-accent-strong" />
            </span>
            <Bolinha nome={d.nomes[para]} cor={cor(para)} size={48} />
          </div>
          <div className="mt-1.5 flex justify-between px-1 text-[13px] font-medium text-ink-muted">
            <span>{d.nomes[de]}</span>
            <span>{d.nomes[para]}</span>
          </div>
          <p className={`mt-3 text-ink transition-opacity ${d.acertado ? "opacity-40" : ""}`}>
            <ValorDestaque texto={m(dir?.valor ?? 0)} className="text-[3.25rem] font-light leading-none tracking-[-0.03em] tabular-nums max-[359px]:text-[2.75rem]" />
          </p>
          <p className="mt-2 text-[15px] text-ink-muted">{dir ? `${d.nomes[de]} manda pra ${d.nomes[para]}` : "Os dois estão em dia"}</p>
          {d.acertado && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] rounded-xl border-[3px] border-solid px-4 py-1 text-[22px] font-semibold uppercase tracking-[0.18em] text-accent-strong opacity-90"
              style={{ borderColor: "var(--color-accent-strong)" }}
            >
              Acertado
            </span>
          )}
        </div>
        {/* O picote do recibo: a linha tracejada com os dois recortes nas bordas. */}
        <div className="relative h-0" aria-hidden>
          <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-canvas shadow-[inset_-1px_0_0_var(--color-border)]" />
          <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-canvas shadow-[inset_1px_0_0_var(--color-border)]" />
          <span className="absolute inset-x-4 top-0 border-t border-dashed border-border-strong" />
        </div>
        {conta && (
          <dl className="divide-y divide-border px-5 pt-2 text-[15px]">
            <Linha rotulo={`Casa em ${nomeDoMes}`} valor={m(d.totalDaCasa)} />
            {([d.letraTitular, d.letraTitular === "A" ? "B" : "A"] as const).map((l) => (
              <Linha
                key={l}
                rotulo={
                  <span className="flex items-center gap-2">
                    <i className="size-2 rounded-full" style={{ background: cor(l) === "titular" ? "var(--color-accent-strong)" : "#4E7396" }} aria-hidden />
                    {d.nomes[l]} pagou
                  </span>
                }
                valor={
                  <span className="text-right">
                    {m(d.pagou[l])}
                    <span className="block text-[13px] font-normal text-ink-muted">parte {m(d.parte[l])}</span>
                  </span>
                }
              />
            ))}
          </dl>
        )}
        <p className="px-5 pb-4 pt-3 text-center text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
          {d.jeito} · casa {m(d.totalDaCasa)}
        </p>
      </div>
      {erro && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">{erro}</p>}
      {dir && (
        <button type="button" onClick={alternar} disabled={ocupado} className={d.acertado ? "flex min-h-14 w-full items-center justify-center rounded-full bg-surface-2 px-5 text-[17px] font-semibold text-ink" : BOTAO_ESCURO}>
          {ocupado ? "Salvando..." : d.acertado ? "Desfazer" : "Já mandei"}
        </button>
      )}
      <button type="button" onClick={() => setConta((c) => !c)} aria-expanded={conta} className="mx-auto min-h-11 text-[16px] text-ink underline underline-offset-4">
        {conta ? "Fechar a conta" : "Ver a conta"}
      </button>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: React.ReactNode; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-ink-muted">{rotulo}</dt>
      <dd className="font-semibold tabular-nums text-ink">{valor}</dd>
    </div>
  );
}
