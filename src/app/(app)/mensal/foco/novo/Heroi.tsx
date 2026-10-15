import Link from "next/link";
import { soPeloGuardado } from "./regras";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { NUMERO_DESTAQUE, ValorDestaque, separarPrefixo } from "@/components/ui/ValorDestaque";
import { MESES } from "../dados";
import type { HeroiDiaADia, HeroiDigitou, HeroiMesFechado, HeroiPrimeiraVez } from "./dados";
import { direcao, type Mes } from "./regras";

export type CorDoHeroi = "a" | "b" | "c";
type Money = (v: number) => string;

const nome = (m: Mes) => MESES[m.mes - 1];
const Nome = (m: Mes) => nome(m).charAt(0).toUpperCase() + nome(m).slice(1);
const dd = (n: number) => String(n).padStart(2, "0");

/**
 * O bloco principal do Resumo novo, em uma das 3 cores da comparação (só com ?resumo=novo):
 * (a) o cartão herói de hoje (HeroiDoTema), (b) cheio na cor de destaque do tema com texto claro,
 * (c) fundo neutro com o número na cor de destaque. As cores saem do tema (globals.css, .resumo-*).
 */
export function CaixaDoHeroi({ cor, children }: { cor: CorDoHeroi; children: ReactNode }) {
  const pintado =
    cor === "a"
      ? {
          background: "var(--heroi-fundo, linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para)))",
          boxShadow: "var(--cartao-fio, none)",
          color: "var(--color-heroi-tinta)",
          borderColor: "var(--color-heroi-borda, transparent)",
        }
      : undefined;
  return (
    <section className={`resumo-${cor} rounded-3xl border p-5`} style={pintado} data-resumo-cor={cor}>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Numero({ texto }: { texto: string }) {
  return (
    <span style={{ color: "var(--r-numero)" }}>
      <ValorDestaque texto={texto} className={`${NUMERO_DESTAQUE} !text-[2.75rem] max-[359px]:!text-[2.4rem]`} />
    </span>
  );
}

const Rotulo = ({ children }: { children: ReactNode }) => <p className="text-[15px] font-medium" style={{ color: "var(--r-suave)" }}>{children}</p>;
const Sub = ({ children }: { children: ReactNode }) => <p className="-mt-1 text-[14px] leading-snug" style={{ color: "var(--r-tinta)" }}>{children}</p>;

/* ---------------------------------------------------------------- dia a dia */

/** O acumulado do mês contra o mês passado (tracejado), na cor do tema. Sem eixo, sem grade. */
function Curva({ atual, passado, dias, mes, mesPassado }: { atual: number[]; passado: number[]; dias: number; mes: Mes; mesPassado: Mes }) {
  const W = 300;
  const H = 64;
  const topo = Math.max(1, ...atual, ...passado);
  const ponto = (v: number, i: number, n: number) => `${((i + 0.5) / n) * W},${H - 4 - (v / topo) * (H - 10)}`;
  const linha = (vs: number[], n: number) => vs.map((v, i) => ponto(v, i, n)).join(" ");
  const ultimo = atual.length > 0 ? ponto(atual[atual.length - 1], atual.length - 1, dias).split(",") : null;
  return (
    <div className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible" aria-hidden>
        <polyline points={linha(passado, passado.length)} fill="none" stroke="var(--r-linha)" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        <polyline points={linha(atual, dias)} fill="none" stroke="var(--r-linha)" strokeWidth={2.75} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {ultimo && <circle cx={ultimo[0]} cy={ultimo[1]} r={3.5} fill="var(--r-linha)" />}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]" style={{ color: "var(--r-suave)" }}>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-[3px] w-4 rounded-full" style={{ background: "var(--r-linha)" }} aria-hidden />
          {Nome(mes)}
        </span>
        {passado.length > 0 && <span className="inline-flex items-center gap-1.5">
          <i className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--r-linha)", opacity: 0.7 }} aria-hidden />
          {Nome(mesPassado)}, tracejado
        </span>}
      </div>
    </div>
  );
}

