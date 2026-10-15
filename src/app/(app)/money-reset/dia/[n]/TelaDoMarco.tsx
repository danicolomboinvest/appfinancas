"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ParentCategory } from "@prisma/client";
import {
  Banknote,
  Bus,
  CalendarDays,
  CalendarRange,
  Check,
  CookingPot,
  LifeBuoy,
  ListChecks,
  Plane,
  Plus,
  Receipt,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ComoTirarExtrato } from "@/components/import/ComoTirarExtrato";
import { EVENTO_REGISTRAR } from "@/components/shell/registrar-eventos";
import { iniciarGuia } from "@/components/money-reset/guia-estado";
import { IconeDoMarco } from "@/components/money-reset/IconeDoMarco";
import { Placar } from "@/components/money-reset/Placar";
import { FileiraDeMarcas, LogoDoGasto, LogosDeExemplo } from "@/components/money-reset/Marcas";
import { comecoDoGuia } from "@/lib/money-reset/guias";
import { DICAS_DA_SEMANA, MOTIVOS_PRONTOS, PASSOS_DO_SONHO, REGRAS_DO_CARTAO, marco, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { EXEMPLOS } from "@/lib/money-reset/marcas-do-reset";
import { PARENT_CATEGORY_COLOR, PARENT_CATEGORY_ICON } from "@/lib/categories";
import { economiaAnual, type EscolhaDoRaioX } from "@/lib/decisoes/raio-x";
import { decidirRaioXAction, definirTetoAction, escolherRitmoAction } from "@/app/(app)/mensal/foco/actions";
import { celebrar, vibrar } from "@/lib/celebrar";
import { concluirMarcoAction, salvarRespostaAction } from "../../actions";
import type { DadosDoMarco } from "../../dados";
import type { Respostas } from "./Missao";
import { textoDaMedia } from "@/lib/planning/renda-media";

const pct = (v: number) => `${Math.round(v * 100)}%`;

type Comum = { n: number; respostas: Respostas; feita: boolean; admin: boolean; achei: number; hoje: string; amanha: string; concluir: (fn?: () => Promise<unknown>) => void; salvando: boolean };

function Botao({ children, onClick, disabled, secundario }: { children: ReactNode; onClick: () => void; disabled?: boolean; secundario?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold disabled:opacity-45 ${
        secundario ? "border border-border-strong text-ink" : "bg-accent-gradient text-on-accent shadow-premium-sm"
      }`}
    >
      {children}
    </button>
  );
}

function Opcao({ icone: Icone, titulo, sub, marcada, onClick }: { icone: LucideIcon; titulo: string; sub?: string; marcada: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left ${marcada ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${marcada ? "bg-surface text-accent-strong" : "bg-surface-2 text-ink-muted"}`}>
        <Icone size={19} strokeWidth={1.9} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{titulo}</span>
        {sub && <span className="block text-[13px] text-ink-muted">{sub}</span>}
      </span>
      {marcada && <Check size={18} className="shrink-0 text-accent-strong" aria-hidden />}
    </button>
  );
}

