"use client";

import { Lock } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Bolinha, CARTAO, corDaPessoa } from "./visual";
import type { MeuNoCasal as Dados } from "@/lib/casal-login/meu-no-casal";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "O meu no casal" (protótipo aprovado, tela d): o que é de quem está olhando no mês do casal.
 * Gastei no mês grande; a barra separa a minha parte da casa do que é meu e os dois veem; os
 * quadrinhos dão o que coloquei na casa, o que mando no acerto, o "de Lucas" e o "só meu".
 * "De Lucas" (e não "do"): o app não sabe o gênero de ninguém do casal.
 */
export function MeuNoCasal({ dados, meuNome, souPar, mes }: { dados: Dados; meuNome: string; souPar: boolean; mes: number }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const total = dados.gasteiNoMes || 1;
  const pctCasa = Math.round((dados.minhaParteDaCasa / total) * 100);
  const cor = corDaPessoa(souPar ? "par" : "titular");
  // Arredonda o valor sem o sinal, como o cartão do acerto (457,50 vira 458 para os dois lados).
  const recebo = dados.noAcerto < 0;
  const valorDoAcerto = Math.round(Math.abs(dados.noAcerto));

  return (
    <section className={`${CARTAO} p-5`} aria-label="O meu no casal">
      <div className="flex items-center gap-3">
        <Bolinha nome={meuNome} cor={souPar ? "par" : "titular"} size={30} />
        <h2 className="flex-1 text-[17px] font-semibold text-ink">O meu no casal</h2>
        <span className="text-[14px] text-ink-muted">{MESES[mes - 1]}</span>
      </div>
      <p className="mt-4 text-[14px] text-ink-muted">Gastei no mês</p>
      <ValorDestaque texto={m(dados.gasteiNoMes)} className="mt-1 text-[2.5rem] font-light leading-none tracking-[-0.03em] text-ink tabular-nums max-[359px]:text-[2.25rem]" />
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="h-full" style={{ width: `${pctCasa}%`, background: cor }} />
        <span className="h-full opacity-40" style={{ width: `${100 - pctCasa}%`, background: cor }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: cor }} aria-hidden />
          Minha parte da casa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full opacity-40" style={{ background: cor }} aria-hidden />
          {`De ${meuNome}`}
        </span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Quadro rotulo="Coloquei na casa" valor={m(dados.coloqueiNaCasa)} />
        <Quadro rotulo={recebo ? "No acerto, recebo" : "No acerto, mando"} valor={m(valorDoAcerto)} />
        <Quadro rotulo={`De ${meuNome}, os dois veem`} valor={m(dados.doMeuVisivel)} />
        <div className="flex min-h-[76px] flex-col justify-center rounded-2xl px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Lock size={13} strokeWidth={1.8} aria-hidden />
            Só meu
          </span>
          <span className="mt-1 text-[15px] text-ink">Só você vê</span>
        </div>
      </div>
    </section>
  );
}

function Quadro({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-h-[76px] flex-col justify-center rounded-2xl bg-surface-2 px-3.5 py-3">
      <span className="text-[13px] leading-snug text-ink-muted">{rotulo}</span>
      <ValorDestaque texto={valor} className="mt-1 text-[20px] font-normal leading-none tabular-nums text-ink" />
    </div>
  );
}
