"use client";

import { useState } from "react";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { NumeroRolante } from "@/components/ui/NumeroRolante";
import { NUMERO_DESTAQUE } from "@/components/ui/ValorDestaque";
import { useMoney } from "@/components/money/MoneyProvider";
import { Receipt } from "lucide-react";
import type { MesDeProventos } from "@/lib/portfolio/proventos";
import { AvatarDoAtivo } from "../AvatarDoAtivo";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Linha = { ticker: string; nome: string; cor: string };

function lista(nomes: string[]): string {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : (nomes[0] ?? "");
}

export function ProventosTela({
  dozeMeses,
  media,
  meses,
  aCaminho,
  totalACaminho,
  ranking,
  paga,
  temBruto,
}: {
  dozeMeses: number;
  media: number;
  meses: MesDeProventos[];
  aCaminho: (Linha & { tipo: string; data: string; valor: number })[];
  totalACaminho: number;
  ranking: (Linha & { valor: number; sobreOQuePagou: number | null })[];
  paga: string[];
  temBruto: boolean;
}) {
  const money = useMoney();
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(...meses.map((m) => m.recebido + m.aCaminho), 0.01);
  const maiorRk = ranking[0]?.valor ?? 1;

  if (dozeMeses <= 0 && totalACaminho <= 0) {
    return (
      <HeroiDoTema>
        <p className="text-[15px] text-heroi-suave">Sua renda passiva</p>
        <p className="titulo-tema text-[24px] font-light leading-tight">Ainda nada por aqui</p>
        <p className="text-[14px] text-heroi-suave">Quando seus FIIs e ações pagarem, cada pagamento aparece aqui, com o mês e o valor. Para isso, o ativo precisa ter o código e a quantidade de cotas.</p>
      </HeroiDoTema>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HeroiDoTema>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] text-heroi-suave">Sua renda passiva</p>
          <Explica noHeroi>
            O que seus ativos pagaram nos últimos 12 meses, pelas cotas que você tem hoje. JSCP já sem os 15% de imposto.{temBruto ? " Alguns rendimentos aparecem como anunciados, antes de imposto." : ""}
          </Explica>
        </div>
        <NumeroRolante texto={money(dozeMeses)} className={NUMERO_DESTAQUE} />
        <p className="text-[14px] text-heroi-suave">
          nos últimos 12 meses · média de <span className="whitespace-nowrap font-medium text-[var(--color-heroi-tinta)]">{money(media)}</span> por mês
        </p>
      </HeroiDoTema>

      {paga.length > 0 && (
        <div className="glass flex items-center gap-3 rounded-3xl p-3.5">
          <span className="flex -space-x-2">
            {paga.map((n) => (
              <LogoDoLancamento key={n} descricao={n} icon={Receipt} size={36} />
            ))}
          </span>
          <p className="text-[15px] font-medium text-ink">Sua renda passiva já paga {lista(paga)}</p>
        </div>
      )}

      <section className="glass rounded-3xl p-4" aria-label="Mês a mês">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-medium text-ink">Mês a mês</h2>
          <span className="flex items-center gap-3 text-[12px] text-ink-muted">
            <span className="flex items-center gap-1">
              <i className="size-2.5 rounded-[3px] bg-success" /> recebido
            </span>
            <span className="flex items-center gap-1">
              <i className="size-2.5 rounded-[3px] border border-success bg-[repeating-linear-gradient(135deg,var(--color-success)_0_2px,transparent_2px_4px)]" /> a caminho
            </span>
          </span>
        </div>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {meses.map((m, k) => {
            const total = m.recebido + m.aCaminho;
            return (
              <button
                key={`${m.ano}-${m.mes}`}
                type="button"
                onClick={() => setSel(sel === k ? null : k)}
                aria-label={`${MES_LONGO[m.mes - 1]}: ${money(total)}${m.aCaminho > 0 ? " a caminho" : ""}`}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="flex w-full flex-col justify-end overflow-hidden rounded-t-[4px]" style={{ height: `${Math.max(total > 0 ? 4 : 2, (total / max) * 92)}%`, opacity: sel === null || sel === k ? 1 : 0.45 }}>
                  {m.aCaminho > 0 && <span className="w-full border border-success bg-[repeating-linear-gradient(135deg,var(--color-success)_0_2px,transparent_2px_5px)]" style={{ flexGrow: m.aCaminho }} />}
                  {m.recebido > 0 && <span className="w-full bg-success" style={{ flexGrow: m.recebido }} />}
                  {total === 0 && <span className="h-full w-full bg-border" />}
                </span>
                <span className="text-[12px] text-ink-muted">{MES[m.mes - 1]}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 min-h-5 text-[13px] text-ink" aria-live="polite">
          {sel !== null && (
            <>
              <span className="font-medium">{MES_LONGO[meses[sel].mes - 1]}</span>: {money(meses[sel].recebido + meses[sel].aCaminho)}
              {meses[sel].aCaminho > 0 ? " (a caminho)" : ""}
            </>
          )}
        </p>
      </section>

      {aCaminho.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="A caminho">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="titulo-tema text-[18px] font-medium text-ink">A caminho</h2>
            <span className="text-[15px] font-medium tabular-nums text-success">{money(totalACaminho)}</span>
          </div>
          <ul className="glass flex flex-col rounded-3xl px-4">
            {aCaminho.map((p, k) => {
              const d = new Date(p.data);
              return (
                <li key={`${p.ticker}-${k}`} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
                  <AvatarDoAtivo nome={p.nome} ticker={p.ticker} tesouro={false} cor={p.cor} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{p.ticker}</span>
                    <span className="block text-[13px] text-ink-muted">
                      {p.tipo} · {d.getUTCDate()} {MES[d.getUTCMonth()]}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-ink">{money(p.valor)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ranking.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Quem mais pagou">
          <h2 className="titulo-tema px-1 text-[18px] font-medium text-ink">Quem mais pagou</h2>
          <ul className="glass flex flex-col rounded-3xl px-4">
            {ranking.map((r) => (
              <li key={r.ticker} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-3 first:border-t-0">
                <AvatarDoAtivo nome={r.nome} ticker={r.ticker} tesouro={false} cor={r.cor} size={44} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{r.ticker}</span>
                  {r.sobreOQuePagou !== null && (
                    <span className="block text-[12.5px] text-ink-muted">
                      {(r.sobreOQuePagou * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}% sobre o que você pagou
                    </span>
                  )}
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-success" style={{ width: `${(r.valor / maiorRk) * 100}%` }} />
                  </span>
                </span>
                <span className="shrink-0 text-[15px] tabular-nums text-ink">{money(r.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
