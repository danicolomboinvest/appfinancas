"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import type { LancamentoDoCasal } from "@/lib/repositories/nos-dois.repo";
import { LancamentosDoCasal } from "./LancamentosDoCasal";
import { Bolinha, CARTAO } from "./visual";

type Letra = "A" | "B";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** A página Lançamentos do casal: busca, Tudo | Nós dois | A | B, o total, o atalho do acerto e a lista por dia. */
export function LancamentosDoNossoMes({
  itens,
  nomes,
  letraTitular,
  minhaLetra,
  mes,
  saldoA,
  acertado,
  filtroInicial,
  focarBusca,
}: {
  itens: LancamentoDoCasal[];
  nomes: { A: string; B: string };
  letraTitular: Letra;
  minhaLetra: Letra;
  mes: number;
  saldoA: number;
  acertado: boolean;
  filtroInicial: "tudo" | Letra;
  focarBusca: boolean;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const [filtro, setFiltro] = useState<"tudo" | "nos" | Letra>(filtroInicial);
  const [q, setQ] = useState("");
  const papel = (x: Letra) => (x === letraTitular ? "titular" : "par");
  const termo = q.trim().toLowerCase();
  const visiveis = itens.filter((l) => {
    if (termo) return `${l.descricao} ${l.parentCategory ?? ""}`.toLowerCase().includes(termo);
    if (filtro === "nos") return l.destino === "nosso";
    if (filtro === "A" || filtro === "B") return (l.pessoa ?? letraTitular) === filtro;
    return true;
  });
  const total = visiveis.filter((l) => l.categoria === "EXPENSE").reduce((s, l) => s + l.valor, 0);
  const deve = Math.round(Math.abs(saldoA));
  const de: Letra = saldoA > 0 ? "B" : "A";
  const para: Letra = de === "A" ? "B" : "A";
  const fraseAcerto = acertado ? "Acertado" : deve >= 1 ? `${nomes[de]} passa ${m(deve)} para ${nomes[para]}` : "Ninguém deve nada";
  const rotuloFiltro = { tudo: "Tudo", nos: "Nós dois", A: nomes.A, B: nomes.B }[filtro];

  return (
    <div className="flex flex-col gap-3" data-lancamentos-casal>
      <Link href="/divisao" className="-ml-1 flex min-h-11 w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Nosso mês
      </Link>
      <h1 className="-mt-1 text-[1.625rem] font-medium leading-tight text-ink">Lançamentos</h1>
      <label className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Search size={16} className="shrink-0 text-ink-muted" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={focarBusca} placeholder="Procurar" aria-label="Procurar" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
      </label>
      {!termo && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quem">
          {(["tudo", "nos", "A", "B"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className="flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-surface">
              {(k === "A" || k === "B") && <Bolinha nome={nomes[k]} cor={papel(k)} size={18} />}
              {k === "tudo" ? "Tudo" : k === "nos" ? "Nós dois" : nomes[k]}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-0.5 px-1 pt-1">
        <small className="text-sm text-ink-muted">
          {termo ? `"${q.trim()}"` : rotuloFiltro} em {MESES[mes - 1]}
        </small>
        <b className="text-[1.75rem] font-light tabular-nums tracking-[-0.02em] text-ink">{m(total)}</b>
        <span className="text-sm text-ink-muted">
          {visiveis.length} {visiveis.length === 1 ? "lançamento" : "lançamentos"}
        </span>
      </div>
      <Link href="/divisao" className={`${CARTAO} flex items-center gap-3 px-4 py-3`}>
        <span className="flex shrink-0 items-center gap-1">
          <Bolinha nome={nomes[de]} cor={papel(de)} size={26} />
          <ArrowRight size={14} className="text-ink-muted" aria-hidden />
          <Bolinha nome={nomes[para]} cor={papel(para)} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <small className="block text-xs text-ink-muted">Acerto de {MESES[mes - 1]}</small>
          <b className="block break-words text-[15px] font-medium text-ink">{fraseAcerto}</b>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
      <LancamentosDoCasal itens={visiveis} nomes={nomes} letraTitular={letraTitular} minhaLetra={minhaLetra} mes={mes} podeLancar porDia />
    </div>
  );
}