function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass flex flex-col gap-3 rounded-2xl p-4 ${className}`}>{children}</div>;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{children}</p>;
}

/** Uma barra: verde até a régua, cor do tema quando passa (nunca o vermelho de alarme). */
function Barra({ valor, regua, cor }: { valor: number; regua?: number; cor?: string }) {
  const passou = regua !== undefined && valor > regua;
  return (
    <div className="relative h-3 rounded-full bg-surface-2">
      <div className={`h-3 rounded-full transition-[width] duration-700 ${cor ? "" : passou ? "bg-accent" : "bg-success"}`} style={{ width: `${Math.max(2, Math.min(100, valor * 100))}%`, backgroundColor: cor }} />
      {regua !== undefined && <span className="absolute -top-1 h-5 w-0.5 rounded bg-ink" style={{ left: `${Math.min(100, regua * 100)}%` }} aria-hidden />}
    </div>
  );
}

function Ajuda({ n }: { n: number }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const v = vocabularioDaVoz(voz);
  const m = marco(n)!;
  return (
    <details className="rounded-2xl border border-border bg-surface px-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-muted">{t.mrAjuda}</summary>
      <div className="flex flex-col gap-3 pb-4">
        <ol className="flex flex-col gap-1.5">
          {m.passos.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-bold text-ink-muted">{i + 1}</span>
              {naVoz(p, v)}
            </li>
          ))}
        </ol>
        {m.travou && (
          <p className="text-sm text-ink-muted">
            <b className="text-ink">{t.mrTravou}</b> {naVoz(m.travou, v)}
          </p>
        )}
        {(n === 1 || n === 2 || n === 20) && <ComoTirarExtrato />}
      </div>
    </details>
  );
}

/**
 * O botão que liga o guia iluminado nas telas de verdade. O guia que começa pelo "+" já abre a
 * gaveta (o "+" só existe na Visão geral; aqui o balão apontaria para o nada).
 */
function Guiar({ n, secundario, children }: { n: number; secundario?: boolean; children?: ReactNode }) {
  const { voz } = useProfileTheme();
  const comecar = () => {
    const { passo, abrirRegistrar: abrir } = comecoDoGuia(n);
    if (abrir) abrirRegistrar("choice");
    iniciarGuia(n, passo);
  };
  return (
    <Botao secundario={secundario} onClick={comecar}>
      {children ?? voz.titulos.mrGuiar}
    </Botao>
  );
}

/** A Dani pode marcar uma missão automática sem fazer (para conferir o programa). */
function MarcarAdmin({ c }: { c: Comum }) {
  if (!c.admin || c.feita) return null;
  return (
    <button type="button" onClick={() => c.concluir()} disabled={c.salvando} className="min-h-11 text-caption font-semibold text-ink-faint underline-offset-2 hover:underline">
      Marcar como feita (admin)
    </button>
  );
}

/** O desenho grande das missões que acontecem em outra tela do app. */
function Desenho({ n, children }: { n: number; children?: ReactNode }) {
  const m = marco(n)!;
  return (
    <HeroiDoTema className="items-center text-center">
      <div className="flex flex-col items-center gap-3 py-2">
        <span className="heroi-veu flex size-20 items-center justify-center rounded-[28px]">
          <IconeDoMarco icone={m.icone} size={36} strokeWidth={1.6} />
        </span>
        {children}
      </div>
    </HeroiDoTema>
  );
}

const abrirRegistrar = (modo: string) => window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, { detail: { modo } }));

// ===== 1 · Traga seus gastos (o extrato e o retrato na hora) =====
function M1({ d, c }: { d: Extract<DadosDoMarco, { n: 1 }>; c: Comum }) {
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  if (d.meses === 0) {
    return (
      <>
        <LogosDeExemplo nomes={EXEMPLOS.bancos} legenda="o extrato de qualquer banco" />
        <Guiar n={1}>Trazer meu extrato</Guiar>
        <Ajuda n={1} />
        <MarcarAdmin c={c} />
      </>
    );
  }
  const usa = d.entra > 0 ? d.sai / d.entra : null;
  const maior = Math.max(d.entra, d.sai, 1);
  return (
    <>
      <Cartao>
        <p className="text-[13px] text-ink-muted">Seu retrato por mês</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-[15px]">
            <span className="text-ink-muted">Entra{d.entra > 0 && d.entraMeses > 0 ? <small className="text-[13px]"> · {textoDaMedia(d.entraMeses)}</small> : null}</span>
            <b className="tabular-nums text-ink">{d.entra > 0 ? m(d.entra) : "falta a renda"}</b>
          </div>
          <Barra valor={d.entra / maior} cor="var(--color-success)" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-[15px]">
            <span className="text-ink-muted">Sai<small className="text-[13px]"> · {textoDaMedia(d.meses)}</small></span>
            <b className="tabular-nums text-ink">{m(d.sai)}</b>
          </div>
          <Barra valor={d.sai / maior} cor="var(--color-accent)" />
        </div>
        {usa !== null && (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-[26px] font-bold tabular-nums leading-none text-ink">{pct(usa)}</span>
            <span className="text-[13px] leading-snug text-ink-muted">{usa <= 0.9 ? "do que entra já sai. Dentro da régua dos 90%." : `do que entra já sai. A régua da aula é 90%: faltam ${m(d.sai - d.entra * 0.9)} por mês.`}</span>
          </div>
        )}
      </Cartao>
      {d.marcas.length > 0 && (
        <>
          <Rotulo>Para onde mais foi</Rotulo>
          <FileiraDeMarcas marcas={d.marcas} />
        </>
      )}
      <Botao secundario onClick={() => abrirRegistrar("digitar")}>
        <Plus size={16} aria-hidden /> Entra algo fora da conta? (VR, VA)
      </Botao>
      {!c.feita && (
        <Botao disabled={c.salvando} onClick={() => c.concluir()}>
          Pronto, vi meu retrato
        </Botao>
      )}
    </>
  );
}

// ===== 2 · A fatura do cartão =====
function M2({ d, c }: { d: Extract<DadosDoMarco, { n: 2 }>; c: Comum }) {
  const money = useMoney();
  if (!d.fatura) {
    return (
      <>
        <LogosDeExemplo nomes={["Nubank", "Itaú", "Banco Inter", "C6 Bank", "Banco do Brasil"]} legenda="a fatura de qualquer cartão" />
        <Guiar n={2}>Trazer minha fatura</Guiar>
        {!c.feita && (
          <Botao secundario disabled={c.salvando} onClick={() => c.concluir(() => salvarRespostaAction("fatura", "sem cartao", undefined, 2))}>
            Não uso cartão de crédito
          </Botao>
        )}
        <Ajuda n={2} />
      </>
    );
  }
  return (
    <>
      <HeroiDoTema>
        <small className="text-[13px] font-semibold text-heroi-suave">Sua última fatura</small>
        <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{money(d.fatura.total, { round: true })}</span>
        {d.parcelasFuturas > 0 && <small className="text-[13px] text-heroi-suave">{d.parcelasFuturas === 1 ? "1 parcela" : `${d.parcelasFuturas} parcelas`} já no mês que vem</small>}
      </HeroiDoTema>
      {d.fatura.marcas.length > 0 && (
        <>
          <Rotulo>O que mais pesou nela</Rotulo>
          <FileiraDeMarcas marcas={d.fatura.marcas} rotulo="na fatura" />
        </>
      )}
      {!c.feita && (
        <Botao disabled={c.salvando} onClick={() => c.concluir()}>
          Pronto
        </Botao>
      )}
      <Guiar n={2} secundario>
        Trazer outra fatura
      </Guiar>
    </>
  );
}

// ===== 3 · Os pequenos que viram grandes (o Raio-X aqui mesmo, com o placar) =====
function M3({ d, c }: { d: Extract<DadosDoMarco, { n: 3 }>; c: Comum }) {
  const money = useMoney();
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaDoRaioX>>(d.decididos);
  const [, startTransition] = useTransition();
  const mensal = (e: Record<string, EscolhaDoRaioX | undefined>) => d.itens.reduce((s, i) => s + (e[i.chave] ? economiaAnual(i, e[i.chave]!) : 0), 0) / 12;
  // O placar de fora já conta o que estava gravado; aqui troca isso pelo que ela está decidindo agora.
  const placar = Math.max(0, c.achei - mensal(d.decididos) + mensal(escolhas));
  const precisa = Math.min(3, d.itens.length);
  const feitas = d.itens.filter((i) => escolhas[i.chave]).length;

  if (d.itens.length === 0) {
    return (
      <>
        <Placar porMes={c.achei} />
        <LogosDeExemplo nomes={EXEMPLOS.streaming} legenda="o que costuma se repetir" />
        <p className="px-1 text-[14px] text-ink-muted">Com 3 meses de extrato eu acho as suas.</p>
        <Guiar n={1}>Trazer mais meses</Guiar>
        {!c.feita && (
          <Botao secundario disabled={c.salvando} onClick={() => c.concluir()}>
            Seguir mesmo assim
          </Botao>
        )}
      </>
    );
  }

  const decidir = (item: (typeof d.itens)[number], e: EscolhaDoRaioX) => {
    vibrar("leve");
    setEscolhas((x) => ({ ...x, [item.chave]: e }));
    startTransition(() => decidirRaioXAction({ chave: item.chave, nome: item.nome.slice(0, 80), decisao: e, economiaAnual: economiaAnual(item, e) }));
  };
  const OPCOES: [EscolhaDoRaioX, string][] = [
    ["raiox_manter", "Manter"],
    ["raiox_metade", "Metade"],
    ["raiox_cancelar", "Cortar"],
  ];
  return (
    <>
      <Placar porMes={placar} />
      <p className="px-1 text-[14px] text-ink-muted">O que se repete no seu extrato. Para cada um, você decide.</p>
      <ul className="flex flex-col gap-2">
        {d.itens.map((i) => (
          <li key={i.chave} className="glass flex flex-col gap-2.5 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <LogoDoGasto descricao={i.nome} categoria={i.tipo === "habito" ? "ALIMENTACAO" : "LAZER"} size={44} />
              <span className="min-w-0 flex-1">
                <b className="block break-words leading-snug text-[15px] font-semibold text-ink">{i.nome}</b>
                <small className="block text-[12px] text-ink-muted">{i.tipo === "habito" && i.vezesPorMes >= 1.5 ? `${Math.round(i.vezesPorMes)} vezes por mês` : `todo mês, há ${i.meses} meses`}</small>
              </span>
              <span className="shrink-0 text-right">
                <b className="block text-[15px] tabular-nums text-ink">{money(i.mensal, { round: true })}</b>
                <small className="block text-[12px] tabular-nums text-ink-muted">{money(i.anual, { round: true })} no ano</small>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {OPCOES.map(([e, rotulo]) => {
                const marcada = escolhas[i.chave] === e;
                return (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => decidir(i, e)}
                    className={`min-h-11 rounded-xl border text-[14px] font-semibold ${marcada ? (e === "raiox_manter" ? "border-success bg-success-soft text-success" : "border-accent bg-accent-soft text-accent-strong") : "border-border text-ink"}`}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {!c.feita ? (
        <Botao disabled={c.salvando || feitas < precisa} onClick={() => c.concluir()}>
          {feitas < precisa ? `Decide ${precisa === 1 ? "o primeiro" : `os ${precisa} primeiros`}` : "Ver o que eu achei"}
        </Botao>
      ) : null}
    </>
  );
}

// ===== 4 · O que já tem dono (contas fixas, 1 para negociar e quanto baixou) =====
function M4({ d, c }: { d: Extract<DadosDoMarco, { n: 4 }>; c: Comum }) {
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const salvo = c.respostas.fixas?.dados as { naoFixas?: string[]; negociar?: string | null; baixou?: number } | null | undefined;
  const [naoFixas, setNaoFixas] = useState<string[]>(salvo?.naoFixas ?? []);
  const [negociar, setNegociar] = useState<string | null>(d.fixas.find((f) => f.nome === salvo?.negociar)?.chave ?? null);
  const [baixou, setBaixou] = useState<number | null>(salvo?.baixou ?? null);
  const fixas = d.fixas.filter((f) => !naoFixas.includes(f.chave));
  const total = fixas.reduce((s, f) => s + f.mensal, 0) + d.parcelas;
  const valorBaixou = Math.max(0, baixou ?? 0);
  const placar = Math.max(0, c.achei - (salvo?.baixou ?? 0) + valorBaixou);

  return (
    <>
      <Placar porMes={placar} />
      {d.fixas.length === 0 && d.parcelas === 0 ? (
        <>
          <LogosDeExemplo nomes={EXEMPLOS.contas} legenda="contas que chegam todo mês" />
          <p className="px-1 text-[14px] text-ink-muted">Com 3 meses de extrato a lista aparece sozinha.</p>
        </>
      ) : (
        <>
          <HeroiDoTema>
            <small className="text-[13px] font-semibold text-heroi-suave">Já tem dono todo mês</small>
            <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{m(total)}</span>
          </HeroiDoTema>
          <ul className="glass divide-y divide-border rounded-2xl">
            {d.fixas.map((f) => {
              const tirada = naoFixas.includes(f.chave);
              const marcada = negociar === f.chave;
              return (
                <li key={f.chave} className={`flex items-center gap-2.5 px-3 py-2 ${tirada ? "opacity-45" : ""}`}>
                  <LogoDoGasto descricao={f.nome} size={36} />
                  <span className="min-w-0 flex-1">
                    <b className="block break-words text-[14px] font-semibold leading-snug text-ink">{f.nome}</b>
                    <small className="block text-[12px] tabular-nums text-ink-muted">{m(f.mensal)} por mês</small>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    {!tirada && (
                      <button type="button" aria-pressed={marcada} onClick={() => setNegociar(marcada ? null : f.chave)} className={`min-h-9 rounded-full px-3 text-[12px] font-semibold ${marcada ? "bg-accent-soft text-accent-strong" : "border border-border text-accent-strong"}`}>
                        Negociar
                      </button>
                    )}
                    <button type="button" onClick={() => setNaoFixas((x) => (tirada ? x.filter((k) => k !== f.chave) : [...x, f.chave]))} className="min-h-9 px-1 text-[12px] font-semibold text-ink-muted">
                      {tirada ? "É fixa" : "Não é fixa"}
                    </button>
                  </span>
                </li>
              );
            })}
            {d.parcelas > 0 && (
              <li className="flex items-center gap-2.5 px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted">
                  <ReceiptText size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-ink">Parcelas do mês que vem</span>
                <span className="text-[14px] tabular-nums text-ink">{m(d.parcelas)}</span>
              </li>
            )}
          </ul>
        </>
      )}
      {negociar && (
        <Cartao className="mr-entra">
          <p className="text-[14px] text-ink">Ligue ou abra o chat da empresa. Diga que está revendo as contas e pergunte por um plano mais barato.</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-muted">Já negociou? Quanto baixou por mês</span>
            <CampoDeDinheiro valor={baixou} onValor={setBaixou} placeholder="0,00" aria-label="Quanto baixou por mês" className="min-h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-[15px] tabular-nums text-ink focus:border-accent focus:outline-none" />
          </label>
        </Cartao>
      )}
      <Botao
        disabled={c.salvando}
        onClick={() => c.concluir(() => salvarRespostaAction("fixas", String(Math.round(total)), { total, naoFixas, negociar: d.fixas.find((f) => f.chave === negociar)?.nome ?? null, baixou: valorBaixou }, c.feita ? undefined : 4))}
      >
        {c.feita ? "Salvar" : total > 0 ? `Confirmar · ${m(total)}/mês` : "Confirmar"}
      </Botao>
    </>
  );
}

// ===== 5 · Onde o dinheiro escapa (teto na categoria que mais passa) =====
const ICONES_DAS_DICAS: Record<string, LucideIcon> = { cardapio: CalendarDays, lista: ListChecks, marmita: CookingPot };

function M5({ d, c }: { d: Extract<DadosDoMarco, { n: 5 }>; c: Comum }) {
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const [teto, setTeto] = useState<number | null>(null);
  const [tetoSalvo, setTetoSalvo] = useState(false);
  const [dica, setDica] = useState<string | null>(c.respostas.dica?.texto || null);
  const [salvandoTeto, startTransition] = useTransition();
  const pior = d.categorias.find((x) => x.cat === d.pior) ?? null;
  const valorTeto = teto ?? (pior ? Math.round(pior.regua * d.renda) : 0);
  const escala = Math.max(0.4, ...d.categorias.map((x) => Math.max(x.voce, x.regua) * 1.15));
  const temDado = d.renda > 0 && d.categorias.some((x) => x.valor > 0);

  return (
    <>
      {temDado ? (
        <Cartao>
          <p className="text-[13px] text-ink-muted">Você contra a régua da aula, em % da renda</p>
          {d.categorias.map((x) => {
            const Icone = PARENT_CATEGORY_ICON[x.cat as ParentCategory];
            return (
              <div key={x.cat} className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${PARENT_CATEGORY_COLOR[x.cat as ParentCategory]} 16%, transparent)`, color: PARENT_CATEGORY_COLOR[x.cat as ParentCategory] }}>
                  <Icone size={15} strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-[13px]">
                    <span className="break-words leading-snug font-semibold text-ink">{x.nome}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">
                      {pct(x.voce)} <span className="text-ink-faint">/ {pct(x.regua)}</span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <Barra valor={x.voce / escala} regua={x.regua / escala} />
                  </div>
                </div>
              </div>
            );
          })}
        </Cartao>
      ) : (
        <p className="px-1 text-[14px] text-ink-muted">Com o extrato e a renda no app, eu mostro onde escapa. Por agora, uma dica para a semana.</p>
      )}
      {pior && !tetoSalvo && !c.feita && (
        <Cartao className="mr-entra">
          <p className="text-[15px] font-semibold text-ink">
            {pior.nome}: {m(pior.valor)} por mês
          </p>
          {d.marcasDaPior.length > 0 && <FileiraDeMarcas marcas={d.marcasDaPior} vezes />}
          <p className="text-[13px] text-ink-muted">Ponha um teto até o fim do mês.</p>
          <div className="flex flex-wrap gap-2">
            {[valorTeto, Math.round(valorTeto * 0.8), Math.round(pior.valor * 0.9)]
              .filter((x, i, a) => x > 0 && a.indexOf(x) === i)
              .map((x) => (
                <button key={x} type="button" aria-pressed={valorTeto === x} onClick={() => setTeto(x)} className={`min-h-11 rounded-full border px-4 text-[14px] font-semibold tabular-nums ${valorTeto === x ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-ink"}`}>
                  {m(x)}
                </button>
              ))}
          </div>
          <Botao
            disabled={salvandoTeto || valorTeto <= 0}
            onClick={() =>
              startTransition(async () => {
                await definirTetoAction({ categoria: pior.cat, valor: valorTeto });
                vibrar("sucesso");
                setTetoSalvo(true);
              })
            }
          >
            Pôr o teto de {m(valorTeto)}
          </Botao>
        </Cartao>
      )}
      {(tetoSalvo || !pior || c.feita) && (
        <>
          <Rotulo>Uma dica para esta semana</Rotulo>
          {DICAS_DA_SEMANA.map((x) => (
            <Opcao key={x.chave} icone={ICONES_DAS_DICAS[x.chave]} titulo={x.t} sub={x.sub} marcada={dica === x.chave} onClick={() => setDica(x.chave)} />
          ))}
          <Botao disabled={c.salvando || !dica} onClick={() => c.concluir(() => salvarRespostaAction("dica", dica!, undefined, c.feita ? undefined : 5))}>
            Combinado
          </Botao>
        </>
      )}
    </>
  );
}

