"use client";

import { useState } from "react";
import { Repeat, ShoppingBag } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { simulateWorthIt, WORTH_IT_ANNUAL_RATE, type WorthItMode } from "@/lib/simulators/worth-it";
import { Fim, Passo, useIrParaCalculadoras, type DadosDaTela } from "../Passo";
import { Atalhos, BotaoGrande, BotaoVirarMeta, CartaoValor, Colunas, ContadorComFoto, HeroiDoResultado, IconeRedondo, Selo, useRotuloDeAtalho } from "../pecas";

const NOME = "Vale a pena comprar";
const DECISOES = [
  { id: "sim", rotulo: "Comprar" },
  { id: "nao", rotulo: "Não comprar" },
  { id: "talvez", rotulo: "Ainda não sei" },
] as const;

/**
 * Vale a pena comprar? Duas perguntas (quanto custa, uma vez ou todo mês) e a resposta em horas
 * do trabalho dela. "E se eu investir?" mostra o que o dinheiro viraria. A conta é a de sempre
 * (lib/simulators/worth-it.ts): renda ÷ 220 horas, 12% ao ano, sem inflação nem IR.
 */
export function ValeGuiado({ dados }: { dados: DadosDaTela }) {
  const money = useMoney();
  const atalho = useRotuloDeAtalho();
  const sair = useIrParaCalculadoras();
  const r0 = (v: number) => money(v, { round: true });
  const [preco, setPreco] = useState(2500);
  const [tocou, setTocou] = useState(false);
  const [modoCompra, setModoCompra] = useState<WorthItMode | null>(null);
  const [passo, setPasso] = useState(1);
  const [tela, setTela] = useState<"guiado" | "horas" | "investir">("guiado");
  const [anos, setAnos] = useState(5);
  const [decisao, setDecisao] = useState<(typeof DECISOES)[number]["id"] | null>(null);
  // Sem renda no app, ela digita uma para a conta das horas (não é guardada).
  const [rendaDigitada, setRendaDigitada] = useState(0);
  const renda = dados.renda > 0 ? dados.renda : rendaDigitada;
  const mensal = modoCompra === "RECURRING";
  const r = simulateWorthIt({ price: preco, monthlyIncome: renda, mode: modoCompra ?? "SINGLE", horizonYears: anos });
  const porMes = mensal ? " por mês" : "";

  if (tela === "investir") {
    return (
      <Fim voltar="Voltar" onVoltar={() => setTela("horas")}>
        <HeroiDoResultado
          rotulo={`${r0(preco)}${porMes}`}
          frase={`Investido, em ${anos} ${anos === 1 ? "ano" : "anos"} vira`}
          numero={r0(r.futureValueIfInvested)}
          sub={`A ${WORTH_IT_ANNUAL_RATE * 100}% ao ano, sem inflação nem IR.`}
        />
        <Colunas
          itens={[
            { rotulo: "Gastar", valor: r.totalInvested, vence: false },
            { rotulo: "Investir", valor: r.futureValueIfInvested, vence: true },
          ]}
        />
        <Atalhos opcoes={[1, 5, 10].map((a) => ({ valor: a, rotulo: `${a} ${a === 1 ? "ano" : "anos"}` }))} ativo={anos} onEscolher={setAnos} />
        <div className="flex justify-center">
          <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Sua decisão">
            {DECISOES.map((d) => (
              <button key={d.id} type="button" aria-pressed={decisao === d.id} onClick={() => setDecisao(d.id)} className={`min-h-10 rounded-full px-3 text-sm ${decisao === d.id ? "bg-ink text-canvas" : "text-ink-muted"}`}>
                {d.rotulo}
              </button>
            ))}
          </div>
        </div>
        {decisao && (
          <p className="px-2 text-center text-[15px] text-ink-muted" aria-live="polite">
            {decisao === "sim"
              ? "Boa compra. Se couber no plano do mês, é seu."
              : decisao === "nao"
                ? `Ficou com ${r0(preco)}${porMes} no bolso.`
                : `Espera uns dias. Se ainda quiser, são ${Math.round(r.hoursEquivalent ?? 0)} horas de trabalho bem gastas.`}
          </p>
        )}
        <BotaoVirarMeta titulo="Virar meta" sub={`Comprar: ${r0(preco)}`} meta={{ nome: "Compra planejada", alvo: preco * (mensal ? 12 : 1), foto: "presente", icone: "GENERICO" }} />
      </Fim>
    );
  }

  if (tela === "horas") {
    const horas = r.hoursEquivalent;
    const h = horas === null ? null : Math.round(horas);
    const dias = horas === null ? 0 : Math.max(1, Math.round(horas / 8));
    return (
      <Fim>
        {h === null ? (
          <CartaoValor rotulo="Qual é a sua renda por mês?" valor={rendaDigitada} onChange={setRendaDigitada} sub="Sem renda no app, é com ela que eu conto as horas. Não fica guardada." />
        ) : (
          <>
            <HeroiDoResultado rotulo={`${r0(preco)}${porMes}`} frase="Isso custa" numero={`${h} ${h === 1 ? "hora" : "horas"}`} sub={`do seu trabalho${porMes}. Cerca de ${dias} ${dias === 1 ? "dia" : "dias"}.`}>
              <div className="flex flex-col gap-1.5 pt-1" aria-hidden>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(dias, 31) }, (_, i) => (
                    <i key={i} className="h-6 min-w-0 flex-1 basis-[8%] rounded-md bg-[var(--color-heroi-tinta)] opacity-85" />
                  ))}
                </div>
                <div className="flex justify-between text-caption text-heroi-suave">
                  <span>dia 1</span>
                  <span>dia {dias}</span>
                </div>
              </div>
            </HeroiDoResultado>
            <div className="glass flex flex-col gap-2 rounded-3xl p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-ink-muted">Sua hora vale</span>
                <Selo>{dados.renda > 0 ? (dados.rendaOrigem === "do seu plano" || !dados.rendaOrigem ? "Do seu orçamento" : dados.rendaOrigem[0].toUpperCase() + dados.rendaOrigem.slice(1)) : "Da renda que você digitou"}</Selo>
              </div>
              <span className="text-ink"><ValorDestaque texto={money(r.hourlyRate)} /></span>
              <p className="text-sm text-ink-muted">Sua renda de {r0(renda)} por 220 horas de trabalho no mês.</p>
            </div>
          </>
        )}
        <div className="mt-1 flex">
          <BotaoGrande onClick={() => setTela("investir")} disabled={h === null}>
            E se eu investir?
          </BotaoGrande>
        </div>
      </Fim>
    );
  }

  const voltar = () => (passo > 1 ? setPasso(1) : sair());
  if (passo === 1) {
    return (
      <Passo passo={1} total={2} nome={NOME} pergunta="Quanto custa?" onVoltar={voltar} pe={<BotaoGrande onClick={() => setPasso(2)} disabled={!(preco > 0)}>Próximo</BotaoGrande>}>
        <ContadorComFoto foto="presente" rotulo="O que você quer" valor={preco} passo={100} selo={tocou ? undefined : "Exemplo"} onChange={(x) => (setPreco(x), setTocou(true))} />
        <Atalhos opcoes={[500, 1000, 2500].map((x) => ({ valor: x, rotulo: atalho(x) }))} ativo={preco} onEscolher={(x) => (setPreco(x), setTocou(true))} />
      </Passo>
    );
  }
  const tipos: { id: WorthItMode; titulo: string; exemplo: string; Icone: typeof ShoppingBag; sufixo: string }[] = [
    { id: "SINGLE", titulo: "Uma vez", exemplo: "Um sapato, um celular", Icone: ShoppingBag, sufixo: "" },
    { id: "RECURRING", titulo: "Todo mês", exemplo: "Academia, assinatura", Icone: Repeat, sufixo: "/mês" },
  ];
  return (
    <Passo passo={2} total={2} nome={NOME} pergunta="É uma vez ou todo mês?" onVoltar={voltar} pe={<BotaoGrande onClick={() => setTela("horas")} disabled={!modoCompra}>Ver a resposta</BotaoGrande>}>
      <div className="grid grid-cols-2 gap-2.5">
        {tipos.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={modoCompra === t.id}
            onClick={() => setModoCompra(t.id)}
            className={`glass flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-shadow ${modoCompra === t.id ? "shadow-[inset_0_0_0_2px_var(--color-ink)]" : ""}`}
          >
            <IconeRedondo>
              <t.Icone size={18} aria-hidden />
            </IconeRedondo>
            <b className="text-[17px] font-medium text-ink">{t.titulo}</b>
            <small className="text-caption text-ink-muted">{t.exemplo}</small>
            <em className="mt-2 text-[17px] not-italic tabular-nums text-ink">
              {r0(preco)}
              {t.sufixo}
            </em>
          </button>
        ))}
      </div>
    </Passo>
  );
}
