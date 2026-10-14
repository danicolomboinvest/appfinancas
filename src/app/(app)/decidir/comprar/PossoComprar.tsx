"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus, Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useVoltarAoTopo } from "@/components/ui/useVoltarAoTopo";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { avaliarCompra, type Compra, type CompraBase, type Veredito } from "@/lib/decisoes/posso-comprar";
import { CATEGORIAS_DA_COMPRA, categoriaOutra, formaQuePesaMenos, vereditoComPeso, type CategoriaDaCompra, type Sinceridade } from "@/lib/decisoes/compra-guiada";
import { planoDoSonho } from "@/lib/decisoes/sonho-da-compra";
import { registrarCompraAction } from "@/app/(app)/mensal/foco/actions";
import { criarSonhoDaCompraAction } from "@/app/(app)/planejamento/metas/actions";
import { textoDaMedia } from "@/lib/planning/renda-media";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** A ordem e os ícones do protótipo aprovado (rodada 24): oito toques, "Outra coisa" no fim. */
const FOTOS_DA_COMPRA: { id: string; foto: string }[] = [
  { id: "celular", foto: "/fotos/metas/tecnologia.jpg" },
  { id: "viagem", foto: "/fotos/metas/viagem-praia.jpg" },
  { id: "casa", foto: "/fotos/metas/casa.jpg" },
  { id: "educacao", foto: "/fotos/metas/estudos.jpg" },
];

const SINCERIDADE: { k: Sinceridade; titulo: string; sub: string }[] = [
  { k: "precisa", titulo: "Preciso mesmo", sub: "Faz falta no dia a dia" },
  { k: "quero", titulo: "Quero muito", sub: "Penso nisso faz tempo" },
  { k: "impulso", titulo: "Impulso", sub: "Vi agora e quis" },
];

// "Cabe se…" não dizia o quê (15/10/2026): agora "Cabe, mas" e logo abaixo o custo concreto.
const PALAVRA: Record<Veredito, string> = { ok: "Cabe", custo: "Cabe, mas", nao: "Melhor esperar" };

type Passo = 1 | 2 | 3 | 4 | 5 | "resposta" | "meta";

/**
 * "Posso comprar algo?" do protótipo aprovado, até o fim: o que é, quanto custa, como pagar (à
 * vista ou de 2 a 48 vezes), com sinceridade, a confirmação do livre do mês e a resposta (Cabe,
 * Cabe, mas…, Melhor esperar), com o aviso de plano apertado, "Como cheguei nisso" e "Virar meta".
 * A conta é a de sempre (`posso-comprar.ts` e `compra-guiada.ts`).
 */