// ===== 6 · O que não passa pelo extrato (lançar falando) =====
function M6({ c }: { c: Comum }) {
  return (
    <>
      <Desenho n={6}>
        <p className="text-[13px] font-semibold text-heroi-suave">Fale assim, por exemplo</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {["pão, 12 reais, dinheiro", "feira, 40 reais, pix", "café, 8 reais"].map((f) => (
            <span key={f} className="heroi-veu rounded-full px-3 py-1.5 text-[13px] font-semibold">
              &ldquo;{f}&rdquo;
            </span>
          ))}
        </div>
      </Desenho>
      <Guiar n={6} />
      <Ajuda n={6} />
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 7 · Seu motivo =====
function M7({ d, c }: { d: Extract<DadosDoMarco, { n: 7 }>; c: Comum }) {
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const [motivo, setMotivo] = useState(c.respostas.motivo?.texto ?? "");
  const chips: [string, string][] = [["Sai por mês", m(d.sai)]];
  if (d.pctDaRenda !== null) chips.push(["Da renda", pct(d.pctDaRenda)]);
  if (d.fixas) chips.push(["Já tem dono", m(d.fixas)]);
  return (
    <>
      {d.sai > 0 && (
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {chips.map(([a, b]) => (
            <div key={a} className="glass rounded-2xl px-3 py-2.5">
              <small className="block text-[12px] text-ink-muted">{a}</small>
              <b className="block text-[17px] tabular-nums text-ink">{b}</b>
            </div>
          ))}
        </div>
      )}
      {d.marcas.length > 0 && <FileiraDeMarcas marcas={d.marcas} />}
      <Rotulo>Por que você quer colocar o dinheiro no lugar?</Rotulo>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS_PRONTOS.map((x) => (
          <button key={x} type="button" aria-pressed={motivo === x} onClick={() => setMotivo(x)} className={`min-h-10 rounded-full border px-3 text-[13px] font-semibold ${motivo === x ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-ink"}`}>
            {x}
          </button>
        ))}
      </div>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} rows={2} placeholder="Ex.: Quero dormir em paz." aria-label="Seu motivo" className="rounded-2xl border border-border-strong bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none" />
      <Botao disabled={c.salvando || !motivo.trim()} onClick={() => c.concluir(() => salvarRespostaAction("motivo", motivo.trim(), undefined, c.feita ? undefined : 7))}>
        Salvar meu motivo
      </Botao>
    </>
  );
}