export function HeroiDoDiaADia({ h, mes, passado, money, cor, tocavel }: { h: HeroiDiaADia; mes: Mes; passado: Mes; money: Money; cor: CorDoHeroi; tocavel?: boolean }) {
  const c = h.comparacao;
  const d = direcao(c.diferenca);
  const quadrinho = (rotulo: string, valor: string, extra: ReactNode) => (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl px-3 py-2.5" style={{ background: "var(--r-veu)" }}>
      <span className="text-[12.5px] leading-tight" style={{ color: "var(--r-suave)" }}>{rotulo}</span>
      <b className="text-[17px] font-semibold tabular-nums" style={{ color: "var(--r-tinta)" }}>{valor}</b>
      <span className="text-[12.5px] leading-tight" style={{ color: "var(--r-suave)" }}>{extra}</span>
    </div>
  );
  const fp = h.ficouPassado;
  return (
    <CaixaDoHeroi cor={cor}>
      <Rotulo>
        <span className="flex items-center justify-between gap-2">
          <span>
            {Nome(mes)} até dia {c.corte}
          </span>
          {/* Tocar no cartão abre o que entrou no número (AbrirDetalhe). */}
          {tocavel && <ChevronRight size={18} className="shrink-0" aria-hidden />}
        </span>
      </Rotulo>
      <Numero texto={money(c.atual)} />
      <Sub>
        saíram.{" "}
        {h.passadoVazio ? (
          <>Nada em {nome(passado)} para comparar.</>
        ) : d === "igual" ? (
          <>O mesmo que {nome(passado)} até {dd(c.cortePassado)}/{dd(passado.mes)}.</>
        ) : (
          <>
            <b className="font-semibold">
              {money(Math.abs(c.diferenca))} a {d}
            </b>{" "}
            que {nome(passado)} até {dd(c.cortePassado)}/{dd(passado.mes)}.
          </>
        )}
      </Sub>
      <Curva atual={h.curvaAtual} passado={h.passadoVazio ? [] : h.curvaPassado} dias={h.diasDoMes} mes={mes} mesPassado={passado} />
      {(fp || h.guardadoNoAno) && (
        <div className="grid grid-cols-2 gap-2">
          {fp &&
            quadrinho(
              fp.valor >= 0 ? `Ficou com você em ${nome(passado)}` : soPeloGuardado(fp.valor, fp.guardou) ? `Em ${nome(passado)}, guardou além do que sobrou` : `Em ${nome(passado)}, saiu a mais`,
              money(Math.abs(fp.valor)),
              fp.contraRetrasado === null || Math.abs(fp.contraRetrasado) < 1 ? (
                " "
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  {fp.contraRetrasado > 0 ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />}
                  {money(Math.abs(fp.contraRetrasado))} {fp.contraRetrasado > 0 ? "melhor que" : "abaixo de"} {nome(mesAnteriorDe(passado))}
                </span>
              ),
            )}
          {h.guardadoNoAno && quadrinho(`Guardado em ${mes.ano}`, money(h.guardadoNoAno.valor), h.guardadoNoAno.pct !== null ? (h.guardadoNoAno.pct < 1 ? "menos de 1% do que entrou" : `${h.guardadoNoAno.pct}% do que entrou`) : " ")}
        </div>
      )}
    </CaixaDoHeroi>
  );
}

const mesAnteriorDe = (m: Mes): Mes => (m.mes === 1 ? { ano: m.ano - 1, mes: 12 } : { ano: m.ano, mes: m.mes - 1 });

/* ---------------------------------------------------------------- dias 1 a 7 */

export function HeroiDoMesFechado({ h, money, cor }: { h: HeroiMesFechado; money: Money; cor: CorDoHeroi }) {
  const faltou = h.ficou < 0;
  const anterior = mesAnteriorDe(h.mes);
  const topo = Math.max(1, ...h.barras.map((b) => Math.max(0, b.pct ?? 0)));
  return (
    <CaixaDoHeroi cor={cor}>
      <Rotulo>{faltou ? (soPeloGuardado(h.ficou, h.guardou) ? `Em ${nome(h.mes)}, guardou além do que sobrou` : `Em ${nome(h.mes)}, saiu a mais do que entrou`) : `Em ${nome(h.mes)}, ficou com você`}</Rotulo>
      <Numero texto={money(Math.abs(h.ficou))} />
      {h.pct !== null && !faltou && (
        <Sub>
          {h.pct}% do que entrou.{h.pctAnterior !== null ? ` Em ${nome(anterior)} ${h.pctAnterior >= 0 ? `foram ${h.pctAnterior}%` : "saiu mais do que entrou"}.` : ""}
        </Sub>
      )}
      {/* Saiu a mais: só o mês anterior, para comparar (14/10/2026). */}
      {faltou && h.pctAnterior !== null && <Sub>{h.pctAnterior < 0 ? `Em ${nome(anterior)} também.` : `Em ${nome(anterior)} ficaram ${h.pctAnterior}%.`}</Sub>}
      <div className="mt-1 grid grid-cols-6 items-end gap-2" aria-label="Quanto ficou com você nos últimos 6 meses">
        {h.barras.map((b, i) => {
          const ultimo = i === h.barras.length - 1;
          const alto = b.pct === null || b.pct <= 0 ? 4 : Math.max(6, Math.round((b.pct / topo) * 56));
          return (
            <div key={b.rotulo + i} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--r-tinta)" }}>
                {b.pct === null ? " " : b.pct < 0 ? "faltou" : `${b.pct}%`}
              </span>
              <i className="w-full rounded-md" style={{ height: alto, background: "var(--r-linha)", opacity: ultimo ? 1 : 0.45 }} aria-hidden />
              <span className="text-[12px]" style={{ color: "var(--r-suave)" }}>{b.rotulo}</span>
            </div>
          );
        })}
      </div>
    </CaixaDoHeroi>
  );
}

/* ---------------------------------------------------------------- primeira vez */