export function PossoComprar({ base, hoje, parcelasNoMes }: { base: CompraBase; hoje: { ano: number; mes: number }; parcelasNoMes: number }) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const t = useProfileTheme().voz.titulos;
  const [passo, setPasso] = useState<Passo>(1);
  const topoRef = useVoltarAoTopo<HTMLDivElement>(passo);
  const [cat, setCat] = useState<CategoriaDaCompra | null>(null);
  const [valor, setValor] = useState(0);
  const [modo, setModo] = useState<"vista" | "parcelado">("vista");
  const [vezes, setVezes] = useState(10);
  const [vezesTexto, setVezesTexto] = useState("10");
  const [sin, setSin] = useState<Sinceridade | null>(null);
  const [mudar, setMudar] = useState(false);
  const [conta, setConta] = useState(false);
  const [salvando, iniciar] = useTransition();

  const mesNome = MESES[hoje.mes - 1];
  const ultimoDia = new Date(hoje.ano, hoje.mes, 0).getDate();
  const mesDaqui = (k: number | null) => {
    if (k === null) return "sem previsão";
    const d = new Date(hoje.ano, hoje.mes - 1 + k, 1);
    return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };
  const fmt = { money: m, mesDaqui };
  const compra: Compra = { valor, modo, parcelas: modo === "vista" ? 1 : vezes, juros: 0, desconto: 0, descricao: cat?.nome.toLowerCase() };
  const r = useMemo(
    () => (valor > 0 ? avaliarCompra(base, compra, fmt) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt só depende de money e hoje
    [base, valor, modo, vezes, cat?.nome, money],
  );
  const precisaDeDado = useMemo(() => {
    const teste = avaliarCompra(base, { valor: 1, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    return "erro" in teste ? teste.erro : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a base decide
  }, [base]);

  if (precisaDeDado === "renda" || precisaDeDado === "orcamento") {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">{precisaDeDado === "renda" ? t.compraPrecisoRenda : t.compraPrecisoOrcamento}</p>
        <p className="mt-1 text-caption text-ink-muted">{t.compraSemChute}</p>
        <Link href="/orcamento" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-on-pill">
          {t.compraPreencher}
        </Link>
      </Card>
    );
  }

  const ok = r && !("erro" in r) ? r : null;
  const v: Veredito = ok ? vereditoComPeso(ok.veredito, sin ?? "quero", valor, ok.pagavel ?? true) : "ok";
  const nome = cat?.nome ?? "Compra";
  const nomeMinusculo = cat && cat.id !== "outro" ? cat.nome.toLowerCase() : "";
  const parcela = valor / Math.max(1, vezes);
  const sonho = planoDoSonho(valor, base.renda, hoje);

  const titulo = "text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink [text-wrap:balance]";
  const caixa = "flex flex-col gap-2 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]";
  const cta = "min-h-14 w-full rounded-full bg-ink px-5 text-base font-semibold text-canvas transition-opacity disabled:opacity-40";
  const ctaClaro = "min-h-12 w-full rounded-full bg-surface-2 px-5 text-[15px] font-semibold text-ink";
  const chip = (sel: boolean) => `min-h-10 rounded-full px-3.5 text-sm font-medium tabular-nums ${sel ? "bg-accent-soft text-ink ring-1 ring-accent" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border)]"}`;
  const linkClaro = "self-start py-2 text-sm text-ink-muted underline underline-offset-4";

  const PASSOS = 5;
  const voltar = () => {
    if (passo === 1) return router.push("/decidir");
    if (passo === "resposta") return setPasso(5);
    if (passo === "meta") return setPasso("resposta");
    setPasso((passo - 1) as Passo);
  };
  const rotuloTopo = passo === "resposta" ? "A resposta" : passo === "meta" ? "Virar meta" : `${passo} de ${PASSOS}`;

  const definirVezes = (n: number) => {
    const x = Math.max(2, Math.min(48, Math.round(n)));
    setVezes(x);
    setVezesTexto(String(x));
  };

  const modoDaCompra = (mini = false) => (
    <div className={`${caixa} gap-3`}>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Como pagar">
        {(["vista", "parcelado"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)} className={`min-h-10 rounded-full text-sm font-medium ${modo === k ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]" : "text-ink-muted"}`}>
            {k === "vista" ? "À vista" : "Parcelado"}
          </button>
        ))}
      </div>
      {modo === "parcelado" ? (
        <>
          <small className="text-sm text-ink-muted">Em quantas vezes?</small>
          <div className="flex items-center justify-between gap-2">
            <button type="button" aria-label="Uma vez a menos" disabled={vezes <= 2} onClick={() => definirVezes(vezes - 1)} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40">
              <Minus size={22} aria-hidden />
            </button>
            <div className="flex min-w-0 flex-col items-center">
              <label className="flex items-baseline text-[44px] font-light leading-none tabular-nums text-ink">
                <input
                  inputMode="numeric"
                  maxLength={2}
                  value={vezesTexto}
                  aria-label="Número de parcelas, de 2 a 48"
                  onChange={(e) => {
                    const s = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setVezesTexto(s);
                    if (Number(s) >= 2) setVezes(Math.min(48, Number(s)));
                  }}
                  onBlur={() => setVezesTexto(String(vezes))}
                  className="w-[1.3em] bg-transparent text-right outline-none"
                />
                x
              </label>
              <small className="mt-1 text-caption tabular-nums text-ink-muted">
                {vezes}x de {m(parcela)}
              </small>
            </div>
            <button type="button" aria-label="Uma vez a mais" disabled={vezes >= 48} onClick={() => definirVezes(vezes + 1)} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40">
              <Plus size={22} aria-hidden />
            </button>
          </div>
          <small className="text-caption text-ink-muted">sem juros · toque no número para digitar, de 2x a 48x</small>
          {!mini && (
            <div className="flex gap-2">
              {[3, 10, 12].map((x) => (
                <button key={x} type="button" aria-pressed={vezes === x} onClick={() => definirVezes(x)} className={chip(vezes === x)}>
                  {x}x
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col">
          <ValorDestaque texto={m(valor)} />
          <small className="mt-1 text-caption text-ink-muted">Pix ou débito, de uma vez</small>
        </div>
      )}
    </div>
  );

  function escolher(c: CategoriaDaCompra) {
    setCat(c);
    // Um valor comum da categoria já vem marcado (o terceiro atalho), como no protótipo.
    if (!(valor > 0) || cat?.id !== c.id) setValor(c.atalhos[2]);
    setPasso(2);
  }

  const fonteDaRenda = base.fonteRenda === "plano" ? "do seu plano" : base.fonteRenda === "media" ? (base.mesesDaRenda ? textoDaMedia(base.mesesDaRenda) : "a média dos últimos meses") : "o que entrou no mês";

  return (
    <div ref={topoRef} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={voltar} className="flex min-h-11 items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={18} aria-hidden />
          Voltar
        </button>
        <span className="min-w-0 truncate text-sm tabular-nums text-ink-muted">{rotuloTopo}</span>
      </div>
      {typeof passo === "number" && (
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: PASSOS }, (_, k) => (
            <i key={k} className={`h-[3px] flex-1 rounded-full ${k < passo ? "bg-ink" : "bg-border-strong"}`} />
          ))}
        </div>
      )}

      {typeof passo === "number" && <span className="-mb-2 text-[13px] font-medium text-ink-muted">Posso comprar?</span>}
      {passo === 1 && (
        <>
          <h2 className={titulo}>O que você quer comprar?</h2>
          {/* Protótipo (#comprar): quatro quadros com foto e, embaixo, as outras em pílulas. */}
          <div className="grid grid-cols-2 gap-2" data-compra-fotos>
            {FOTOS_DA_COMPRA.map(({ id, foto }) => {
              const c = CATEGORIAS_DA_COMPRA.find((x) => x.id === id)!;
              return (
                <button key={id} type="button" aria-pressed={cat?.id === id} onClick={() => escolher(c)} className="relative h-24 overflow-hidden rounded-2xl bg-surface-2 aria-pressed:shadow-[inset_0_0_0_3px_var(--color-ink)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- banco de fotos do app */}
                  <img src={foto} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent to-65%" aria-hidden />
                  <b className="absolute bottom-2.5 left-3 z-10 font-medium text-white">{c.nome}</b>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {["vestuario", "eletronico", "beleza", "outro"].map((id) => {
              const c = id === "outro" ? categoriaOutra("") : CATEGORIAS_DA_COMPRA.find((x) => x.id === id)!;
              return (
                <button key={id} type="button" aria-pressed={cat?.id === id} onClick={() => escolher(c)} className="min-h-10 rounded-full bg-surface-2 px-4 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface">
                  {c.nome}
                </button>
              );
            })}
          </div>
        </>
      )}

      {passo === 2 && cat && (
        <>
          <h2 className={titulo}>Quanto custa?</h2>
          <div className={caixa}>
            <span className="text-sm text-ink-muted">Preço {nomeMinusculo ? `do ${nomeMinusculo}` : ""}</span>
            <div className="flex items-center justify-between gap-2">
              <button type="button" aria-label="Menos 100" onClick={() => setValor((x) => Math.max(0, x - 100))} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
                <Minus size={20} aria-hidden />
              </button>
              <label className="flex min-w-0 items-baseline gap-1.5 border-b border-border-strong pb-1">
                <span className="text-base text-ink-muted">{simbolo}</span>
                <CampoDeDinheiro
                  aria-label="Quanto custa"
                  placeholder="0,00"
                  valor={valor}
                  onValor={(v) => setValor(v ?? 0)}
                  max={9_999_999}
                  className="w-full min-w-0 bg-transparent text-center text-[34px] font-light tabular-nums text-ink outline-none"
                />
              </label>
              <button type="button" aria-label="Mais 100" onClick={() => setValor((x) => x + 100)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
                <Plus size={20} aria-hidden />
              </button>
            </div>
            <small className="mt-1 text-caption text-ink-muted">Valores comuns</small>
            <div className="flex flex-wrap gap-2">
              {cat.atalhos.map((a) => (
                <button key={a} type="button" aria-pressed={valor === a} onClick={() => setValor(a)} className={chip(valor === a)}>
                  {m(a)}
                </button>
              ))}
            </div>
          </div>
          <button type="button" disabled={!(valor > 0)} onClick={() => setPasso(3)} className={cta}>
            Continuar
          </button>
        </>
      )}

      {passo === 3 && cat && (
        <>
          <h2 className={titulo}>Como você imagina pagar?</h2>
          {modoDaCompra()}
          <button
            type="button"
            className={linkClaro}
            onClick={() => {
              const f = formaQuePesaMenos(base, valor, cat, parcelasNoMes, fmt);
              setModo(f.modo);
              if (f.modo === "parcelado") definirVezes(Math.min(48, f.parcelas));
              showToast(f.modo === "vista" ? "À vista pesa menos" : `${Math.min(48, f.parcelas)}x pesa menos`);
            }}
          >
            Me ajuda a escolher
          </button>
          <button type="button" onClick={() => setPasso(4)} className={cta}>
            {modo === "vista" ? "Continuar à vista" : `Continuar com ${vezes}x de ${m(parcela)}`}
          </button>
        </>
      )}

      {passo === 4 && cat && (
        <>
          <div>
            <h2 className={titulo}>Com sinceridade…</h2>
            <small className="text-sm text-ink-muted">{nomeMinusculo ? `Esse ${nomeMinusculo} é` : "Isso é"}</small>
          </div>
          <div className="flex flex-col gap-2.5">
            {SINCERIDADE.map((s) => (
              <button key={s.k} type="button" aria-pressed={sin === s.k} onClick={() => setSin(s.k)} className={`flex min-h-16 flex-col justify-center rounded-3xl px-5 py-3 text-left ${sin === s.k ? "bg-accent-soft ring-1 ring-accent" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]"}`}>
                <b className="text-[15px] font-semibold text-ink">{s.titulo}</b>
                <small className="text-sm text-ink-muted">{s.sub}</small>
              </button>
            ))}
          </div>
          <button type="button" disabled={!sin} onClick={() => setPasso(5)} className={cta}>
            Continuar
          </button>
        </>
      )}

      {passo === 5 && (
        <>
          <h2 className={titulo}>
            Seu livre de {mesNome} é <span className="whitespace-nowrap">{m(base.sobraDoMes)}</span>. Certo?
          </h2>
          <div className={caixa}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-muted">Livre no mês</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">Do seu orçamento de {mesNome}</span>
            </div>
            <ValorDestaque texto={m(base.sobraDoMes)} />
            <small className="text-caption text-ink-muted">até dia {ultimoDia}</small>
            <div className="mt-2 grid grid-cols-3 gap-2 text-caption">
              {[
                ["Plano de gastos", base.gastoPlanejado],
                ["Já saiu", base.gastoDoMesAtual ?? 0],
                ["Livre", base.sobraDoMes],
              ].map(([k, x]) => (
                <div key={k as string} className="min-w-0">
                  <small className="block text-ink-muted">{k}</small>
                  <b className="block truncate text-sm font-semibold tabular-nums text-ink">{m(x as number)}</b>
                </div>
              ))}
            </div>
          </div>
          <div className={caixa}>
            <small className="text-caption text-ink-muted">
              Renda de {mesNome} · {fonteDaRenda}
            </small>
            <b className="text-lg font-semibold tabular-nums text-ink">{m(base.renda)}</b>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setPasso("resposta")} className={cta}>
              Sim, ver a resposta
            </button>
            <Link href={`/mensal/${hoje.ano}/${hoje.mes}`} className={`${ctaClaro} flex items-center justify-center`}>
              Falta lançar um gasto
            </Link>
          </div>
        </>
      )}

      {passo === "resposta" && ok && cat && (
        <>
          <HeroiDoTema>
            <span className="text-sm text-heroi-suave">
              {nome} de {m(valor)}
              {modo === "vista" ? ", à vista" : `, em ${vezes}x de ${m(parcela)}`}
            </span>
            <b className={`text-[2.25rem] font-light leading-none tracking-[-0.02em] ${v === "ok" ? "text-success" : v === "nao" ? "text-danger" : ""}`}>{PALAVRA[v]}</b>
            <span className="text-[15px] font-medium">{ok.titulo}</span>
            {ok.comprometimento && (
              <div className="flex flex-col gap-1.5">
                <span className="heroi-veu relative h-1.5 overflow-visible rounded-full">
                  <i className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-heroi-tinta)]" style={{ width: `${Math.min(100, ok.comprometimento.depois * 100)}%` }} />
                  <b className="absolute -top-1 h-3.5 w-0.5 rounded bg-[var(--color-heroi-tinta)] opacity-50" style={{ left: "90%" }} aria-hidden />
                </span>
                <small className="text-xs tabular-nums text-heroi-suave">
                  {Math.round(ok.comprometimento.hoje * 100)}% hoje → {Math.round(ok.comprometimento.depois * 100)}% com a compra · limite 90%
                </small>
              </div>
            )}
          </HeroiDoTema>
          {/* Plano apertado (regra 3.8): explica por que até compra pequena não cabe. */}
          {ok.planoApertado && (
            <p className="rounded-2xl px-4 py-3 text-sm text-ink" role="note" style={{ background: "color-mix(in srgb, var(--color-dinheiro-faltou) 12%, var(--color-surface))" }}>
              {ok.planoApertado.texto}{" "}
              <Link href={ok.planoApertado.atalho.href} className="font-medium text-accent-strong underline-offset-2 hover:underline">
                {ok.planoApertado.atalho.rotulo}
              </Link>
            </p>
          )}
          <div className={caixa}>
            <small className="text-caption text-ink-muted">Próximo passo</small>
            <p className="text-[15px] text-ink">
              {v === "ok" ? "Pode comprar sem culpa. O app acompanha o mês por você." : v === "custo" ? (ok.sugestao ?? `${ok.explicacao} Se preferir, junte antes.`) : "Juntar antes e comprar à vista, sem dívida."}
            </p>
          </div>
          {mudar ? (
            modoDaCompra(true)
          ) : (
            <button type="button" className={linkClaro} onClick={() => setMudar(true)}>
              Mudar a compra
            </button>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Com sinceridade">
            {SINCERIDADE.map((s) => (
              <button key={s.k} type="button" aria-pressed={sin === s.k} onClick={() => setSin(s.k)} className={chip(sin === s.k)}>
                {s.titulo}
              </button>
            ))}
          </div>
          <button type="button" className={linkClaro} aria-expanded={conta} onClick={() => setConta((x) => !x)}>
            Como cheguei nisso
          </button>
          {conta && (
            <div className={caixa}>
              <p className="text-sm text-ink">{ok.explicacao}</p>
              <dl className="flex flex-col gap-1.5 text-caption">
                {ok.conta.map((c) => (
                  <div key={c.rotulo} className="flex items-baseline justify-between gap-4">
                    <dt className="min-w-0 text-ink-muted">{c.rotulo}</dt>
                    <dd className="max-w-[55%] shrink-0 text-right tabular-nums text-ink">{c.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setPasso("meta")} className={`${cta} flex items-center justify-center gap-2`}>
              <Target size={16} aria-hidden /> Virar meta
            </button>
            <Link href="/decidir" className={`${ctaClaro} flex items-center justify-center`}>
              Voltar ao Decidir
            </Link>
          </div>
          {/* "Vou comprar" continua anotando a compra: o próximo "Posso comprar?" desconta ela até
              chegar no extrato (o mesmo dinheiro livre não aprova duas compras). */}
          {v !== "nao" && (
            <button
              type="button"
              disabled={salvando}
              className="self-center py-2 text-sm text-ink-muted underline underline-offset-4"
              onClick={() =>
                iniciar(async () => {
                  try {
                    await registrarCompraAction({ tipo: "compra_comprei", valor, descricao: nome.slice(0, 120), modo, parcelas: modo === "vista" ? 1 : vezes });
                    showToast("Anotado. Conto essa compra até ela chegar no extrato.");
                    router.push("/decidir");
                  } catch {
                    showError("Não consegui salvar. Tente de novo.");
                  }
                })
              }
            >
              Vou comprar, pode anotar
            </button>
          )}
          <ReportarErro tela="Decidir: Posso comprar?" regra="regra dos 90% da renda e o livre do mês (posso-comprar.ts)" />
        </>
      )}

      {passo === "meta" && cat && sonho && (
        <>
          <h2 className={titulo}>{nome} à vista, sem dívida</h2>
          <HeroiDoTema>
            <span className="text-sm text-heroi-suave">Novo sonho · {nome}</span>
            <ValorDestaque texto={m(valor)} />
          </HeroiDoTema>
          <div className={`${caixa} grid grid-cols-3 gap-2`}>
            {[
              ["Começa em", MESES[sonho.comeca.mes - 1]],
              ["Por mês", m(sonho.porMes)],
              ["Compra em", sonho.compraEmCurto],
            ].map(([k, x]) => (
              <div key={k} className="min-w-0">
                <small className="block text-caption text-ink-muted">{k}</small>
                <b className="block truncate text-[15px] font-semibold tabular-nums text-ink">{x}</b>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink-muted">Até 10% da renda por mês, a parte que a regra dos 90% já guarda para o futuro.</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={salvando}
              className={cta}
              onClick={() =>
                iniciar(async () => {
                  const res = await criarSonhoDaCompraAction({ nome, alvo: valor, meses: sonho.meses });
                  if (!res.ok) return showError(res.error);
                  showToast(`Sonho criado: ${nome}, ${m(sonho.porMes)} por mês`);
                  router.push(`/planejamento/metas/${res.id}`);
                })
              }
            >
              Criar o sonho
            </button>
            <button
              type="button"
              disabled={salvando}
              className={ctaClaro}
              onClick={() =>
                iniciar(async () => {
                  try {
                    await registrarCompraAction({ tipo: "compra_amanha", valor, descricao: nome.slice(0, 120), modo, parcelas: modo === "vista" ? 1 : vezes });
                    showToast("Combinado: amanhã eu te lembro");
                    router.push("/decidir");
                  } catch {
                    showError("Não consegui salvar. Tente de novo.");
                  }
                })
              }
            >
              Me lembra amanhã
            </button>
          </div>
        </>
      )}
    </div>
  );
}