// ===== 8 · Monte o seu orçamento (guia) =====
function M8({ c }: { c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  return (
    <>
      <Desenho n={8}>
        <div className="flex w-full max-w-[260px] flex-col gap-1.5 text-left">
          {[
            ["var(--color-cat-moradia)", "Contas e casa"],
            ["var(--color-cat-alimentacao)", "Dia a dia"],
            ["var(--color-success)", "Guardar primeiro"],
            ["var(--color-cat-lazer)", "Livre, sem culpa"],
          ].map(([cor, nome], i) => (
            <div key={nome} className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="h-2.5 rounded-full" style={{ backgroundColor: cor, width: `${[44, 28, 18, 12][i]}%` }} aria-hidden />
              {nome}
            </div>
          ))}
        </div>
      </Desenho>
      <p className="px-1 text-center text-[14px] text-ink-muted">{naVoz("A divisão da aula, em reais, na sua renda. Você ajusta o que não combina.", v)}</p>
      <Guiar n={8} />
      <Ajuda n={8} />
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 9 · Guardar primeiro =====
function M9({ d, c }: { d: Extract<DadosDoMarco, { n: 9 }>; c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  return (
    <>
      <HeroiDoTema>
        <small className="text-[13px] font-semibold text-heroi-suave">Todo mês, no dia do salário</small>
        <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{d.guardar ? money(d.guardar, { round: true }) : "a definir"}</span>
        <small className="text-[13px] text-heroi-suave">{d.guardar ? `do seu ${v.orcamento}` : `Escolha quanto guardar no ${v.orcamento} (missão 8) para eu calcular.`}</small>
      </HeroiDoTema>
      <Cartao>
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.bancos.slice(0, 6).map((b) => (
            <LogoDoGasto key={b} descricao={b} size={40} />
          ))}
        </div>
        <p className="text-[14px] text-ink">
          No app do seu banco: <b>Pix agendado</b> ou <b>transferência programada</b>, todo mês, para a conta onde você guarda.
        </p>
      </Cartao>
      {!c.feita && (
        <Botao disabled={c.salvando} onClick={() => c.concluir()}>
          Fiz a transferência automática
        </Botao>
      )}
      <Ajuda n={9} />
    </>
  );
}

// ===== 10 · Sua reserva (guia) =====
function M10({ d, c }: { d: Extract<DadosDoMarco, { n: 10 }>; c: Comum }) {
  const money = useMoney();
  return (
    <>
      {d.reserva ? (
        <HeroiDoTema>
          <small className="text-[13px] font-semibold text-heroi-suave">Sua reserva</small>
          <span className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{money(d.reserva.tem, { round: true })}</span>
          <div className="heroi-veu h-2.5 overflow-hidden rounded-full">
            <div className="h-full rounded-full bg-success" style={{ width: `${Math.max(2, Math.min(100, (d.reserva.tem / d.reserva.alvo) * 100))}%` }} />
          </div>
          <small className="text-[13px] text-heroi-suave">alvo {money(d.reserva.alvo, { round: true })}</small>
        </HeroiDoTema>
      ) : (
        <Desenho n={10}>
          <p className="text-[14px] font-semibold">O colchão para os meses ruins</p>
        </Desenho>
      )}
      <Guiar n={10} />
      <Ajuda n={10} />
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 11 · Seu sonho com preço (guia) =====
function M11({ d, c }: { d: Extract<DadosDoMarco, { n: 11 }>; c: Comum }) {
  const money = useMoney();
  return (
    <>
      {d.sonho ? (
        <HeroiDoTema>
          <div className="flex items-center gap-3">
            <span className="heroi-veu flex size-12 shrink-0 items-center justify-center rounded-2xl">
              <Plane size={22} aria-hidden />
            </span>
            <div className="min-w-0">
              <b className="block break-words leading-snug text-[17px]">{d.sonho.nome}</b>
              <small className="block text-[13px] text-heroi-suave">
                {money(d.sonho.valor, { round: true })}
                {d.sonho.data ? ` · ${new Date(`${d.sonho.data}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}` : ""}
              </small>
            </div>
          </div>
        </HeroiDoTema>
      ) : (
        <Desenho n={11}>
          <p className="text-[14px] font-semibold">O que é, quanto custa e para quando</p>
        </Desenho>
      )}
      <Guiar n={11} />
      <Ajuda n={11} />
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 12 · Pra onde vai o guardado =====
const COR_DA_FATIA: Record<string, string> = { reserva: "var(--color-success)", meta: "var(--color-accent)", livre: "var(--color-info)" };
const ICONE_DA_FATIA: Record<string, LucideIcon> = { reserva: LifeBuoy, meta: Plane, livre: Sprout };

function M12({ d, c }: { d: Extract<DadosDoMarco, { n: 12 }>; c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  return (
    <>
      {d.guardar === null ? (
        <p className="px-1 text-[14px] text-ink-muted">Para dividir, o app precisa saber quanto você guarda por mês. Monte o {v.orcamento} (missão 8) e volte.</p>
      ) : d.fatias.length === 0 ? (
        <p className="px-1 text-[14px] text-ink-muted">Crie a reserva (missão 10) e um sonho (missão 11) para o app dividir os {money(d.guardar, { round: true })} por mês.</p>
      ) : (
        <Cartao>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
            {d.fatias.map((f, i) => (
              <span key={i} className="h-full" style={{ width: `${(f.valor / d.guardar!) * 100}%`, backgroundColor: COR_DA_FATIA[f.tipo] ?? "var(--color-accent)" }} />
            ))}
          </div>
          {d.fatias.map((f, i) => {
            const Icone = ICONE_DA_FATIA[f.tipo] ?? Sprout;
            return (
              <div key={i} className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${COR_DA_FATIA[f.tipo] ?? "var(--color-accent)"} 16%, transparent)`, color: COR_DA_FATIA[f.tipo] ?? "var(--color-accent)" }}>
                  <Icone size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 break-words leading-snug text-[14px] font-semibold text-ink">{f.tipo === "livre" ? "Liberdade financeira" : f.nome}</span>
                <span className="text-[14px] tabular-nums text-ink">{money(f.valor, { round: true })}</span>
              </div>
            );
          })}
        </Cartao>
      )}
      {!c.feita && (
        <Botao disabled={c.salvando} onClick={() => c.concluir(() => salvarRespostaAction("divisao", "ok", d.fatias, 12))}>
          Confirmar
        </Botao>
      )}
    </>
  );
}

