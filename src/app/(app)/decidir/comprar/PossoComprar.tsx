"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Roleta } from "@/components/ui/Roleta";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { avaliarCompra, saidasDaCompra, type Compra, type CompraBase, type ResultadoCompra, type Veredito } from "@/lib/decisoes/posso-comprar";
import {
  CATEGORIAS_DA_COMPRA,
  JUROS_SE_NAO_SABE,
  LIMITE_PARCELAS_DA_RENDA,
  TAXAS_DA_ROLETA,
  VALORES_DA_ROLETA,
  VEZES_DA_ROLETA,
  caminhosParaCaber,
  categoriaOutra,
  formaQuePesaMenos,
  ordemDasDecisoes,
  vereditoComPeso,
  type Caminho,
  type CategoriaDaCompra,
  type DecisaoDaCompra,
  type Sinceridade,
} from "@/lib/decisoes/compra-guiada";
import type { CaminhoParaTexto } from "@/lib/profiles/textos/compra";
import { registrarCompraAction } from "@/app/(app)/mensal/foco/actions";
import { criarSonhoDaCompraAction } from "@/app/(app)/planejamento/metas/actions";
import { ReportarErro } from "@/components/decisoes/ReportarErro";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Passo = "cat" | "outro" | "valor" | "forma" | "vezes" | "sincera" | "analise" | "veredito" | "caber" | "decidir" | "fim";
/** Os passos que aparecem nos pontinhos do topo ("outro" e "analise" são de passagem). */
const PASSOS: Passo[] = ["cat", "valor", "forma", "vezes", "sincera", "veredito", "caber", "decidir", "fim"];
type Juros = "nao" | "sim" | "naosei";
type Fim = { emoji: string; titulo: string; texto: string; meta?: { alvo: number; meses: number } };

/** Quanto tempo o "Analisando seu mês…" fica na tela (a Dani pediu 2 segundos). */
const ESPERA_ANALISE_MS = 2000;

/**
 * "Posso comprar?" passo a passo (05/10/2026): uma pergunta por tela, toques grandes, a resposta
 * em tela cheia. A conta é a mesma de antes (`posso-comprar.ts`); as regras do passo a passo
 * (categoria, "seja sincera", parcelinha, caminhos) moram em `compra-guiada.ts`.
 */
