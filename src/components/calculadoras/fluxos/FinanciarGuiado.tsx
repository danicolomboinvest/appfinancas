"use client";

import { useState } from "react";
import { useMoney } from "@/components/money/MoneyProvider";
import { EXEMPLO_FINANCIAR, type ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import { vereditoFinanciar } from "@/lib/calculadoras/vereditos";
import { AoVivo } from "../AoVivo";
import { CAMPOS_FINANCIAR, COMO_LER } from "../campos";
import { Fim, Passo, useIrParaCalculadoras, type DadosDaTela, type SimulacaoAberta } from "../Passo";
import {
  AcoesDoResultado,
  AjustesFinos,
  Alerta,
  Atalhos,
  BotaoGrande,
  BotaoVirarMeta,
  CampoFino,
  CartaoValor,
  Colunas,
  ContadorComFoto,
  HeroiDoResultado,
  Linha,
  Recolhivel,
  SegmentoFino,
  pc,
  useRotuloDeAtalho,
  useSalvar,
} from "../pecas";

const NOME = "Financiar ou alugar";

/** O ano a ano em duas linhas: o patrimônio de quem financia e de quem aluga e investe. */
function LinhasAnoAAno({ anos }: { anos: { ano: number; financiar: number; alugar: number }[] }) {
  const W = 300;
  const H = 120;
  const mx = Math.max(...anos.map((a) => Math.max(a.financiar, a.alugar)));
  const mn = Math.min(0, ...anos.map((a) => Math.min(a.financiar, a.alugar)));
  const n = Math.max(1, anos.length - 1);
  const x = (i: number) => 8 + (i / n) * (W - 16);
  const y = (v: number) => H - 14 - ((v - mn) / (mx - mn || 1)) * (H - 26);
  const pts = (k: "financiar" | "alugar") => anos.map((a, i) => `${x(i).toFixed(1)},${y(a[k]).toFixed(1)}`).join(" ");
  const marcas = anos.filter((a, i) => i === 0 || i === n || (a.ano % 10 === 0 && n - i > 3));
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Patrimônio ano a ano">
        <polyline points={pts("alugar")} fill="none" strokeWidth={2} className="stroke-ink-faint" />
        <polyline points={pts("financiar")} fill="none" strokeWidth={2.5} className="stroke-ink" />
        {marcas.map((a) => {
          const i = anos.indexOf(a);
          return (
            <text key={a.ano} x={x(i)} y={H - 1} textAnchor={i === 0 ? "start" : i === n ? "end" : "middle"} className="fill-ink-muted text-xs">
              {a.ano === 0 ? "hoje" : `${a.ano} anos`}
            </text>
          );
        })}
      </svg>
      <div className="flex gap-4 text-caption text-ink-muted">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-ink" />Financiar</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-ink-faint" />Alugar e investir</span>
      </div>
    </div>
  );
}

