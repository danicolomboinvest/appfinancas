"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { monthlyToAnnual, annualToMonthly } from "@/lib/finance/rate-conversion";
import { EXEMPLO_AMORTIZAR, type ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import { vereditoAmortizar } from "@/lib/calculadoras/vereditos";
import { AoVivo } from "../AoVivo";
import { CAMPOS_AMORTIZAR, COMO_LER } from "../campos";
import { Fim, Passo, useIrParaCalculadoras, type DadosDaTela, type SimulacaoAberta } from "../Passo";
import { AcoesDoResultado, AjustesFinos, Atalhos, BotaoGrande, CampoFino, CartaoValor, Colunas, HeroiDoResultado, Linha, Opcao, SegmentoFino, Selo, pc, useSalvar } from "../pecas";

const NOME = "Quitar ou investir";

/**
 * Quitar a dívida antes ou investir? Três perguntas: a dívida (saldo e juros ao mês), quantas
 * parcelas faltam e quanto dá para usar agora (a sobra do mês, quitar tudo ou outro valor).
 *
 * No protótipo a primeira tela escolhe entre as dívidas cadastradas; a área Dívidas ainda não
 * existe no app, então ela digita o saldo e os juros (o caminho "Outra dívida" do protótipo).
 */
export function AmortizarGuiado({ dados, salva }: { dados: DadosDaTela; salva: SimulacaoAberta }) {
  const money = useMoney();
  const sair = useIrParaCalculadoras();
  const r0 = (v: number) => money(v, { round: true });
  // Dívida é parcela igual (Price) na maioria dos casos: o assistente começa assim; dá para trocar nos ajustes.
  const inicio: ValoresDaCalculadora = { ...EXEMPLO_AMORTIZAR, system: "PRICE" };
  const [v, setV] = useState<ValoresDaCalculadora>(salva ? { ...EXEMPLO_AMORTIZAR, ...salva.valores } : inicio);
  const [modo, setModo] = useState<"guiado" | "fim" | "vivo">(salva ? "vivo" : "guiado");
  const [passo, setPasso] = useState(1);
  const [tocou, setTocou] = useState<Record<string, boolean>>({});
  const [uso, setUso] = useState<"sobra" | "tudo" | "outro" | null>(null);
  const muda = (k: string, x: number | string) => {
    setV((a) => ({ ...a, [k]: x }));
    setTocou((t) => ({ ...t, [k]: true }));
  };
  const saldo = Number(v.outstandingBalance);
  const prazo = Number(v.remainingMonths);
  const res = vereditoAmortizar(v);
  const s = useSalvar("AMORTIZAR_VS_INVESTIR", v, `${res.veredito.frase} · ${r0(res.veredito.numero)}`);

  if (modo === "vivo") {
    return (
      <AoVivo
        nome="Quitar a dívida antes ou investir?"
        ajuda={COMO_LER.amortizar}
        campos={CAMPOS_AMORTIZAR}
        exemplo={EXEMPLO_AMORTIZAR}
        inicial={v}
        tipo="AMORTIZAR_VS_INVESTIR"
        salvaInicial={!!salva}
        onValores={setV}
        calcular={(x) => ({ veredito: vereditoAmortizar(x).veredito, sub: "É quanto um lado fica à frente no fim do prazo" })}
        detalhes={(x) => {
          const r = vereditoAmortizar(x).r;
          return (
            <>
              <div className="glass flex flex-col divide-y divide-border rounded-2xl px-4">
                <Linha rotulo="Prazo sem amortizar" valor={`${r.scheduleWithoutExtra.length} meses`} />
                <Linha rotulo="Prazo amortizando" valor={`${r.scheduleWithExtra.length} meses`} />
                <Linha rotulo="Juros sem amortizar" valor={r0(r.totalInterestWithoutExtra)} />
                <Linha rotulo="Juros amortizando" valor={r0(r.totalInterestWithExtra)} />
                <Linha rotulo="Rendimento líquido" valor={`${pc(r.netInvestmentAnnualRate * 100, 1)}% a.a.`} />
              </div>
              <p className="px-1 text-caption text-ink-muted">Para comparar de forma justa, cada parcela que deixa de ser paga é investida até o fim do prazo original.</p>
            </>
          );
        }}
      />
    );
  }

  if (modo === "fim") {
    const r = res.r;
    const quita = r.winner === "AMORTIZAR";
    const tudo = Number(v.extraAmount) >= saldo;
    const dividaMes = res.dividaAoMes * 100;
    const rendeMes = res.rendeAoMes * 100;
    return (
      <Fim>
        <HeroiDoResultado
          rotulo={`Dívida de ${r0(saldo)} · em ${prazo} ${prazo === 1 ? "mês" : "meses"}`}
          frase={quita ? "Quitar rende" : "Investir rende"}
          numero={r0(res.veredito.numero)}
          sub={quita ? "a mais que investir" : "a mais que quitar"}
        />
        <Colunas
          itens={[
            { rotulo: "Ganho ao quitar", valor: r.amortizeGain, vence: quita },
            { rotulo: "Ganho ao investir", valor: r.investmentGain, vence: !quita },
          ]}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="glass rounded-2xl p-3.5">
            <small className="block text-caption text-ink-muted">A dívida custa</small>
            <b className={`text-[17px] font-medium ${dividaMes > rendeMes ? "text-danger" : "text-ink"}`}>{pc(dividaMes, 1)}% ao mês</b>
          </div>
          <div className="glass rounded-2xl p-3.5">
            <small className="block text-caption text-ink-muted">O dinheiro rende</small>
            <b className={`text-[17px] font-medium ${rendeMes >= dividaMes ? "text-success" : "text-ink"}`}>{pc(rendeMes, 1)}% ao mês</b>
          </div>
        </div>
        <p className="px-1 text-[15px] text-ink">
          {tudo ? (
            <>Você fica livre hoje e não paga <b>{r0(r.totalInterestWithoutExtra)}</b> de juros.</>
          ) : (
            <>Você deixa de pagar <b>{r0(r.interestSavings)}</b> de juros.</>
          )}
        </p>
        <AcoesDoResultado s={s} onMexer={() => setModo("vivo")} />
      </Fim>
    );
  }

  const voltar = () => (passo > 1 ? setPasso(passo - 1) : sair());
  const seguir = () => {
    if (passo === 2 && !uso && dados.sobra) {
      // Como no protótipo: a sobra do mês já vem escolhida.
      setUso("sobra");
      setV((a) => ({ ...a, extraAmount: Math.min(dados.sobra!, saldo) }));
    }
    if (passo < 3) setPasso(passo + 1);
    else setModo("fim");
  };
  const jurosAoMes = annualToMonthly(Number(v.cetAnnualRate)).toNumber() * 100;

  if (passo === 1) {
    return (
      <Passo passo={1} total={3} nome={NOME} pergunta="Quanto você ainda deve?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!(saldo > 0)}>Próximo</BotaoGrande>}>
        <CartaoValor rotulo="Saldo devedor" selo={tocou.outstandingBalance ? undefined : "Exemplo"} valor={saldo} onChange={(x) => muda("outstandingBalance", x)} sub="O quanto falta pagar hoje, no app do banco ou no boleto." />
        <div className="glass rounded-2xl px-4">
          <CampoFino rotulo="Juros ao mês" valor={jurosAoMes} sufixo="% ao mês" onChange={(x) => muda("cetAnnualRate", monthlyToAnnual(x / 100).toNumber())} />
        </div>
      </Passo>
    );
  }

  if (passo === 2) {
    const parcela = res.r.scheduleWithoutExtra[0]?.payment ?? 0;
    const ajusta = (d: number) => muda("remainingMonths", Math.max(1, prazo + d));
    return (
      <Passo passo={2} total={3} nome={NOME} pergunta="Quantas parcelas faltam?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!(prazo >= 1)}>Próximo</BotaoGrande>}>
        <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-6">
          <div className="flex items-center gap-6">
            <button type="button" aria-label="Menos uma" disabled={prazo <= 1} onClick={() => ajusta(-1)} className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40">
              <Minus size={20} aria-hidden />
            </button>
            <span className="flex flex-col items-center">
              <b className="text-[2.75rem] font-light leading-none tabular-nums text-ink">{prazo}</b>
              <small className="text-sm text-ink-muted">parcelas</small>
            </span>
            <button type="button" aria-label="Mais uma" onClick={() => ajusta(1)} className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink">
              <Plus size={20} aria-hidden />
            </button>
          </div>
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            de {r0(parcela)} por mês {!tocou.remainingMonths && <Selo>Exemplo</Selo>}
          </p>
        </div>
        <Atalhos opcoes={[12, 24, 36, 120, 240].map((x) => ({ valor: x, rotulo: String(x) }))} ativo={prazo} onEscolher={(x) => muda("remainingMonths", x)} />
      </Passo>
    );
  }

  const sobra = dados.sobra;
  const escolhido = uso ?? (tocou.extraAmount ? "outro" : null);
  const resumoFinos = `rende ${pc(Number(v.investmentAnnualRate) * 100)}% ao ano · IR ${pc(Number(v.incomeTaxRate) * 100, 1)}% · ${v.system === "PRICE" ? "Price" : "SAC"}`;
  const usar = (k: "sobra" | "tudo" | "outro") => {
    setUso(k);
    if (k === "sobra" && sobra) setV((a) => ({ ...a, extraAmount: Math.min(sobra, saldo) }));
    if (k === "tudo") setV((a) => ({ ...a, extraAmount: saldo }));
  };
  return (
    <Passo passo={3} total={3} nome={NOME} pergunta="Quanto dá para usar agora?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!escolhido || !(Number(v.extraAmount) > 0)}>Ver o resultado</BotaoGrande>}>
      {sobra && (
        <Opcao on={escolhido === "sobra"} onClick={() => usar("sobra")}>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-medium text-ink">A sobra do mês</b>
            <small className="text-caption text-ink-muted">Do seu orçamento</small>
          </span>
          <em className="shrink-0 text-[15px] not-italic tabular-nums text-ink">{r0(sobra)}</em>
        </Opcao>
      )}
      <Opcao on={escolhido === "tudo"} onClick={() => usar("tudo")}>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-medium text-ink">Quitar tudo</b>
          <small className="text-caption text-ink-muted">O saldo da dívida</small>
        </span>
        <em className="shrink-0 text-[15px] not-italic tabular-nums text-ink">{r0(saldo)}</em>
      </Opcao>
      <Opcao on={escolhido === "outro"} onClick={() => usar("outro")}>
        <b className="text-[15px] font-medium text-ink">Outro valor</b>
      </Opcao>
      {escolhido === "outro" && <CartaoValor rotulo="Quanto dá para usar" valor={Number(v.extraAmount)} onChange={(x) => muda("extraAmount", x)} />}
      <AjustesFinos resumo={resumoFinos}>
        <CampoFino rotulo="Rendimento do investimento" valor={Number(v.investmentAnnualRate) * 100} sufixo="% a.a." onChange={(x) => muda("investmentAnnualRate", x / 100)} />
        <SegmentoFino rotulo="Imposto de renda" valor={String(Number(v.incomeTaxRate))} opcoes={[{ valor: "0", rotulo: "0%" }, { valor: "0.15", rotulo: "15%" }, { valor: "0.225", rotulo: "22,5%" }]} onChange={(x) => muda("incomeTaxRate", Number(x))} />
        <SegmentoFino rotulo="Sistema" valor={String(v.system)} opcoes={[{ valor: "PRICE", rotulo: "Price" }, { valor: "SAC", rotulo: "SAC" }]} onChange={(x) => muda("system", x)} />
      </AjustesFinos>
    </Passo>
  );
}