export function PossoComprar({ base, hoje, parcelasNoMes }: { base: CompraBase; hoje: { ano: number; mes: number }; parcelasNoMes: number }) {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  // Centavos só somem de valor grande: "R$ 0" pra uma compra de R$ 0,40 não serve.
  const m = (v: number) => money(v, { round: Math.abs(v) >= 100 || v === 0 });
  // Na roleta, no teclado e nos atalhos o valor é sempre inteiro: "R$ 0,00" assusta mais que ajuda.
  const mi = (v: number) => money(v, { round: true });
  const mesDaqui = (meses: number | null) => {
    if (meses === null) return "sem previsão";
    const d = new Date(hoje.ano, hoje.mes - 1 + meses, 1);
    return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };
  const fmt = { money: m, mesDaqui };

  const [passo, setPasso] = useState<Passo>("cat");
  const [historico, setHistorico] = useState<Passo[]>([]);
  const [cat, setCat] = useState<CategoriaDaCompra | null>(null);
  const [nomeOutro, setNomeOutro] = useState("");
  const [valor, setValor] = useState(0);
  const [digitando, setDigitando] = useState(false);
  const [forma, setForma] = useState<"vista" | "parcelado">("vista");
  const [vezes, setVezes] = useState(12);
  const [juros, setJuros] = useState<Juros>("nao");
  const [taxa, setTaxa] = useState(3);
  const [appDecidiu, setAppDecidiu] = useState(false);
  const [sinceridade, setSinceridade] = useState<Sinceridade>("quero");
  const [prioridade, setPrioridade] = useState<"compra" | "sonho" | null>(null);
  const [caminho, setCaminho] = useState<Caminho | null>(null);
  const [fim, setFim] = useState<Fim | null>(null);
  const [metaCriada, setMetaCriada] = useState<string | null>(null);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const irParaValor = useRef<((v: number) => void) | null>(null);

  const ir = (p: Passo) => {
    setHistorico((h) => [...h, passo]);
    setPasso(p);
  };
  const voltar = () => {
    setHistorico((h) => {
      const anterior = h.at(-1);
      if (anterior) setPasso(anterior);
      return h.slice(0, -1);
    });
  };
  const recomecar = () => {
    setPasso("cat");
    setHistorico([]);
    setCat(null);
    setNomeOutro("");
    setValor(0);
    setDigitando(false);
    setForma("vista");
    setVezes(12);
    setJuros("nao");
    setTaxa(3);
    setAppDecidiu(false);
    setSinceridade("quero");
    setPrioridade(null);
    setCaminho(null);
    setFim(null);
    setMetaCriada(null);
    setErroAoSalvar(null);
  };

  // O "Analisando seu mês…": dois segundos e vai sozinho pro resultado (sem voltar pra ele).
  useEffect(() => {
    if (passo !== "analise") return;
    const id = setTimeout(() => setPasso("veredito"), ESPERA_ANALISE_MS);
    return () => clearTimeout(id);
  }, [passo]);

  const jurosAoMes = juros === "nao" ? 0 : juros === "sim" ? taxa / 100 : JUROS_SE_NAO_SABE;
  const compra: Compra = { valor, modo: forma, parcelas: forma === "parcelado" ? vezes : 1, juros: forma === "parcelado" ? jurosAoMes : 0, desconto: 0, descricao: cat?.nome };
  const r = useMemo(
    () => avaliarCompra(base, compra, fmt),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt só depende de money e hoje
    [base, valor, forma, vezes, jurosAoMes, cat?.nome, money],
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

  const ok = !("erro" in r) ? r : null;
  const v: Veredito = ok ? vereditoComPeso(ok.veredito, sinceridade, valor, ok.pagavel ?? true) : "ok";
  const nomeDaCompra = cat?.nome ?? "Compra";

  // O que ela registra: o preço à vista, ou o que paga de verdade parcelado (com juros).
  const custoDe = (c: Compra, res: ResultadoCompra) =>
    c.modo === "vista" ? c.valor * (1 - c.desconto) : c.valor + ("erro" in res ? 0 : (res.custoJuros ?? 0));
  const registrar = (tipo: "compra_desisti" | "compra_amanha" | "compra_comprei", c: Compra, depois: Fim) => {
    const res = avaliarCompra(base, c, fmt);
    startTransition(async () => {
      try {
        await registrarCompraAction({ tipo, valor: custoDe(c, res), descricao: nomeDaCompra.slice(0, 120), modo: c.modo, parcelas: c.modo === "vista" ? 1 : Math.min(420, c.parcelas) });
        setErroAoSalvar(null);
        setFim(depois);
        ir("fim");
      } catch {
        setErroAoSalvar(t.compraErroSalvar);
      }
    });
  };

  const caminhos = passo === "caber" && cat ? caminhosParaCaber(base, compra, cat, sinceridade, parcelasNoMes, fmt) : [];
  const textoDoCaminho = (c: Caminho): CaminhoParaTexto => {
    switch (c.chave) {
      case "parcelar":
        return { chave: c.chave, vezes: c.vezes, porMes: m(c.parcela) };
      case "barato":
        return { chave: c.chave, valor: m(c.teto), vezes: c.vezes };
      case "cortar":
        return { chave: c.chave, valor: mi(c.cortes.reduce((s, x) => s + x.valor, 0)), cortes: juntarNomes(c.cortes.map((x) => x.nome)), cortePorMes: c.porMes };
      case "desconto":
        return { chave: c.chave, valor: m(c.preco), parcelado: m(c.parcelado) };
      case "juntarRapido":
        return { chave: c.chave, porMes: m(c.mensal), meses: c.meses, mes: mesDaqui(c.meses), cortes: `${m(c.corte.valor)} de ${c.corte.nome}` };
      case "juntar":
        return { chave: c.chave, porMes: m(c.mensal), meses: c.meses, mes: mesDaqui(c.meses) };
    }
  };

  const indice = PASSOS.indexOf(passo === "outro" ? "cat" : passo === "analise" ? "sincera" : passo);
  const opcao = (sel = false) =>
    `flex min-h-16 w-full items-center gap-3.5 rounded-3xl border p-4 text-left transition-transform active:scale-[0.98] ${
      sel ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/50"
    }`;
  const cta = "min-h-14 w-full rounded-full bg-pill px-5 text-base font-bold text-on-pill transition-opacity disabled:opacity-40";
  const ctaVazado = "min-h-14 w-full rounded-full border border-border-strong px-5 text-base font-bold text-ink";
  const chip = (sel: boolean) =>
    `min-h-11 rounded-full border px-4 text-sm font-semibold tabular-nums ${sel ? "border-accent bg-accent-soft text-ink" : "border-border bg-surface text-ink"}`;
  const eyebrow = "text-caption font-bold uppercase tracking-[0.12em] text-accent-strong";
  const titulo = "text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink [text-wrap:balance]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {historico.length === 0 ? (
          <Link href="/decidir" aria-label="Fechar" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
            <X size={20} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={voltar}
            disabled={passo === "analise" || passo === "fim"}
            aria-label="Voltar"
            className="flex size-11 items-center justify-center rounded-full bg-surface text-ink disabled:invisible"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex gap-1.5" aria-hidden>
          {PASSOS.map((p, i) => (
            <span key={p} className={`h-1.5 rounded-full transition-all ${i === indice ? "w-5 bg-accent" : i < indice ? "w-1.5 bg-accent/50" : "w-1.5 bg-border-strong"}`} />
          ))}
        </div>
        {/* Só o X e a seta (05/10/2026: "deixa a tela realmente só o comprar"). Recomeçar mora no
            "Simular outra compra" do fim. */}
        <Link href="/decidir" aria-label="Fechar" className={`flex size-11 items-center justify-center rounded-full bg-surface text-ink ${historico.length === 0 ? "invisible" : ""}`}>
          <X size={20} />
        </Link>
      </div>

      {passo === "cat" && (
        <>
          <h2 className={titulo}>{t.compraOQue}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIAS_DA_COMPRA.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCat(c);
                  ir("valor");
                }}
                className="flex min-h-24 flex-col items-start justify-between gap-2 rounded-3xl border border-border bg-surface p-4 text-left text-base font-bold text-ink transition-transform hover:border-accent/50 active:scale-[0.97]"
              >
                <span className="text-[28px] leading-none" aria-hidden>
                  {c.emoji}
                </span>
                {c.nome}
              </button>
            ))}
            <button
              type="button"
              onClick={() => ir("outro")}
              className="col-span-2 flex min-h-20 items-center gap-3.5 rounded-3xl border-2 border-dashed border-border-strong bg-surface p-4 text-left text-base font-bold text-ink hover:border-accent/50"
            >
              <span className="text-[28px] leading-none" aria-hidden>
                ✏️
              </span>
              {t.compraOutraCoisa}
            </button>
          </div>
        </>
      )}

      {passo === "outro" && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setCat(categoriaOutra(nomeOutro));
            ir("valor");
          }}
        >
          <h2 className={titulo}>{t.compraOutraCoisaPergunta}</h2>
          <input
            autoFocus
            value={nomeOutro}
            maxLength={60}
            onChange={(e) => setNomeOutro(e.target.value)}
            placeholder={t.compraOutraCoisaExemplo}
            className="min-h-14 rounded-2xl border border-border bg-surface px-4 text-lg text-ink outline-none focus:border-accent"
          />
          <button type="submit" className={cta}>
            {t.compraContinuar}
          </button>
        </form>
      )}

      {passo === "valor" && cat && (
        <>
          <p className={eyebrow}>
            {cat.emoji} {cat.nome}
          </p>
          <h2 className={titulo}>{t.compraQuantoCusta}</h2>
          {digitando ? (
            <>
              <p className="text-center text-[44px] font-black tabular-nums tracking-tight text-ink" aria-live="polite">
                {mi(valor)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "000"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={k === "⌫" ? "Apagar" : k}
                    onClick={() => {
                      const atual = String(valor || "");
                      const novo = k === "⌫" ? atual.slice(0, -1) : atual.length < 7 ? (atual + k).replace(/^0+/, "") : atual;
                      setValor(Number(novo.slice(0, 7) || 0));
                    }}
                    className="min-h-14 rounded-2xl bg-surface text-xl font-bold text-ink active:scale-95"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setDigitando(false)} className="self-center text-sm font-semibold text-accent-strong">
                {t.compraVoltarRoleta}
              </button>
            </>
          ) : (
            <>
              <Roleta valores={VALORES_DA_ROLETA} valor={valor} onChange={setValor} formatar={(x) => mi(x)} rotulo={t.compraQuantoCusta} irParaRef={irParaValor} />
              <div className="grid grid-cols-4 gap-1.5">
                {cat.atalhos.map((a) => (
                  <button key={a} type="button" className={`${chip(valor === a)} px-1 text-[13px]`} onClick={() => irParaValor.current?.(a)}>
                    {mi(a)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setDigitando(true)} className="self-center text-sm font-semibold text-accent-strong">
                {t.compraDigitarExato}
              </button>
            </>
          )}
          <button type="button" disabled={!(valor > 0)} onClick={() => ir("forma")} className={cta}>
            {t.compraContinuar}
          </button>
        </>
      )}

      {passo === "forma" && cat && (
        <>
          <p className={eyebrow}>{mi(valor)}</p>
          <h2 className={titulo}>{t.compraComoPagar}</h2>
          <div className="flex flex-col gap-2.5">
            {(
              [
                ["💸", t.compraAVista, t.compraAVistaSub, () => (setForma("vista"), setAppDecidiu(false), ir("sincera"))],
                ["💳", t.compraParcelado, t.compraParceladoSub, () => (setForma("parcelado"), setAppDecidiu(false), ir("vezes"))],
                [
                  "🤷‍♀️",
                  t.compraDecideVoce,
                  t.compraDecideVoceSub,
                  () => {
                    const f = formaQuePesaMenos(base, valor, cat, parcelasNoMes, fmt);
                    setForma(f.modo);
                    if (f.modo === "parcelado") setVezes(f.parcelas);
                    setJuros("nao");
                    setAppDecidiu(true);
                    ir("sincera");
                  },
                ],
              ] as const
            ).map(([em, tt, sub, acao]) => (
              <button key={tt} type="button" onClick={acao} className={opcao()}>
                <span className="text-[28px] leading-none" aria-hidden>
                  {em}
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-bold text-ink">{tt}</span>
                  <span className="text-sm text-ink-muted">{sub}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {passo === "vezes" && (
        <>
          <p className={eyebrow}>
            {mi(valor)} · {t.compraParcelado}
          </p>
          <h2 className={titulo}>{t.compraEmQuantasVezes}</h2>
          <Roleta
            valores={VEZES_DA_ROLETA}
            valor={vezes}
            onChange={setVezes}
            linhas={3}
            rotulo={t.compraEmQuantasVezes}
            formatar={(x) => (
              <>
                {x}x{x >= 60 && x % 12 === 0 && <small className="ml-2 text-sm font-semibold tracking-normal text-ink-muted">{t.compraAnos(x / 12)}</small>}
              </>
            )}
          />
          <p className={`${eyebrow} mt-1 text-ink-muted`}>{t.compraTemJuros}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.compraTemJuros}>
            {(
              [
                ["nao", t.compraJurosNao],
                ["sim", t.compraJurosSim],
                ["naosei", t.compraJurosNaoSei],
              ] as const
            ).map(([k, n]) => (
              <button key={k} type="button" aria-pressed={juros === k} className={chip(juros === k)} onClick={() => setJuros(k)}>
                {n}
              </button>
            ))}
          </div>
          {juros === "sim" && (
            <>
              <p className={`${eyebrow} mt-1 text-ink-muted`}>{t.compraQuantoJuros}</p>
              <Roleta
                valores={TAXAS_DA_ROLETA}
                valor={taxa}
                onChange={setTaxa}
                linhas={3}
                rotulo={t.compraQuantoJuros}
                formatar={(x) => `${x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
              />
            </>
          )}
          {ok?.quadro?.modo === "parcelado" && (
            <p className="text-sm text-ink-muted">
              {t.compraResumoParcela(vezes, m(ok.quadro.parcela), juros, `${(juros === "sim" ? taxa : JUROS_SE_NAO_SABE * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`)}
              {juros !== "nao" && (
                <>
                  <br />
                  <small>{t.compraTotalPago(m(ok.quadro.parcela * vezes))}</small>
                </>
              )}
            </p>
          )}
          <button type="button" onClick={() => ir("sincera")} className={cta}>
            {t.compraContinuar}
          </button>
        </>
      )}

      {passo === "sincera" && (
        <>
          <h2 className={titulo}>{t.compraSincera}</h2>
          <p className="-mt-2 text-base text-ink-muted">{t.compraSinceraSub}</p>
          <div className="flex flex-col gap-2.5">
            {(
              [
                ["precisa", "🧰"],
                ["quero", "😍"],
                ["impulso", "⚡"],
              ] as const
            ).map(([k, em]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSinceridade(k);
                  setPrioridade(null);
                  setCaminho(null);
                  ir("analise");
                }}
                className={opcao()}
              >
                <span className="text-[28px] leading-none" aria-hidden>
                  {em}
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-bold text-ink">{t.compraSinceridade[k].titulo}</span>
                  <span className="text-sm text-ink-muted">{t.compraSinceridade[k].sub}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {passo === "analise" && <Analisando titulo={t.compraAnalisando} itens={t.compraAnaliseItens} classeTitulo={titulo} />}

      {passo === "veredito" && ok && cat && (
        <Resultado
          r={ok}
          v={v}
          base={base}
          cat={cat}
          sinceridade={sinceridade}
          appDecidiu={appDecidiu}
          parcelasNoMes={parcelasNoMes}
          hoje={hoje}
          m={m}
          aoPriorizar={(p) => {
            setPrioridade(p);
            ir("decidir");
          }}
          aoCaber={() => ir("caber")}
          aoDecidir={() => ir("decidir")}
          classes={{ cta, ctaVazado, opcao: opcao(), eyebrow }}
        />
      )}

      {passo === "caber" && (
        <>
          <h2 className={titulo}>{caminhos.length ? t.compraCaberTitulo : t.compraCaberNadaTitulo}</h2>
          {caminhos.length ? (
            <>
              <p className="-mt-2 text-base text-ink-muted">{t.compraCaberSub}</p>
              <div className="flex flex-col gap-2.5">
                {caminhos.map((c) => {
                  const txt = t.compraCaminho(textoDoCaminho(c));
                  const sel = caminho?.chave === c.chave;
                  const selo = c.tipo === "juntar" ? t.compraSeloSemDivida : c.resultado === "ok" ? t.compraSeloCabe : t.compraSeloCusto;
                  const bom = c.tipo === "juntar" || c.resultado === "ok";
                  return (
                    <button key={c.chave} type="button" aria-pressed={sel} onClick={() => setCaminho(c)} className={opcao(sel)}>
                      <span className="text-[28px] leading-none" aria-hidden>
                        {ICONE_DO_CAMINHO[c.chave]}
                      </span>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="text-base font-bold text-ink">{txt.titulo}</span>
                        <span className="text-sm text-ink-muted">{txt.detalhe}</span>
                        <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${bom ? "bg-success/12 text-success" : "bg-accent-soft text-accent-strong"}`}>{selo}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="p-5 text-base leading-relaxed text-ink">{t.compraCaberNada(m(valor))}</Card>
          )}
          <button type="button" disabled={caminhos.length > 0 && !caminho} onClick={() => ir("decidir")} className={cta}>
            {!caminhos.length ? t.compraDecidir : caminho ? t.compraSeguirCom : t.compraEscolhaUm}
          </button>
        </>
      )}

      {passo === "decidir" && cat && (
        <>
          <h2 className={titulo}>{t.compraOQueVaiFazer}</h2>
          {erroAoSalvar && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{erroAoSalvar}</p>}
          <div className="flex flex-col gap-2.5">
            {ordemDasDecisoes(sinceridade, prioridade, caminho).map((d, i) => {
              const txtCaminho = caminho ? t.compraCaminho(textoDoCaminho(caminho)) : null;
              const guardar = caminho && caminho.tipo === "juntar" ? caminho : null;
              const item: Record<DecisaoDaCompra, [string, string, string]> = {
                comprar: [cat.emoji, t.compraVouComprar, txtCaminho?.comoCompra || t.compraDecComprarSub(sinceridade === "precisa")],
                guardar: ["💰", t.compraDecGuardar, guardar ? t.compraDecGuardarMeta(m(guardar.mensal), mesDaqui(guardar.meses)) : t.compraDecGuardarSub],
                amanha: ["💤", t.compraAmanha, t.compraDecAmanhaSub],
                desistir: ["🙅", t.compraDecDesistir, t.compraDecDesistirSub],
              };
              const [em, tt, sub] = item[d];
              return (
                <button
                  key={d}
                  type="button"
                  disabled={salvando}
                  onClick={() => {
                    const c = caminho && caminho.tipo === "comprar" ? caminho.compra : compra;
                    if (d === "comprar") {
                      registrar("compra_comprei", c, { emoji: "✨", titulo: t.compraFimComprarTitulo, texto: txtCaminho?.comoCompra ? `${txtCaminho.comoCompra}.` : v === "nao" ? t.compraCompreiNaoCabe : t.compraCompreiCabe });
                    } else if (d === "amanha") {
                      registrar("compra_amanha", compra, { emoji: "🤝", titulo: t.compraFimAmanhaTitulo, texto: t.compraAmanhaFeito });
                    } else if (d === "desistir") {
                      registrar("compra_desisti", compra, { emoji: "🙌", titulo: t.compraFimDesistirTitulo, texto: t.compraDesistiFeito(m(custoDe(compra, r))) });
                    } else {
                      const g = guardar ?? (ok?.saidas?.guardar ? { ...ok.saidas.guardar, corte: null } : (() => { const s = saidasDaCompra(base, compra, { valor: 1, porMes: false }); return s ? { ...s.guardar, corte: null } : null; })());
                      if (!g) return;
                      const corte = "corte" in g && g.corte ? `${m(g.corte.valor)} de ${g.corte.nome}` : null;
                      setFim({ emoji: "💰", titulo: t.compraFimGuardarTitulo, texto: t.compraFimGuardar(m(g.mensal), g.meses, mesDaqui(g.meses), corte), meta: { alvo: g.alvo, meses: g.meses } });
                      ir("fim");
                    }
                  }}
                  className={`${opcao(i === 0)} disabled:opacity-60`}
                >
                  <span className="text-[28px] leading-none" aria-hidden>
                    {em}
                  </span>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-base font-bold text-ink">{tt}</span>
                    <span className="text-sm text-ink-muted">{sub}</span>
                    {i === 0 && <span className="mt-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-extrabold text-accent-strong">{t.compraSugestao}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {passo === "fim" && fim && (
        <>
          <div className="flex flex-col items-center gap-3 px-2 pt-4 text-center">
            <span className="text-[56px] leading-none" aria-hidden>
              {fim.emoji}
            </span>
            <h2 className={titulo}>{fim.titulo}</h2>
            <p className="text-base leading-relaxed text-ink">{fim.texto}</p>
          </div>
          {fim.meta &&
            (metaCriada ? (
              <p className="text-center text-sm font-semibold text-success">
                {t.compraMetaCriada}{" "}
                <Link href={`/planejamento/metas/${metaCriada}`} className="text-accent-strong underline">
                  {t.compraVerMeta}
                </Link>
              </p>
            ) : (
              <button
                type="button"
                disabled={salvando}
                className={cta}
                onClick={() =>
                  startTransition(async () => {
                    const res = await criarSonhoDaCompraAction({ nome: nomeDaCompra, alvo: fim.meta!.alvo, meses: fim.meta!.meses });
                    if (res.ok) setMetaCriada(res.id);
                    else setErroAoSalvar(res.error);
                  })
                }
              >
                {t.compraCriarMeta}
              </button>
            ))}
          {erroAoSalvar && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{erroAoSalvar}</p>}
          <button type="button" onClick={recomecar} className={ctaVazado}>
            {t.compraSimularOutra}
          </button>
        </>
      )}
    </div>
  );
}

/** "Lazer", "Lazer e Outros", "Alimentação, Lazer e Transporte". */
function juntarNomes(nomes: string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

const ICONE_DO_CAMINHO: Record<Caminho["chave"], string> = { parcelar: "💳", barato: "🏷️", cortar: "✂️", desconto: "🤝", juntarRapido: "📅", juntar: "⏳" };

function Analisando({ titulo, itens, classeTitulo }: { titulo: string; itens: string[]; classeTitulo: string }) {
  const [feitos, setFeitos] = useState(0);
  useEffect(() => {
    const ids = itens.map((_, i) => setTimeout(() => setFeitos(i + 1), ((i + 1) * ESPERA_ANALISE_MS) / (itens.length + 1)));
    return () => ids.forEach(clearTimeout);
  }, [itens]);
  return (
    <>
      <h2 className={classeTitulo} aria-live="polite">
        {titulo}
      </h2>
      <ul className="flex flex-col gap-3">
        {itens.map((x, i) => (
          <li key={x} className={`flex items-center gap-3 text-base font-semibold transition-opacity ${i < feitos ? "text-ink opacity-100" : "text-ink-faint opacity-50"}`}>
            <span className={`flex size-7 items-center justify-center rounded-full text-sm ${i < feitos ? "bg-success/15 text-success" : "bg-surface-2 text-ink-faint"}`}>✓</span>
            {x}
          </li>
        ))}
      </ul>
    </>
  );
}

type Ok = Exclude<ResultadoCompra, { erro: string }>;

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * A resposta (05/10/2026, "tem muito texto na tela"): o título bem grande e, embaixo, a conta
 * desenhada. Uma barra mostra de onde sai o dinheiro (livre, dia a dia, guardado, falta), a data
 * do sonho aparece riscada com a nova do lado, e a régua das parcelas marca os 15% da renda. A
 * explicação em texto fica no "Como cheguei nisso".
 */
function Resultado({
  r,
  v,
  base,
  cat,
  sinceridade,
  appDecidiu,
  parcelasNoMes,
  hoje,
  m,
  aoPriorizar,
  aoCaber,
  aoDecidir,
  classes,
}: {
  r: Ok;
  v: Veredito;
  base: CompraBase;
  cat: CategoriaDaCompra;
  sinceridade: Sinceridade;
  appDecidiu: boolean;
  parcelasNoMes: number;
  hoje: { ano: number; mes: number };
  m: (v: number) => string;
  aoPriorizar: (p: "compra" | "sonho") => void;
  aoCaber: () => void;
  aoDecidir: () => void;
  classes: { cta: string; ctaVazado: string; opcao: string; eyebrow: string };
}) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const q = r.quadro;
  const fundo: Record<Veredito, string> = { ok: "bg-success/12", custo: "bg-accent-soft", nao: "bg-danger/10" };
  const corSelo: Record<Veredito, string> = { ok: "bg-success", custo: "bg-accent", nao: "bg-danger" };
  const selo: Record<Veredito, string> = { ok: t.compraOk, custo: t.compraCusto, nao: t.compraNao };
  const tom = t.compraTom(v, sinceridade);
  const mesCurto = (meses: number | null) => {
    if (meses === null) return t.compraSemPrevisao;
    const d = new Date(hoje.ano, hoje.mes - 1 + meses, 1);
    return `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  };
  const datas = q?.modo === "parcelado" ? q.datas : [];
  const atrasada = datas[0];

  // A barra: o custo (à vista) ou a parcela (por mês), em fatias de onde sai cada real.
  const fatias =
    q?.modo === "vista"
      ? [
          { rotulo: t.compraLegLivre, valor: q.doLivre, cor: "bg-success" },
          { rotulo: t.compraLegSobra, valor: q.daSobra, cor: "bg-accent" },
          { rotulo: t.compraLegFalta, valor: q.falta, cor: "bg-danger" },
        ]
      : q?.modo === "parcelado"
        ? [
            { rotulo: t.compraLegLivre, valor: q.doLivre, cor: "bg-success" },
            { rotulo: t.compraLegGuardado, valor: q.doGuardado, cor: "bg-danger/70" },
            { rotulo: t.compraLegFalta, valor: Math.max(0, q.parcela - q.doLivre - q.doGuardado), cor: "bg-danger" },
          ]
        : [];
  const total = q ? (q.modo === "vista" ? q.custo : q.parcela) : 0;
  const visiveis = fatias.filter((f) => f.valor >= 0.5);
  const soLivre = visiveis.every((f) => f.rotulo === t.compraLegLivre || (q?.modo === "vista" && f.rotulo === t.compraLegSobra));

  // A régua das parcelas: de 0 a 25% da renda, com a marca dos 15%.
  const parcelasDepois = q?.modo === "parcelado" ? parcelasNoMes + q.parcela : parcelasNoMes;
  const escala = base.renda * 0.25;
  const pctRegua = (x: number) => `${Math.min(100, (x / escala) * 100)}%`;
  const acima = parcelasDepois > base.renda * LIMITE_PARCELAS_DA_RENDA;

  return (
    <>
      {r.avisos && r.avisos.length > 0 && (
        <details className="rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-ink">
          <summary className="cursor-pointer font-semibold">⚠️ {t.compraAvisoDados}</summary>
          {r.avisos.map((a, i) => (
            <p key={i} className="mt-2">
              {a}
            </p>
          ))}
        </details>
      )}

      <div className={`flex flex-col gap-2 rounded-[28px] px-5 py-5 ${fundo[v]}`}>
        {/* Só a cor: o selo em texto repetia o título ("Não recomendo agora" + "Eu não compraria agora"). */}
        <span className={`size-4 rounded-full ${corSelo[v]}`} role="img" aria-label={selo[v]} />
        <p className="text-[32px] font-black leading-[1.04] tracking-tight text-ink [text-wrap:balance]">{t.compraVereditoTitulo(v, sinceridade, r.veredito === "ok" && v !== "ok")}</p>
        {/* O porquê (05/10/2026: "resumiu demais, não dá para entender por que chegou nisso"): a
            frase da conta, que fala das metas e da reserva, e o tom pelo quanto ela precisa. */}
        <p className="text-[15px] leading-snug text-ink">{r.explicacao}</p>
        {tom && <p className="text-[15px] leading-snug text-ink/75">{tom}</p>}
        {/* Limite do cartão: quanto falta nele, e se esta compra (ou a parcela do mês) passa. */}
        {base.cartao && (
          <p className="text-[15px] leading-snug text-ink/75">
            {total > base.cartao.limite - base.cartao.gasto
              ? t.limCompraPassa(m(Math.max(0, base.cartao.limite - base.cartao.gasto)))
              : t.limCompraCabe(m(base.cartao.limite - base.cartao.gasto))}
          </p>
        )}
        {(appDecidiu || r.custoJuros) && (
          <div className="flex flex-wrap gap-2">
            {appDecidiu && q && (
              <span className="rounded-full bg-surface/70 px-3 py-1 text-xs font-bold text-ink">
                {t.compraEscolhi(q.modo === "parcelado" ? `${q.vezes}x sem juros` : t.compraAVista.toLowerCase())}
              </span>
            )}
            {r.custoJuros !== null && r.custoJuros >= 1 && <span className="rounded-full bg-surface/70 px-3 py-1 text-xs font-bold text-accent-strong">{t.compraJurosChip(m(r.custoJuros))}</span>}
          </div>
        )}
      </div>

      {q && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink-muted">{q.modo === "vista" ? t.compraQPreco : t.compraQParcela(q.vezes)}</span>
            <b className="text-2xl font-black tabular-nums text-ink">
              {m(total)}
              {q.modo === "parcelado" && <small className="text-sm font-semibold text-ink-muted">{t.compraPorMes}</small>}
            </b>
          </div>
          <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            {visiveis.map((f) => (
              <span key={f.rotulo} className={`h-full ${f.cor}`} style={{ width: `${(f.valor / Math.max(total, 1)) * 100}%` }} />
            ))}
          </div>
          {soLivre ? (
            <p className="text-sm font-extrabold text-success">{t.compraQCabe}</p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {visiveis.map((f) => (
                <li key={f.rotulo} className="flex items-center gap-1.5 text-sm text-ink">
                  <span className={`size-2.5 rounded-full ${f.cor}`} aria-hidden />
                  {f.rotulo} <b className="tabular-nums">{m(f.valor)}</b>
                </li>
              ))}
            </ul>
          )}

          {datas.map((d) => (
            <div key={d.nome} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                🎯
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-ink">{d.nome}</span>
                <span className="text-sm tabular-nums text-ink-muted">
                  <s>{mesCurto(d.antes)}</s> → <b className="text-ink">{mesCurto(d.depois)}</b>
                </span>
              </span>
              {d.antes !== null && d.depois !== null && d.depois > d.antes && (
                <span className="shrink-0 rounded-full bg-danger/12 px-2.5 py-1 text-xs font-extrabold text-danger">{t.compraAtraso(d.depois - d.antes)}</span>
              )}
            </div>
          ))}

          {q.modo === "parcelado" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-ink-muted">{t.compraQParcelasMes}</span>
                <b className="tabular-nums text-ink">
                  {m(parcelasNoMes)} → {m(parcelasDepois)}
                </b>
              </div>
              <div className="relative h-3 rounded-full bg-surface-2" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-ink-faint" style={{ width: pctRegua(parcelasNoMes) }} />
                <span className={`absolute inset-y-0 rounded-r-full ${acima ? "bg-danger" : "bg-accent"}`} style={{ left: pctRegua(parcelasNoMes), width: `calc(${pctRegua(parcelasDepois)} - ${pctRegua(parcelasNoMes)})` }} />
                <span className="absolute -inset-y-1 w-0.5 rounded bg-ink" style={{ left: "60%" }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {acima && <span className="rounded-full bg-danger/12 px-2.5 py-1 text-xs font-extrabold text-danger">{t.compraParcelasAcima}</span>}
                {!cat.duravel && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-extrabold text-accent-strong">{t.compraPagandoAte(mesCurto(q.vezes))}</span>}
              </div>
            </div>
          )}
        </Card>
      )}

      {sinceridade === "quero" && v !== "ok" && atrasada ? (
        <>
          <p className={`${classes.eyebrow} mt-1 text-ink-muted`}>{t.compraOQueValeMais}</p>
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => aoPriorizar("compra")} className={classes.opcao}>
              <span className="text-[28px] leading-none" aria-hidden>
                {cat.emoji}
              </span>
              <span className="flex flex-col">
                <span className="text-base font-bold text-ink">{t.compraPrioridadeCompra}</span>
                <span className="text-sm text-ink-muted">{t.compraPrioridadeCompraSub(atrasada.nome, mesCurto(atrasada.depois))}</span>
              </span>
            </button>
            <button type="button" onClick={() => aoPriorizar("sonho")} className={classes.opcao}>
              <span className="text-[28px] leading-none" aria-hidden>
                🎯
              </span>
              <span className="flex flex-col">
                <span className="text-base font-bold text-ink">{t.compraPrioridadeSonho(atrasada.nome, mesCurto(atrasada.antes))}</span>
                <span className="text-sm text-ink-muted">{t.compraPrioridadeSonhoSub}</span>
              </span>
            </button>
          </div>
          <button type="button" onClick={aoCaber} className={classes.ctaVazado}>
            {t.compraVerComoCaber}
          </button>
        </>
      ) : (
        <>
          {/* Só pela conta: impulso que cabe ficou amarelo pelo tom, não tem o que "fazer caber". */}
          {r.veredito !== "ok" && (
            <button type="button" onClick={aoCaber} className={sinceridade === "impulso" ? classes.ctaVazado : classes.cta}>
              {t.compraVerComoCaber}
            </button>
          )}
          <button type="button" onClick={aoDecidir} className={r.veredito !== "ok" && sinceridade !== "impulso" ? classes.ctaVazado : classes.cta}>
            {t.compraDecidir}
          </button>
        </>
      )}

      {/* A explicação em texto e a regra de ouro ficam guardadas aqui, para quem quiser a conta. */}
      <details className="px-1">
        <summary className="cursor-pointer text-caption font-semibold text-accent-strong">{t.focoComoCheguei}</summary>
        <p className="mt-2 text-caption text-ink">{r.explicacao}</p>
        {r.alertaJuros && <p className="mt-2 text-caption text-ink">{r.alertaJuros}</p>}
        {r.comparacao && cat.duravel && (
          <p className="mt-2 text-caption text-ink">
            <b>{r.comparacao.melhor === "vista" ? t.compraVistaVale : t.compraParcelarVale}</b>
            {t.compraDiferenca(m(r.comparacao.diferenca))}
            {r.comparacao.melhor === "parcelado" ? t.compraSoSeRender : t.compraDescontoGanha}{" "}
            {t.compraRendimentoRef(`${(base.taxaReferencia * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`)}
          </p>
        )}
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-caption">
          {r.conta.map((c) => (
            <div key={c.rotulo} className="contents">
              <dt className="text-ink-muted">{c.rotulo}</dt>
              <dd className="text-right tabular-nums text-ink">{c.valor}</dd>
            </div>
          ))}
        </dl>
      </details>

      <ReportarErro tela="Posso comprar?" regra="regra dos 90% + sonhos mais distantes perdem aporte primeiro; reserva por último; parcela só pra bem durável e até 15% da renda" />
    </>
  );
}