/** A barra empilhada do "para onde foi" (cor de cada categoria) e o pedaço que ficou. */
function Pilha({ partes }: { partes: { chave: string; valor: number; cor: string; nome: string }[] }) {
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0) || 1;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {partes.map((p) => (
          <i key={p.chave} style={{ flexGrow: Math.max(0, p.valor) / total, background: p.cor }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]" style={{ color: "var(--r-suave)" }}>
        {partes.map((p) => (
          <span key={p.chave} className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ background: p.cor }} aria-hidden />
            {p.nome}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HeroiDaPrimeiraVez({ h, money, cor }: { h: HeroiPrimeiraVez; money: Money; cor: CorDoHeroi }) {
  if (h.cartao) {
    const tres = h.paraOndeFoi;
    const resto = h.cartao.total - tres.reduce((s, p) => s + p.valor, 0);
    return (
      <CaixaDoHeroi cor={cor}>
        <Rotulo>Seu cartão em {nome(h.mes)}</Rotulo>
        <Numero texto={money(h.cartao.total)} />
        <Sub>
          Em <b className="font-semibold">{h.cartao.compras} {h.cartao.compras === 1 ? "compra" : "compras"}</b>. {tres.length > 0 ? `${tres.length === 1 ? "O maior gasto" : `Os ${tres.length} maiores gastos`}:` : ""}
        </Sub>
        {tres.length > 0 && (
          <Pilha
            partes={[
              ...tres.map((p) => ({ chave: p.chave, valor: p.valor, cor: p.cor, nome: `${p.nome} ${p.pct}%` })),
              ...(resto >= 1 ? [{ chave: "__resto", valor: resto, cor: "var(--r-veu)", nome: "O resto" }] : []),
            ]}
          />
        )}
      </CaixaDoHeroi>
    );
  }
  const faltou = h.ficou < 0;
  return (
    <CaixaDoHeroi cor={cor}>
      <Rotulo>{faltou ? (soPeloGuardado(h.ficou, h.entrou - h.saiu - h.ficou) ? `Em ${nome(h.mes)}, guardou além do que sobrou` : `Em ${nome(h.mes)}, saiu a mais do que entrou`) : `Em ${nome(h.mes)}, ficou com você`}</Rotulo>
      <Numero texto={money(Math.abs(h.ficou))} />
      {h.pct !== null && !faltou && (
        <Sub>
          {h.pct}% dos {money(h.entrou)} que entraram.
        </Sub>
      )}
      <Pilha
        partes={[
          ...(h.faturaUmGasto ? [{ chave: "__fatura", valor: h.faturaUmGasto, cor: "var(--color-cat-outros)", nome: "Fatura" }] : []),
          ...h.paraOndeFoi.map((p) => ({ chave: p.chave, valor: p.valor, cor: p.cor, nome: p.nome })),
          ...(h.ficou >= 1 ? [{ chave: "__ficou", valor: h.ficou, cor: "var(--r-linha)", nome: "Ficou" }] : []),
        ]}
      />
    </CaixaDoHeroi>
  );
}

export function HeroiDoDigitou({ h, mes, money, cor }: { h: HeroiDigitou; mes: Mes; money: Money; cor: CorDoHeroi }) {
  return (
    <CaixaDoHeroi cor={cor}>
      <Rotulo>{Nome(mes)} até agora</Rotulo>
      <Numero texto={money(h.total)} />
      <Sub>
        <b className="font-semibold">{h.n === 1 ? "1 gasto" : `${h.n} gastos`}</b>
        {h.ultimo ? `: ${h.n === 1 ? "" : "o último em "}${h.ultimo.nome}${h.ultimo.hoje ? ", hoje" : ""}.` : "."}
      </Sub>
    </CaixaDoHeroi>
  );
}

const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent";

export function HeroiDoNada({ passado, cor, enviar, money }: { passado: Mes; cor: CorDoHeroi; enviar: string; money: Money }) {
  const itens = ["o que entrou", "o que saiu", "para onde foi", "tarifas e parcelas"];
  return (
    <CaixaDoHeroi cor={cor}>
      <span style={{ color: "var(--r-numero)" }} className={`${NUMERO_DESTAQUE} !text-[2.75rem]`}>
        <span className="mr-[0.14em] text-[0.48em] font-normal opacity-75">{separarPrefixo(money(0))[0]}</span>?
      </span>
      <p className="text-[1.15rem] font-semibold leading-snug" style={{ color: "var(--r-tinta)" }}>
        Quanto ficou com você em {nome(passado)}?
      </p>
      <p className="text-[14px]" style={{ color: "var(--r-suave)" }}>
        Mande o extrato de um mês. Em 1 minuto aparece:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <span key={i} className="rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: "var(--r-veu)", color: "var(--r-tinta)" }}>
            {i}
          </span>
        ))}
      </div>
      <Link href={enviar} className={`${BOTAO} mt-1`}>
        Enviar extrato
      </Link>
      <div className="flex flex-wrap justify-center gap-x-5">
        <Link href={enviar} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" style={{ color: "var(--r-tinta)" }}>
          Só tenho a fatura do cartão
        </Link>
        <Link href="/comecar?passo=digitar" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" style={{ color: "var(--r-tinta)" }}>
          Anotar um gasto
        </Link>
      </div>
    </CaixaDoHeroi>
  );
}