// ===== 13 · Suas dívidas na mesa (a missão nova) =====
const SELO: Record<string, { rotulo: string; classe: string }> = {
  saudavel: { rotulo: "Saudável", classe: "bg-success-soft text-success" },
  atencao: { rotulo: "Atenção", classe: "bg-surface-2 text-ink" },
  cara: { rotulo: "Cara", classe: "bg-accent-soft text-accent-strong" },
};

function M13({ d, c }: { d: Extract<DadosDoMarco, { n: 13 }>; c: Comum }) {
  const money = useMoney();
  const porMes = d.dividas.reduce((s, x) => s + x.porMes, 0);
  if (d.dividas.length === 0) {
    return (
      <>
        <Desenho n={13}>
          <p className="text-[14px] font-semibold">Cartão, empréstimo, financiamento, cheque especial</p>
        </Desenho>
        <Link href="/dividas?nova=1" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm">
          <Plus size={16} aria-hidden /> Pôr uma dívida na mesa
        </Link>
        {!c.feita && (
          <Botao secundario disabled={c.salvando} onClick={() => c.concluir(() => salvarRespostaAction("dividas", "nenhuma", undefined, 13))}>
            Não tenho dívida
          </Botao>
        )}
        <Ajuda n={13} />
      </>
    );
  }
  return (
    <>
      <HeroiDoTema>
        <small className="text-[13px] font-semibold text-heroi-suave">Sai por mês com dívidas</small>
        <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{money(porMes, { round: true })}</span>
      </HeroiDoTema>
      <ul className="glass divide-y divide-border rounded-2xl">
        {d.dividas.map((x) => (
          <li key={x.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <LogoDoGasto descricao={x.credor} categoria="OUTROS" size={36} />
            <span className="min-w-0 flex-1">
              <b className="block break-words leading-snug text-[14px] font-semibold text-ink">{x.nome}</b>
              <small className="block text-[12px] tabular-nums text-ink-muted">{money(x.porMes, { round: true })} por mês</small>
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${SELO[x.saude].classe}`}>{SELO[x.saude].rotulo}</span>
          </li>
        ))}
      </ul>
      {!c.feita && (
        <Botao disabled={c.salvando} onClick={() => c.concluir(() => salvarRespostaAction("dividas", String(d.dividas.length), { porMes }, 13))}>
          Tudo na mesa
        </Botao>
      )}
      <Link href="/dividas" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-5 text-sm font-semibold text-ink">
        Ver quando fico livre
      </Link>
    </>
  );
}

// ===== 14 · A regra do cartão =====
const ICONES_DAS_REGRAS: Record<string, LucideIcon> = { orcamento: ShieldCheck, debito: Banknote, sem_juros: ReceiptText };

function M14({ d, c }: { d: Extract<DadosDoMarco, { n: 14 }>; c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  const [regra, setRegra] = useState(c.respostas.regra?.texto ?? "");
  return (
    <>
      {d.proximaFatura > 0 && (
        <HeroiDoTema>
          <small className="text-[13px] font-semibold text-heroi-suave">Já marcado para o mês que vem</small>
          <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{money(d.proximaFatura, { round: true })}</span>
        </HeroiDoTema>
      )}
      <Rotulo>Sua regra do cartão</Rotulo>
      {REGRAS_DO_CARTAO.map((r) => (
        <Opcao key={r.chave} icone={ICONES_DAS_REGRAS[r.chave]} titulo={naVoz(r.t, v)} sub={r.sub} marcada={regra === r.chave} onClick={() => setRegra(r.chave)} />
      ))}
      <Botao disabled={c.salvando || !regra} onClick={() => c.concluir(() => salvarRespostaAction("regra", regra, undefined, c.feita ? undefined : 14))}>
        Salvar minha regra
      </Botao>
    </>
  );
}

// ===== 15 · Seu livre da semana =====
function M15({ d, c }: { d: Extract<DadosDoMarco, { n: 15 }>; c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  const escolher = (r: "semanal" | "mensal") =>
    c.concluir(async () => {
      await escolherRitmoAction(r);
      if (!c.feita) await concluirMarcoAction(15);
    });
  return (
    <>
      <HeroiDoTema>
        <small className="text-[13px] font-semibold text-heroi-suave">Livre para gastar por semana</small>
        <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{d.livreSemana !== null ? money(d.livreSemana, { round: true }) : "a definir"}</span>
        <small className="text-[13px] text-heroi-suave">{d.livreSemana !== null ? "já sem as contas fixas e o guardar" : `Monte o ${v.orcamento} para o app calcular.`}</small>
      </HeroiDoTema>
      <Rotulo>Como você quer acompanhar?</Rotulo>
      <Opcao icone={CalendarDays} titulo="Toda semana" sub="5 minutos, toda segunda" marcada={d.ritmo === "semanal"} onClick={() => escolher("semanal")} />
      <Opcao icone={CalendarRange} titulo="Uma vez por mês" sub="15 minutos no fechamento" marcada={d.ritmo === "mensal"} onClick={() => escolher("mensal")} />
    </>
  );
}

// ===== 16 · A regra das 24 horas (guia) =====
function M16({ c }: { c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  return (
    <>
      <Desenho n={16}>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {["O que é", "Quanto custa", "Sem mentir para mim", naVoz("{DecidirAmanha}", v)].map((x, i) => (
            <span key={x} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-heroi-suave">›</span>}
              <span className="heroi-veu rounded-full px-2.5 py-1 text-[12px] font-semibold">{x}</span>
            </span>
          ))}
        </div>
      </Desenho>
      <Guiar n={16} />
      <Ajuda n={16} />
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 17 · Um dia sem gasto à toa =====
function M17({ d, c }: { d: Extract<DadosDoMarco, { n: 17 }>; c: Comum }) {
  const router = useRouter();
  const [salvando, startTransition] = useTransition();
  const topou = c.respostas.desafio?.texto || null;
  const passou = topou !== null && topou < c.hoje;
  const pode: [LucideIcon, string][] = [
    [ShoppingCart, "Mercado"],
    [Bus, "Transporte"],
    [Receipt, "Contas"],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="glass flex flex-col gap-2 rounded-2xl p-3">
          <b className="text-[13px] font-semibold text-success">Pode</b>
          {pode.map(([Icone, nome]) => (
            <span key={nome} className="flex items-center gap-2 text-[14px] text-ink">
              <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
                <Icone size={15} aria-hidden />
              </span>
              {nome}
            </span>
          ))}
        </div>
        <div className="glass flex flex-col gap-2 rounded-2xl p-3">
          <b className="text-[13px] font-semibold text-accent-strong">Amanhã não</b>
          {d.marcas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {d.marcas.map((g) => (
                <LogoDoGasto key={g.slug} descricao={g.descricao} categoria={g.parentCategory} size={36} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {[...EXEMPLOS.delivery, ...EXEMPLOS.compras.slice(0, 2)].map((x) => (
                  <LogoDoGasto key={x} descricao={x} size={36} />
                ))}
              </div>
              <small className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Exemplo</small>
            </>
          )}
          <span className="text-[13px] text-ink-muted">delivery, compras, lazer</span>
        </div>
      </div>
      {c.feita ? null : topou && !passou ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-center text-[14px] text-ink">Topado! No dia seguinte o app confere sozinho.</p>
      ) : (
        <>
          {passou && <p className="px-1 text-center text-[14px] text-ink-muted">Escorregou? Tudo bem. Tenta de novo amanhã.</p>}
          <Botao
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                await salvarRespostaAction("desafio", c.amanha);
                vibrar("sucesso");
                router.refresh();
              })
            }
          >
            Topo o desafio
          </Botao>
        </>
      )}
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 18 · O ritual de 5 minutos (guia) =====
function M18({ c }: { c: Comum }) {
  return (
    <>
      <Desenho n={18}>
        <div className="grid w-full max-w-[260px] grid-cols-2 gap-2 text-[13px] font-semibold">
          <span className="heroi-veu rounded-xl px-2 py-2">Segunda: os gastos</span>
          <span className="heroi-veu rounded-xl px-2 py-2">Sábado: os limites</span>
        </div>
      </Desenho>
      <Guiar n={18} />
      <Ajuda n={18} />
      <MarcarAdmin c={c} />
    </>
  );
}

// ===== 19 · Um sonho que funciona (os 9 passos) =====
function M19({ c }: { c: Comum }) {
  const [passo, setPasso] = useState(0);
  const [passos, setPassos] = useState<string[]>(() => (Array.isArray(c.respostas.passos?.dados) ? (c.respostas.passos!.dados as string[]) : PASSOS_DO_SONHO.map(() => "")));
  const p = PASSOS_DO_SONHO[passo];
  const ultimo = passo === PASSOS_DO_SONHO.length - 1;
  return (
    <>
      <div className="flex gap-1" aria-hidden>
        {PASSOS_DO_SONHO.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= passo ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
      <p className="text-caption text-ink-muted">
        Passo {passo + 1} de 9 · {p.t}
      </p>
      <h2 key={passo} className="mr-entra text-[19px] font-bold leading-snug text-ink">
        {p.q}
      </h2>
      <textarea
        value={passos[passo]}
        onChange={(e) => setPassos((x) => x.map((y, i) => (i === passo ? e.target.value : y)))}
        maxLength={160}
        rows={3}
        placeholder={`Ex.: ${p.ex}`}
        aria-label={p.q}
        className="rounded-2xl border border-border-strong bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      <div className="flex gap-2">
        {passo > 0 && (
          <Botao secundario onClick={() => setPasso(passo - 1)}>
            Voltar
          </Botao>
        )}
        {ultimo ? (
          <Botao disabled={c.salvando || passos.some((x) => !x.trim())} onClick={() => c.concluir(() => salvarRespostaAction("passos", "9", passos.map((x) => x.trim()), c.feita ? undefined : 19))}>
            Salvar
          </Botao>
        ) : (
          <Botao disabled={!passos[passo].trim()} onClick={() => setPasso(passo + 1)}>
            Próximo
          </Botao>
        )}
      </div>
    </>
  );
}

// ===== 20 · A semana contra o plano =====
function M20({ d, c }: { d: Extract<DadosDoMarco, { n: 20 }>; c: Comum }) {
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const menos = d.mediaSemana - d.semana;
  return (
    <>
      <HeroiDoTema>
        <small className="text-[13px] font-semibold text-heroi-suave">Gastou nos últimos 7 dias</small>
        <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{m(d.semana)}</span>
        {d.mediaSemana > 0 && <small className="text-[14px] font-semibold">{menos >= 0 ? `${m(menos)} a menos que a sua média` : `${m(-menos)} acima da sua média`}</small>}
      </HeroiDoTema>
      {d.mediaSemana > 0 && (
        <Cartao>
          <div className="flex justify-between text-[13px] text-ink-muted">
            <span>Esta semana</span>
            <span>sua média: {m(d.mediaSemana)}</span>
          </div>
          <Barra valor={d.semana / (Math.max(d.semana, d.mediaSemana) * 1.15)} regua={d.mediaSemana / (Math.max(d.semana, d.mediaSemana) * 1.15)} />
        </Cartao>
      )}
      {d.marcas.length > 0 && (
        <>
          <Rotulo>Onde foi a semana</Rotulo>
          <FileiraDeMarcas marcas={d.marcas} rotulo="na semana" />
        </>
      )}
      <Botao secundario onClick={() => abrirRegistrar("importar")}>
        Subir o extrato mais recente
      </Botao>
      {!c.feita && (
        <Botao disabled={c.salvando} onClick={() => c.concluir()}>
          Entendi
        </Botao>
      )}
    </>
  );
}

// ===== 21 · Feche o mês =====
function M21({ d, c }: { d: Extract<DadosDoMarco, { n: 21 }>; c: Comum }) {
  const { voz } = useProfileTheme();
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const [recompensa, setRecompensa] = useState(c.respostas.recompensa?.texto ?? "");
  const linhas: [LucideIcon, string, string][] = [];
  if (d.livreSemana !== null) linhas.push([CalendarDays, "Livre por semana", m(d.livreSemana)]);
  if (d.guardar) linhas.push([Sprout, "Guardar todo mês", m(d.guardar)]);
  if (d.reserva) linhas.push([LifeBuoy, "Reserva", `alvo ${m(d.reserva)}`]);
  if (d.sonho) linhas.push([Plane, d.sonho.nome, d.sonho.data ? new Date(`${d.sonho.data}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "sem data"]);
  const regra = REGRAS_DO_CARTAO.find((r) => r.chave === c.respostas.regra?.texto);
  return (
    <>
      {linhas.length > 0 && (
        <Cartao>
          {linhas.map(([Icone, a, b]) => (
            <div key={a} className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                <Icone size={17} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 break-words leading-snug text-[14px] text-ink-muted">{a}</span>
              <b className="shrink-0 text-[14px] tabular-nums text-ink">{b}</b>
            </div>
          ))}
        </Cartao>
      )}
      {c.respostas.motivo?.texto && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-[15px] italic text-ink">&ldquo;{c.respostas.motivo.texto}&rdquo;</p>}
      {regra && (
        <p className="flex items-center gap-2 px-1 text-[13px] text-ink-muted">
          <ShieldCheck size={15} aria-hidden /> {naVoz(regra.t, v)}
        </p>
      )}
      {!d.fechouMes && (
        <Link href="/mensal/foco/fechamento" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-5 text-sm font-semibold text-ink">
          Fechar o mês no app
        </Link>
      )}
      <label className="flex flex-col gap-1.5">
        <Rotulo>Sua recompensa (pequena, e que caiba no plano)</Rotulo>
        <input value={recompensa} onChange={(e) => setRecompensa(e.target.value)} maxLength={80} placeholder="Ex.: jantar no restaurante preferido" className="min-h-12 rounded-2xl border border-border-strong bg-surface-2 px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none" />
      </label>
      <Botao
        disabled={c.salvando || !recompensa.trim()}
        onClick={() =>
          c.concluir(async () => {
            await salvarRespostaAction("recompensa", recompensa.trim(), undefined, c.feita ? undefined : 21);
            celebrar();
          })
        }
      >
        {c.feita ? "Salvar" : "Concluir o Money Reset"}
      </Botao>
    </>
  );
}

/**
 * A missão em si, uma por marco, com os números e as marcas DELA. Quando termina, chama `onFeita`
 * e a tela de fora mostra "o app reage".
 */
export function TelaDoMarco({ n, dados, respostas, feita, admin, achei, hoje, amanha, onFeita }: { n: number; dados: DadosDoMarco; respostas: Respostas; feita: boolean; admin: boolean; achei: number; hoje: string; amanha: string; onFeita: () => void }) {
  const router = useRouter();
  const [salvando, startTransition] = useTransition();
  // O "o app reage" só aparece junto com os dados novos (a próxima missão já aberta): depois do
  // await, o que muda a tela volta para dentro da transição, senão a tela troca antes e mostra
  // "Voltar ao mapa" até o refresh chegar.
  const concluir = (fn?: () => Promise<unknown>) =>
    startTransition(async () => {
      const ok = fn ? await fn() : await concluirMarcoAction(n);
      if (ok === false) {
        startTransition(() => router.refresh());
        return;
      }
      vibrar("sucesso");
      startTransition(() => {
        router.refresh();
        onFeita();
      });
    });
  const c: Comum = { n, respostas, feita, admin, achei, hoje, amanha, concluir, salvando };

  const corpo = (() => {
    switch (dados.n) {
      case 1:
        return <M1 d={dados as Extract<DadosDoMarco, { n: 1 }>} c={c} />;
      case 2:
        return <M2 d={dados as Extract<DadosDoMarco, { n: 2 }>} c={c} />;
      case 3:
        return <M3 d={dados as Extract<DadosDoMarco, { n: 3 }>} c={c} />;
      case 4:
        return <M4 d={dados as Extract<DadosDoMarco, { n: 4 }>} c={c} />;
      case 5:
        return <M5 d={dados as Extract<DadosDoMarco, { n: 5 }>} c={c} />;
      case 6:
        return <M6 c={c} />;
      case 7:
        return <M7 d={dados as Extract<DadosDoMarco, { n: 7 }>} c={c} />;
      case 8:
        return <M8 c={c} />;
      case 9:
        return <M9 d={dados as Extract<DadosDoMarco, { n: 9 }>} c={c} />;
      case 10:
        return <M10 d={dados as Extract<DadosDoMarco, { n: 10 }>} c={c} />;
      case 11:
        return <M11 d={dados as Extract<DadosDoMarco, { n: 11 }>} c={c} />;
      case 12:
        return <M12 d={dados as Extract<DadosDoMarco, { n: 12 }>} c={c} />;
      case 13:
        return <M13 d={dados as Extract<DadosDoMarco, { n: 13 }>} c={c} />;
      case 14:
        return <M14 d={dados as Extract<DadosDoMarco, { n: 14 }>} c={c} />;
      case 15:
        return <M15 d={dados as Extract<DadosDoMarco, { n: 15 }>} c={c} />;
      case 16:
        return <M16 c={c} />;
      case 17:
        return <M17 d={dados as Extract<DadosDoMarco, { n: 17 }>} c={c} />;
      case 18:
        return <M18 c={c} />;
      case 19:
        return <M19 c={c} />;
      case 20:
        return <M20 d={dados as Extract<DadosDoMarco, { n: 20 }>} c={c} />;
      case 21:
        return <M21 d={dados as Extract<DadosDoMarco, { n: 21 }>} c={c} />;
      default:
        return null;
    }
  })();
  return <div className="flex flex-col gap-3">{corpo}</div>;
}
