"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Search, ShieldCheck, Tag, Users } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { categoryIcon, categoryLabel, colorForCategorySlice, isParentCategoryKey } from "@/lib/categories";
import type { LancamentoDoCasal } from "@/lib/repositories/nos-dois.repo";
import { Bolinha, CARTAO, corDaPessoa } from "./visual";

type Letra = "A" | "B";
type Nomes = { A: string; B: string };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type DadosDoNossoMes = {
  nomes: Nomes;
  letraTitular: Letra;
  mes: number;
  dia: number;
  diasNoMes: number;
  plano: number | null;
  totalDaCasa: number;
  pagou: { A: number; B: number };
  parte: { A: number; B: number };
  contas: { chave: string; nome: string; parentCategory: ParentCategory | null; valor: number; pagou: { A: number; B: number } }[];
  lancamentos: LancamentoDoCasal[];
};

/**
 * O Nós dois no desenho do protótipo (#casal): abas Nosso mês | Orçamento | Metas. O Nosso mês
 * tem a capa com o mês e os dois, "Os dois veem esta tela", o filtro Nós dois | A | B, o Procurar,
 * o livre do casal, o acerto, quem colocou na casa, as contas do mês, por categoria (quem pagou),
 * o de cada um (fora do acerto), os lançamentos e o fechamento do mês passado.
 */
export function TelaNosDois({ mes, acerto, fechamento, orcamento, metas, botaoLancar }: { mes: DadosDoNossoMes; acerto: ReactNode; fechamento: ReactNode; orcamento: ReactNode; metas: ReactNode; botaoLancar: ReactNode }) {
  const [aba, setAba] = useState<"mes" | "orc" | "metas">("mes");
  return (
    <div className="flex flex-col gap-4" data-tela-nos-dois>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Nós dois">
        {(
          [
            ["mes", "Nosso mês"],
            ["orc", "Orçamento"],
            ["metas", "Metas"],
          ] as const
        ).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className="min-h-10 rounded-full text-sm text-ink-muted aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-sm">
            {t}
          </button>
        ))}
      </div>
      {aba === "mes" && <NossoMes d={mes} acerto={acerto} fechamento={fechamento} />}
      {aba === "orc" && orcamento}
      {aba === "metas" && metas}
      {botaoLancar}
    </div>
  );
}