export function FinanciarGuiado({ dados, salva }: { dados: DadosDaTela; salva: SimulacaoAberta }) {
  const money = useMoney();
  const atalho = useRotuloDeAtalho();
  const sair = useIrParaCalculadoras();
  const r0 = (v: number) => money(v, { round: true });
  // O aluguel de hoje, quando o app sabe (conta "Aluguel" ou lançamento de aluguel).
  const aluguelDoApp = dados.aluguel;
  const inicio: ValoresDaCalculadora = { ...EXEMPLO_FINANCIAR, ...(aluguelDoApp ? { monthlyRent: aluguelDoApp.valor } : {}) };
  const [v, setV] = useState<ValoresDaCalculadora>(salva ? { ...EXEMPLO_FINANCIAR, ...salva.valores } : inicio);
  const [modo, setModo] = useState<"guiado" | "fim" | "vivo">(salva ? "vivo" : "guiado");
  const [passo, setPasso] = useState(1);
  const [tocou, setTocou] = useState<Record<string, boolean>>({});
  const [outroAluguel, setOutroAluguel] = useState(false);
  const muda = (k: string, x: number | string) => {
    setV((a) => ({ ...a, [k]: x }));
    setTocou((t) => ({ ...t, [k]: true }));
  };
  const imovel = Number(v.propertyValue);
  const entrada = Number(v.downPayment);
  const res = vereditoFinanciar(v);
  const s = useSalvar("FINANCIAR_VS_ALUGAR", v, res.veredito.erro ?? `${res.veredito.frase} · ${r0(res.veredito.numero)}`);
  const metaDaEntrada = { nome: "Entrada do imóvel", alvo: entrada, foto: "casa", icone: "CASA" as const };

  if (modo === "vivo") {
    return (
      <AoVivo
        nome="Financiar ou alugar?"
        ajuda={COMO_LER.financiar}
        campos={CAMPOS_FINANCIAR}
        exemplo={EXEMPLO_FINANCIAR}
        inicial={v}
        tipo="FINANCIAR_VS_ALUGAR"
        salvaInicial={!!salva}
        onValores={setV}
        calcular={(x) => {
          const r = vereditoFinanciar(x);
          return { veredito: r.veredito, sub: `${r.r.winner === "FINANCIAR" ? "Financiando" : "Alugando"}, você termina com isto a mais` };
        }}
        meta={(x) => ({ titulo: "Juntar a entrada", sub: `Entrada do imóvel · ${r0(Number(x.downPayment))}`, meta: { ...metaDaEntrada, alvo: Number(x.downPayment) } })}
        detalhes={(x) => {
          const r = vereditoFinanciar(x);
          return (
            <>
              <div className="glass rounded-2xl p-4">
                <p className="mb-2 text-[15px] font-medium text-ink">Ano a ano</p>
                <LinhasAnoAAno anos={r.anos} />
              </div>
              <div className="glass flex flex-col divide-y divide-border rounded-2xl px-4">
                <Linha rotulo="Primeira parcela" valor={money(r.primeiraParcela)} />
                <Linha rotulo="Valor financiado" valor={r0(r.r.financedAmount)} />
                <Linha rotulo="Imóvel no fim" valor={r0(r.r.finalFinancingPatrimony)} />
                <Linha rotulo="Investido no fim" valor={r0(r.r.finalInvestedPatrimony)} />
              </div>
            </>
          );
        }}
      />
    );
  }

  if (modo === "fim") {
    const pct = dados.renda > 0 ? (res.primeiraParcela / dados.renda) * 100 : 0;
    const anos = Math.round(Number(v.termMonths) / 12);
    return (
      <Fim>
        {res.veredito.erro ? (
          <Alerta>{res.veredito.erro}</Alerta>
        ) : (
          <>
            <HeroiDoResultado
              rotulo={`Imóvel de ${r0(imovel)} · em ${anos} ${anos === 1 ? "ano" : "anos"}`}
              frase={res.r.winner === "FINANCIAR" ? "Financiar termina com" : "Alugar e investir termina com"}
              numero={r0(res.veredito.numero)}
              sub="a mais em patrimônio"
            />
            <Colunas itens={res.veredito.barras.map((b) => ({ rotulo: b.chave === "alu" ? "Alugar e investir" : b.rotulo, valor: b.valor, vence: b.vence }))} />
            {pct >= 30 && (
              <Alerta>
                A primeira parcela seria <b>{r0(res.primeiraParcela)}</b>, {pc(pct, 0)}% da sua renda.
              </Alerta>
            )}
            <Recolhivel titulo="Ver ano a ano">
              <LinhasAnoAAno anos={res.anos} />
            </Recolhivel>
            <BotaoVirarMeta titulo="Virar meta: juntar a entrada" sub={`Entrada do imóvel · ${r0(entrada)}`} meta={metaDaEntrada} />
          </>
        )}
        <AcoesDoResultado s={res.veredito.erro ? null : s} onMexer={() => setModo("vivo")} />
      </Fim>
    );
  }

  const voltar = () => (passo > 1 ? (setOutroAluguel(false), setPasso(passo - 1)) : sair());
  const seguir = () => (passo < 3 ? setPasso(passo + 1) : setModo("fim"));

  if (passo === 1) {
    return (
      <Passo passo={1} total={3} nome={NOME} pergunta="Quanto custa o imóvel?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!(imovel > 0)}>Próximo</BotaoGrande>}>
        <ContadorComFoto foto="casa" rotulo="O imóvel" valor={imovel} passo={10000} min={50000} selo={tocou.propertyValue ? undefined : "Exemplo"} onChange={(x) => muda("propertyValue", x)} />
        <Atalhos opcoes={[300000, 500000, 800000].map((x) => ({ valor: x, rotulo: atalho(x) }))} ativo={imovel} onEscolher={(x) => muda("propertyValue", x)} />
      </Passo>
    );
  }

  if (passo === 2) {
    const pcEntrada = imovel ? (entrada / imovel) * 100 : 0;
    const carteira = dados.carteira;
    const posCarteira = carteira && imovel ? Math.min(100, (carteira / imovel) * 100) : null;
    return (
      <Passo passo={2} total={3} nome={NOME} pergunta="Quanto você dá de entrada?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Próximo</BotaoGrande>}>
        <CartaoValor
          rotulo="Entrada"
          selo={tocou.downPayment ? undefined : "Exemplo"}
          valor={entrada}
          onChange={(x) => muda("downPayment", Math.min(x, imovel))}
          sub={`${pc(pcEntrada, 0)}% do imóvel de ${r0(imovel)}. Vai financiar ${r0(Math.max(0, imovel - entrada))}.`}
        >
          <div className="relative pb-6 pt-2">
            <input
              type="range"
              aria-label="Entrada, deslizante"
              min={0}
              max={imovel}
              step={5000}
              value={Math.min(entrada, imovel)}
              onChange={(e) => muda("downPayment", Number(e.target.value))}
              className="slider-app w-full"
              style={{ ["--pct" as string]: `${Math.min(100, pcEntrada)}%` }}
            />
            {posCarteira !== null && (
              <span
                className={`absolute top-7 flex flex-col text-xs text-ink-muted ${posCarteira < 30 ? "items-start" : posCarteira > 70 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center"}`}
                style={{ left: `calc(10px + (100% - 20px) * ${(posCarteira / 100).toFixed(4)})` }}
              >
                <i className="h-2 w-0.5 rounded bg-accent" aria-hidden />
                <small className="whitespace-nowrap">Sua carteira hoje: {r0(carteira!)}</small>
              </span>
            )}
          </div>
        </CartaoValor>
        <Atalhos
          opcoes={[0.1, 0.2, 0.3].map((p) => ({ valor: Math.round(imovel * p), rotulo: `${pc(p * 100, 0)}%` }))}
          ativo={entrada}
          onEscolher={(x) => muda("downPayment", x)}
        />
      </Passo>
    );
  }

  // Passo 3: o aluguel. Se o app sabe o aluguel dela, pergunta se é esse; senão, pede o valor.
  const aluguel = Number(v.monthlyRent);
  const confirmar = !!aluguelDoApp && !outroAluguel && !tocou.monthlyRent;
  const prazoAnos = Math.round(Number(v.termMonths) / 12);
  const resumoFinos = `${prazoAnos} anos · CET ${pc(Number(v.cetAnnualRate) * 100)}% · ${v.system === "PRICE" ? "Price" : "SAC"} · rende ${pc(Number(v.investmentAnnualRate) * 100)}%`;
  return (
    <Passo
      passo={3}
      total={3}
      nome={NOME}
      pergunta={confirmar ? `Seu aluguel hoje é ${r0(aluguel)}. Certo?` : "Quanto custa o aluguel?"}
      onVoltar={voltar}
      pe={
        confirmar ? (
          <>
            <BotaoGrande secundario onClick={() => setOutroAluguel(true)}>Outro valor</BotaoGrande>
            <BotaoGrande onClick={seguir}>Sim, ver o resultado</BotaoGrande>
          </>
        ) : (
          <BotaoGrande onClick={seguir} disabled={!(aluguel > 0)}>Ver o resultado</BotaoGrande>
        )
      }
    >
      <CartaoValor
        rotulo="Aluguel"
        sufixo="por mês"
        selo={confirmar ? aluguelDoApp!.origem : tocou.monthlyRent || outroAluguel ? undefined : "Exemplo"}
        valor={aluguel}
        onChange={(x) => muda("monthlyRent", x)}
        sub="Se alugar um imóvel parecido com esse, é isso que você pagaria."
      />
      <AjustesFinos resumo={resumoFinos}>
        <CampoFino rotulo="Prazo" valor={Number(v.termMonths)} casas={0} sufixo="meses" onChange={(x) => muda("termMonths", x)} />
        <CampoFino rotulo="Custo do financiamento (CET)" valor={Number(v.cetAnnualRate) * 100} sufixo="% a.a." onChange={(x) => muda("cetAnnualRate", x / 100)} />
        <SegmentoFino rotulo="Sistema" valor={String(v.system)} opcoes={[{ valor: "SAC", rotulo: "SAC" }, { valor: "PRICE", rotulo: "Price" }]} onChange={(x) => muda("system", x)} />
        <CampoFino rotulo="Rendimento do investimento" valor={Number(v.investmentAnnualRate) * 100} sufixo="% a.a." onChange={(x) => muda("investmentAnnualRate", x / 100)} />
        <CampoFino rotulo="Valorização do imóvel" valor={Number(v.propertyAppreciationAnnualRate) * 100} sufixo="% a.a." onChange={(x) => muda("propertyAppreciationAnnualRate", x / 100)} />
        <CampoFino rotulo="Reajuste do aluguel" valor={Number(v.rentAnnualAdjustment) * 100} sufixo="% a.a." onChange={(x) => muda("rentAnnualAdjustment", x / 100)} />
        <CampoFino rotulo="Imposto de renda" valor={Number(v.incomeTaxRate) * 100} sufixo="%" onChange={(x) => muda("incomeTaxRate", x / 100)} />
      </AjustesFinos>
    </Passo>
  );
}
