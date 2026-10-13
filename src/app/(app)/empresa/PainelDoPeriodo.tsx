"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ParentCategory } from "@prisma/client";
import { ChevronRight, Tag, Users } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel } from "@/lib/categories";
import { MESES, MESES_CURTOS } from "@/lib/empresa/resumo";
import { hrefDaLista, hrefDoPeriodo, noPeriodoTexto, primeiroDia, ultimoDia, type Grupo, type PeriodoDaEmpresa, type ResumoDoPeriodo } from "@/lib/empresa/periodo";
import { Cartao, Iniciais } from "./partes";

const sinal = (m0: (v: number) => string, v: number) => (v < 0 ? `−${m0(-v)}` : m0(v));

/** Uma linha que abre a lista: rótulo, valor e a setinha. */
export function LinhaQueAbre({ href, rotulo, valor, forte = false, cor }: { href: string; rotulo: ReactNode; valor: string; forte?: boolean; cor?: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-2 text-[15px] text-ink">
      {cor && <i className="size-2.5 shrink-0 rounded-full" style={{ background: cor }} aria-hidden />}
      <span className={`min-w-0 flex-1 ${forte ? "font-medium" : ""}`}>{rotulo}</span>
      <b className={`shrink-0 tabular-nums ${forte ? "font-semibold" : "font-normal"}`}>{valor}</b>
      <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}

/**
 * O período inteiro numa tela (Este ano, Últimos 12 meses, Escolher datas): no topo, quanto
 * entrou, o lucro e o salário dela ("quanto eu ganhei no ano"); os totais que abrem a lista
 * editável; o mês a mês; os maiores clientes e as maiores despesas por categoria da Empresa.
 */
export function PainelDoPeriodo({
  r,
  periodo,
  hoje,
  ehMei,
  custom,
  caminho,
  manter = {},
}: {
  r: ResumoDoPeriodo;
  periodo: PeriodoDaEmpresa;
  hoje: string;
  ehMei: boolean;
  custom: Record<string, { nome: string; icone: string }>;
  /** A tela onde o painel está: tocar num mês do gráfico abre aquele mês nela. */
  caminho: string;
  manter?: Record<string, string>;
}) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const { categorias } = useProfileTheme();
  const quando = noPeriodoTexto(periodo, hoje);
  const lista = (g: Grupo) => hrefDaLista(periodo, g, caminho === "/empresa" ? undefined : caminho);
  const vazio = r.nLancamentos === 0;

  return (
    <>
      <HeroiDoTema>
        <p className="text-sm text-heroi-suave">Quanto você ganhou {quando}</p>
        <Link href={lista("entradas")} className="flex flex-col gap-0.5" data-ganhou>
          <ValorDestaque texto={m0(r.recibo.entrou)} />
          <small className="text-xs text-heroi-suave">
            faturou{r.recibo.nVendas > 0 ? `, ${r.recibo.nVendas} ${r.recibo.nVendas === 1 ? "venda" : "vendas"}` : ""}
          </small>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href={lista("lucro")} className="heroi-veu min-w-0 rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Lucro</small>
            <ValorDestaque texto={sinal(m0, r.recibo.sobrou)} className="text-lg font-medium tabular-nums" />
          </Link>
          <Link href={lista("prolabore")} className="heroi-veu min-w-0 rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Seu salário</small>
            <ValorDestaque texto={m0(r.proLabore)} className="text-lg font-medium tabular-nums" />
          </Link>
        </div>
      </HeroiDoTema>

      {vazio ? (
        <Cartao className="px-6 py-8 text-center text-sm text-ink-muted">Nenhum lançamento {quando}.</Cartao>
      ) : (
        <>
          <Cartao className="divide-y divide-border px-4" data-totais>
            <LinhaQueAbre href={lista("entradas")} rotulo="Entrou" valor={m0(r.recibo.entrou)} cor="var(--color-accent)" />
            {/* As despesas abertas como no recibo: a conta fecha de cima para baixo. */}
            <LinhaQueAbre href={lista("variaveis")} rotulo="Insumos e entregas" valor={`−${m0(r.recibo.variaveis)}`} cor="var(--color-danger)" />
            <LinhaQueAbre href={lista("fixas")} rotulo="Contas" valor={`−${m0(r.recibo.fixas)}`} cor="var(--color-atencao)" />
            <LinhaQueAbre href={lista("impostos")} rotulo={ehMei ? "Guia do MEI" : "Impostos"} valor={`−${m0(r.recibo.impostos)}`} cor="var(--color-info)" />
            <LinhaQueAbre href={lista("lucro")} rotulo="Lucro" valor={sinal(m0, r.recibo.sobrou)} forte cor="var(--color-success)" />
            <LinhaQueAbre href={lista("prolabore")} rotulo="Seu salário" valor={`−${m0(r.proLabore)}`} />
            <LinhaQueAbre href={lista("lucro")} rotulo="Ficou na empresa" valor={sinal(m0, r.ficou)} forte />
          </Cartao>

          {r.meses.length > 1 && <MesAMes r={r} m0={m0} caminho={caminho} manter={manter} />}

          {(r.clientes.length > 0 || r.semNome.valor > 0) && (
            <Cartao className="flex flex-col p-4" >
              <p className="mb-1 text-sm text-ink-muted">Maiores clientes</p>
              {(() => {
                const top = r.clientes.slice(0, 5);
                const maior = Math.max(1, ...top.map((c) => c.valor), r.semNome.valor);
                return (
                  <>
                    {top.map((c) => (
                      <Barra key={c.nome} href={lista(`cliente:${c.nome}`)} icone={<Iniciais nome={c.nome} />} nome={c.nome} valor={m0(c.valor)} pct={c.valor / maior} cor="var(--color-accent)" />
                    ))}
                    {r.semNome.valor > 0 && (
                      <Barra
                        href={lista("cliente:")}
                        icone={<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong"><Users size={16} aria-hidden /></span>}
                        nome="Balcão e sem nome"
                        valor={m0(r.semNome.valor)}
                        pct={r.semNome.valor / maior}
                        cor="var(--color-accent)"
                      />
                    )}
                  </>
                );
              })()}
            </Cartao>
          )}

          {r.categorias.length > 0 && (
            <Cartao className="flex flex-col p-4">
              <p className="mb-1 text-sm text-ink-muted">Maiores despesas</p>
              {r.categorias.slice(0, 6).map((c) => {
                const nome = c.custom ? (custom[c.custom]?.nome ?? "Outra") : categoryLabel(categorias, (c.parent ?? "OUTROS") as ParentCategory);
                const Icone = c.custom ? (CUSTOM_CATEGORY_ICON_MAP[custom[c.custom]?.icone ?? ""] ?? Tag) : categoryIcon(categorias, (c.parent ?? "OUTROS") as ParentCategory);
                return (
                  <Barra
                    key={c.chave}
                    href={lista(`cat:${c.chave}`)}
                    icone={<LogoDoLancamento descricao={null} icon={Icone} size={40} />}
                    nome={nome}
                    sub={`${c.n} ${c.n === 1 ? "lançamento" : "lançamentos"}`}
                    valor={m0(c.valor)}
                    pct={c.valor / Math.max(1, r.categorias[0].valor)}
                    cor="var(--color-danger)"
                  />
                );
              })}
            </Cartao>
          )}
        </>
      )}
    </>
  );
}

function Barra({ href, icone, nome, sub, valor, pct, cor }: { href: string; icone: ReactNode; nome: string; sub?: string; valor: string; pct: number; cor: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 py-1.5">
      {icone}
      <span className="min-w-0 flex-1">
        <b className="block break-words text-[15px] font-medium leading-snug text-ink">{nome}</b>
        {sub && <small className="block text-xs text-ink-muted">{sub}</small>}
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
          <i className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%`, background: cor }} />
        </span>
      </span>
      <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{valor}</b>
      <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}

/** O mês a mês: o que entrou (coluna) e o lucro (coluna verde) de cada mês. Tocar abre o mês. */
function MesAMes({ r, m0, caminho, manter }: { r: ResumoDoPeriodo; m0: (v: number) => string; caminho: string; manter: Record<string, string> }) {
  const max = Math.max(1, ...r.meses.map((z) => Math.max(z.entrou, z.sobrou)));
  const muitos = r.meses.length > 12;
  return (
    <Cartao className="flex flex-col gap-3 p-4" >
      <p className="text-sm text-ink-muted">Mês a mês</p>
      <div className="flex h-36 items-end gap-1" data-mes-a-mes>
        {r.meses.map((z) => (
          <Link
            key={`${z.m.ano}-${z.m.mes}`}
            href={hrefDoPeriodo(caminho, `de=${primeiroDia(z.m)}&ate=${ultimoDia(z.m)}`, manter)}
            aria-label={`${MESES[z.m.mes - 1]} de ${z.m.ano}${z.parcial ? ", até hoje" : ""}: entrou ${m0(z.entrou)}, lucro ${z.sobrou < 0 ? "−" : ""}${m0(Math.abs(z.sobrou))}`}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-px"
          >
            <i
              className="block w-1/2 max-w-4 rounded-t-md"
              style={{
                height: `${Math.max(2, (z.entrou / max) * 100)}%`,
                background: z.parcial ? "repeating-linear-gradient(135deg, var(--color-accent) 0 4px, color-mix(in srgb, var(--color-accent) 45%, transparent) 4px 8px)" : "var(--color-accent)",
              }}
            />
            <i className="block w-1/2 max-w-4 rounded-t-md" style={{ height: `${Math.max(2, (Math.abs(z.sobrou) / max) * 100)}%`, background: z.sobrou < 0 ? "var(--color-danger)" : "var(--color-success)" }} />
          </Link>
        ))}
      </div>
      <div className="flex gap-1">
        {r.meses.map((z, i) => (
          <small key={`${z.m.ano}-${z.m.mes}`} className="min-w-0 flex-1 text-center text-xs text-ink-muted">
            {muitos ? (i % 3 === 0 ? MESES_CURTOS[z.m.mes - 1][0].toUpperCase() : "") : r.meses.length > 6 ? MESES_CURTOS[z.m.mes - 1][0].toUpperCase() : MESES_CURTOS[z.m.mes - 1]}
          </small>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />entrou</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-success" />lucro</span>
        {r.meses.some((z) => z.parcial) && <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--color-accent)_0_2px,transparent_2px_4px)]" />até hoje</span>}
      </div>
    </Cartao>
  );
}