function NossoMes({ d, acerto, fechamento }: { d: DadosDoNossoMes; acerto: ReactNode; fechamento: ReactNode }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const { categorias } = useProfileTheme();
  const [lente, setLente] = useState<"nos" | Letra>("nos");
  const papel = (q: Letra) => (q === d.letraTitular ? "titular" : "par");
  const corDe = (q: Letra) => corDaPessoa(papel(q));
  const gastos = d.lancamentos.filter((l) => l.categoria === "EXPENSE");
  const daCasa = gastos.filter((l) => l.destino === "nosso");
  const deCada = (q: Letra) => gastos.filter((l) => l.destino !== "nosso" && (l.pessoa ?? d.letraTitular) === q);
  const diasQueFaltam = Math.max(1, d.diasNoMes - d.dia + 1);
  const livre = d.plano !== null ? d.plano - d.totalDaCasa : null;
  const mesNome = MESES[d.mes - 1];

  // Por categoria · quem pagou (só os gastos da casa).
  const porCategoria = new Map<string, { A: number; B: number }>();
  for (const l of daCasa) {
    const k = l.parentCategory ?? "OUTROS";
    const c = porCategoria.get(k) ?? { A: 0, B: 0 };
    c[l.pessoa ?? d.letraTitular] += l.valor;
    porCategoria.set(k, c);
  }
  const cats = [...porCategoria.entries()]
    .map(([k, v]) => ({ k, A: lente === "B" ? 0 : v.A, B: lente === "A" ? 0 : v.B }))
    .filter((c) => c.A + c.B > 0)
    .sort((a, b) => b.A + b.B - (a.A + a.B));
  const maiorCat = Math.max(1, ...cats.map((c) => c.A + c.B));
  const contas = d.contas.filter((c) => lente === "nos" || c.pagou[lente] > 0);
  const nLanc = lente === "nos" ? d.lancamentos.length : d.lancamentos.filter((l) => (l.pessoa ?? d.letraTitular) === lente).length;

  const heroi =
    lente === "nos" ? (
      <HeroiDoTema>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-heroi-suave">{livre !== null ? "Livre do casal" : "Gastos da casa"}</span>
          <ValorDestaque texto={m(livre !== null ? Math.max(0, livre) : d.totalDaCasa)} />
          <span className="text-[15px] text-heroi-suave">
            {livre !== null ? `de ${m(d.plano!)} · ${m(Math.max(0, livre) / diasQueFaltam)} por dia até o dia ${d.diasNoMes}` : `em ${mesNome.toLowerCase()}`}
          </span>
        </div>
      </HeroiDoTema>
    ) : (
      <HeroiDoTema>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-heroi-suave">
            {d.nomes[lente]} pagou em {mesNome.toLowerCase()}
          </span>
          <ValorDestaque texto={m(d.pagou[lente] + deCada(lente).reduce((s, l) => s + l.valor, 0))} />
          <span className="text-[15px] text-heroi-suave">
            {m(d.pagou[lente])} da casa · {m(deCada(lente).reduce((s, l) => s + l.valor, 0))} só de {d.nomes[lente]} · parte na casa {m(d.parte[lente])}
          </span>
        </div>
      </HeroiDoTema>
    );

  const icone = (k: string) => (isParentCategoryKey(k) ? categoryIcon(categorias, k) : Tag);
  const cor = (k: string) => (isParentCategoryKey(k) ? colorForCategorySlice({ kind: "parent", value: k }, categorias) : "var(--color-ink-muted)");

  return (
    <div className="flex flex-col gap-4">
      {/* A capa: a foto da casa, o mês e os dois. O lápis leva às configurações do Nós dois. */}
      <div className="relative h-36 overflow-hidden rounded-3xl bg-surface-2" data-capa-casal>
        {/* eslint-disable-next-line @next/next/no-img-element -- banco de fotos do app */}
        <img src="/fotos/metas/casa.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
        <span className="absolute bottom-3 left-4 text-2xl font-medium [color:white]">{mesNome}</span>
        <span className="absolute bottom-3 right-14 flex -space-x-2">
          <Bolinha nome={d.nomes.A} cor={papel("A")} size={36} className="ring-2 ring-white" />
          <Bolinha nome={d.nomes.B} cor={papel("B")} size={36} className="ring-2 ring-white" />
        </span>
        <Link href="/configuracoes/nos-dois" aria-label="Trocar a foto e os nomes de vocês" className="absolute bottom-2.5 right-3 flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink">
          <Pencil size={15} aria-hidden />
        </Link>
      </div>
      <p className="-mt-1 flex items-center gap-1.5 px-1 text-sm text-ink-muted">
        <Users size={15} aria-hidden /> Os dois veem esta tela
      </p>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Ver por">
        {(["nos", "A", "B"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={lente === k} onClick={() => setLente(k)} className="flex min-h-10 items-center justify-center gap-1.5 truncate rounded-full px-2 text-sm text-ink-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm">
            {k !== "nos" && <Bolinha nome={d.nomes[k]} cor={papel(k)} size={20} />}
            <span className="truncate">{k === "nos" ? "Nós dois" : d.nomes[k]}</span>
          </button>
        ))}
      </div>
      <Link href="/divisao/lancamentos?busca=1" className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm text-ink-muted shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Search size={16} aria-hidden /> Procurar
      </Link>

      {heroi}
      {acerto}

      {lente === "nos" && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-baseline justify-between px-1 text-[15px] font-medium text-ink">
            Quem colocou na casa <small className="text-sm font-normal tabular-nums text-ink-muted">{m(d.totalDaCasa)}</small>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((q) => (
              <div key={q} className={`${CARTAO} flex items-center gap-2.5 p-3`}>
                <Bolinha nome={d.nomes[q]} cor={papel(q)} size={36} />
                <span className="min-w-0">
                  <b className="block truncate text-sm font-medium text-ink">{d.nomes[q]}</b>
                  <b className="block text-[15px] font-medium tabular-nums text-ink">{m(d.pagou[q])}</b>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {contas.length > 0 && (
        <section className="flex flex-col gap-2">
          <Link href="/divisao/contas" className="flex items-baseline justify-between px-1">
            <b className="text-[15px] font-medium text-ink">Contas do mês</b>
            <span className="flex items-center gap-0.5 text-sm text-ink-muted">
              {contas.length} {contas.length === 1 ? "conta" : "contas"} <ChevronRight size={14} aria-hidden />
            </span>
          </Link>
          <div className={`${CARTAO} grid grid-cols-3 gap-2 p-3`}>
            {contas.slice(0, 9).map((c) => {
              const quem: Letra = c.pagou.A >= c.pagou.B ? "A" : "B";
              return (
                <div key={c.chave} className="flex min-w-0 flex-col items-center gap-1 py-1 text-center">
                  <CategoryIcon icon={icone(c.parentCategory ?? "OUTROS")} color={cor(c.parentCategory ?? "OUTROS")} size={40} variant="soft" />
                  <b className="w-full truncate text-[13px] font-medium text-ink">{c.nome}</b>
                  <small className="flex items-center gap-1 text-xs tabular-nums text-ink-muted">
                    <Bolinha nome={d.nomes[quem]} cor={papel(quem)} size={14} />
                    {m(c.valor)}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cats.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-[15px] font-medium text-ink">
            Por categoria <small className="text-sm font-normal text-ink-muted">quem pagou</small>
          </h3>
          <div className={`${CARTAO} flex flex-col gap-3 p-4`}>
            {cats.map((c) => (
              <div key={c.k} className="flex items-center gap-3">
                <CategoryIcon icon={icone(c.k)} color={cor(c.k)} size={36} variant="soft" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <b className="truncate font-medium text-ink">{isParentCategoryKey(c.k) ? categoryLabel(categorias, c.k) : c.k}</b>
                    <em className="shrink-0 not-italic tabular-nums text-ink">{m(c.A + c.B)}</em>
                  </span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <i style={{ width: `${(c.A / maiorCat) * 100}%`, background: corDe("A") }} />
                    <i style={{ width: `${(c.B / maiorCat) * 100}%`, background: corDe("B") }} />
                  </span>
                </span>
              </div>
            ))}
            <div className="flex gap-4 text-xs text-ink-muted">
              {(["A", "B"] as const).map((q) => (
                <span key={q} className="flex items-center gap-1.5">
                  <i className="size-2 rounded-full" style={{ background: corDe(q) }} />
                  {d.nomes[q]} pagou
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-[15px] font-medium text-ink">
          De cada um <small className="text-sm font-normal text-ink-muted">fora do acerto</small>
        </h3>
        <div className={`${CARTAO} divide-y divide-border px-4`}>
          {(lente === "nos" ? (["A", "B"] as const) : [lente]).map((q) => {
            const gs = deCada(q);
            return (
              <Link key={q} href={`/divisao/lancamentos?quem=${q}`} className="flex items-center gap-3 py-3">
                <Bolinha nome={d.nomes[q]} cor={papel(q)} size={32} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-medium text-ink">De {d.nomes[q]}</b>
                  <small className="text-[13px] text-ink-muted">
                    {gs.length} {gs.length === 1 ? "gasto" : "gastos"}
                  </small>
                </span>
                <em className="shrink-0 not-italic tabular-nums text-ink">{m(gs.reduce((s, l) => s + l.valor, 0))}</em>
              </Link>
            );
          })}
          <p className="flex items-center gap-1.5 py-2.5 text-xs text-ink-muted">
            <ShieldCheck size={14} aria-hidden /> O que for &quot;só meu&quot; não aparece aqui
          </p>
        </div>
      </section>

      <Link href={lente === "nos" ? "/divisao/lancamentos" : `/divisao/lancamentos?quem=${lente}`} className={`${CARTAO} flex items-center justify-between px-4 py-3.5`} data-ver-lancamentos>
        <b className="text-[15px] font-medium text-ink">Lançamentos</b>
        <span className="flex items-center gap-1 text-sm text-ink-muted">
          {nLanc} em {mesNome.toLowerCase()} <ChevronRight size={14} aria-hidden />
        </span>
      </Link>

      {fechamento}
    </div>
  );
}
