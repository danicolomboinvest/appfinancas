"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { contaDaLiberdade, patrimonioNecessario, prazoDaLiberdade, type ValoresDaLiberdade } from "@/lib/calculadoras/liberdade";
import { salvarLiberdadeComoMetaAction } from "@/app/(app)/simuladores/liberdade/actions";
import { Fim, Passo, useIrParaCalculadoras } from "../Passo";
import { AjustesFinos, Atalhos, BotaoGrande, CampoFino, CartaoValor, Colunas, FALHOU_AO_SALVAR, HeroiDoResultado, Selo, pc, useSimbolo } from "../pecas";

const NOME = "Liberdade financeira";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Liberdade financeira, a calculadora (11/10/2026): a Aposentadoria saiu de Metas e virou uma
 * calculadora guiada, como as outras. Cinco perguntas, uma por tela (quanto quer por mês, a
 * idade, com que idade quer parar, quanto já tem e quanto guarda), o resultado em destaque,
 * "Mexer nos números" e "Salvar como meta". A conta é a de sempre (lib/calculadoras/liberdade.ts).
 */
export function LiberdadeGuiada({
  inicial,
  jaSalva,
  origem,
  hoje,
}: {
  inicial: ValoresDaLiberdade;
  /** Ela já tinha a conta salva (Aposentadoria antiga ou esta calculadora): abre no resultado. */
  jaSalva: boolean;
  /** De onde veio cada número puxado do app ("Da sua carteira"). */
  origem: { patrimonio?: string; porMes?: string };
  hoje: { ano: number; mes: number };
}) {
  const money = useMoney();
  const simbolo = useSimbolo();
  const sair = useIrParaCalculadoras();
  const { showError } = useToast();
  const [v, setV] = useState<ValoresDaLiberdade>(inicial);
  const [passo, setPasso] = useState(jaSalva ? 6 : 1);
  const [mexendo, setMexendo] = useState(false);
  const [tocou, setTocou] = useState<Record<string, boolean>>({});
  const [salvando, iniciar] = useTransition();
  const [salvaComo, setSalvaComo] = useState<string | null>(null);
  const muda = (k: keyof ValoresDaLiberdade, x: number) => {
    setV((a) => ({ ...a, [k]: x }));
    setTocou((t) => ({ ...t, [k]: true }));
    setSalvaComo(null);
  };
  const r0 = (x: number) => money(x, { round: true });
  const TOTAL = 5;
  const voltar = () => (passo > 1 ? setPasso(passo - 1) : sair());
  const seguir = () => setPasso(passo + 1);
  const exemplo = (k: string) => (tocou[k] || jaSalva ? undefined : "Exemplo");

  const contador = (k: "idade" | "idadeParar", min: number, max: number, rotulo: string) => {
    const valor = v[k];
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-6">
        <div className="flex items-center gap-6">
          <button type="button" aria-label="Menos um" disabled={valor <= min} onClick={() => muda(k, Math.max(min, valor - 1))} className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40">
            <Minus size={20} aria-hidden />
          </button>
          <span className="flex flex-col items-center">
            <b className="text-[2.75rem] font-light leading-none tabular-nums text-ink">{valor}</b>
            <small className="text-sm text-ink-muted">{rotulo}</small>
          </span>
          <button type="button" aria-label="Mais um" disabled={valor >= max} onClick={() => muda(k, Math.min(max, valor + 1))} className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40">
            <Plus size={20} aria-hidden />
          </button>
        </div>
        {exemplo(k) && <Selo>Exemplo</Selo>}
      </div>
    );
  };

  if (passo === 1)
    return (
      <Passo passo={1} total={TOTAL} nome={NOME} pergunta="Quanto você quer por mês?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!(v.rendaDesejada > 0)}>Próximo</BotaoGrande>}>
        <CartaoValor rotulo="Por mês, em dinheiro de hoje" selo={exemplo("rendaDesejada")} valor={v.rendaDesejada} onChange={(x) => muda("rendaDesejada", x)} sub="A vida que você quer levar quando parar de trabalhar." />
        <Atalhos opcoes={[5000, 8000, 12000, 20000].map((x) => ({ valor: x, rotulo: r0(x) }))} ativo={v.rendaDesejada} onEscolher={(x) => muda("rendaDesejada", x)} />
      </Passo>
    );
  if (passo === 2)
    return (
      <Passo passo={2} total={TOTAL} nome={NOME} pergunta="Quantos anos você tem?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Próximo</BotaoGrande>}>
        {contador("idade", 14, 90, "anos")}
      </Passo>
    );
  if (passo === 3)
    return (
      <Passo passo={3} total={TOTAL} nome={NOME} pergunta="Com que idade quer parar?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!(v.idadeParar > v.idade)}>Próximo</BotaoGrande>}>
        {contador("idadeParar", v.idade + 1, 100, `daqui a ${Math.max(0, v.idadeParar - v.idade)} anos`)}
        <Atalhos opcoes={[50, 55, 60, 65].filter((x) => x > v.idade).map((x) => ({ valor: x, rotulo: `${x} anos` }))} ativo={v.idadeParar} onEscolher={(x) => muda("idadeParar", x)} />
      </Passo>
    );
  if (passo === 4)
    return (
      <Passo passo={4} total={TOTAL} nome={NOME} pergunta="Quanto você já tem investido?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Próximo</BotaoGrande>}>
        <CartaoValor rotulo="Investido hoje" selo={tocou.patrimonio ? undefined : origem.patrimonio ? undefined : exemplo("patrimonio")} valor={v.patrimonio} onChange={(x) => muda("patrimonio", x)} sub={origem.patrimonio && !tocou.patrimonio ? origem.patrimonio : "Pode ser zero."} />
      </Passo>
    );
  if (passo === 5)
    return (
      <Passo passo={5} total={TOTAL} nome={NOME} pergunta="Quanto você guarda por mês?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Ver o resultado</BotaoGrande>}>
        <CartaoValor rotulo="Por mês" selo={tocou.porMes ? undefined : origem.porMes ? undefined : exemplo("porMes")} valor={v.porMes} onChange={(x) => muda("porMes", x)} sub={origem.porMes && !tocou.porMes ? origem.porMes : "O que vai para os investimentos todo mês."} />
        <Atalhos opcoes={[500, 1000, 2000, 3000].map((x) => ({ valor: x, rotulo: r0(x) }))} ativo={v.porMes} onEscolher={(x) => muda("porMes", x)} />
      </Passo>
    );

  // O resultado.
  const r = contaDaLiberdade(v);
  const precisa = patrimonioNecessario(v);
  const prazo = prazoDaLiberdade(v, new Date(hoje.ano, hoje.mes - 1, 1));
  const daPe = r.daPe;
  const salvar = () =>
    iniciar(async () => {
      const res = await salvarLiberdadeComoMetaAction(v).catch(() => null);
      if (!res) return showError(FALHOU_AO_SALVAR);
      if (!res.ok) return showError(res.erro);
      // Sem aviso (14/10/2026): o botão vira o atalho para a meta.
      setSalvaComo(res.id);
    });

  return (
    <Fim onVoltar={() => setPasso(5)} voltar="Voltar">
      <HeroiDoResultado
        rotulo={`Aos ${v.idadeParar} anos, em dinheiro de hoje`}
        frase="Você terá"
        numero={r0(r.acumulo.finalValueReal)}
        sub={<>Isso paga {r0(r.renda.totalPassiveIncome)} por mês</>}
        tom={daPe ? "bom" : undefined}
      >
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${daPe ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {daPe ? `Sobram ${r0(r.renda.surplusOrDeficit)} por mês` : `Faltam ${r0(Math.abs(r.renda.surplusOrDeficit))} por mês`}
        </span>
      </HeroiDoResultado>
      <Colunas
        itens={[
          { rotulo: "Você quer por mês", valor: v.rendaDesejada, vence: !daPe },
          { rotulo: "A conta paga por mês", valor: r.renda.totalPassiveIncome, vence: daPe },
        ]}
      />
      {precisa !== null && (
        <p className="px-1 text-[15px] text-ink">
          Para {r0(v.rendaDesejada)} por mês, você precisa juntar <b>{r0(precisa)}</b> até {MESES[prazo.mes - 1]} de {prazo.ano}.
        </p>
      )}

      {mexendo && (
        <AjustesFinos resumo={`rende ${pc(v.rendimento * 100)}% ao ano · inflação ${pc(v.inflacao * 100)}% · ${pc(v.rendimentoNaRenda * 100)}% na renda`}>
          <CampoFino rotulo="Quanto quer por mês" valor={v.rendaDesejada} casas={0} prefixo={simbolo} onChange={(x) => muda("rendaDesejada", x)} />
          <CampoFino rotulo="Idade hoje" valor={v.idade} casas={0} sufixo="anos" onChange={(x) => muda("idade", x)} />
          <CampoFino rotulo="Idade de parar" valor={v.idadeParar} casas={0} sufixo="anos" onChange={(x) => muda("idadeParar", x)} />
          <CampoFino rotulo="Investido hoje" valor={v.patrimonio} casas={0} prefixo={simbolo} onChange={(x) => muda("patrimonio", x)} />
          <CampoFino rotulo="Guarda por mês" valor={v.porMes} casas={0} prefixo={simbolo} onChange={(x) => muda("porMes", x)} />
          <CampoFino rotulo="Rendimento até parar" valor={v.rendimento * 100} sufixo="% a.a." onChange={(x) => muda("rendimento", x / 100)} />
          <CampoFino rotulo="Inflação" valor={v.inflacao * 100} sufixo="% a.a." onChange={(x) => muda("inflacao", x / 100)} />
          <CampoFino rotulo="Rendimento vivendo de renda" valor={v.rendimentoNaRenda * 100} sufixo="% a.a." onChange={(x) => muda("rendimentoNaRenda", x / 100)} />
          <CampoFino rotulo="Outra renda (aluguel, INSS)" valor={v.outraRenda} casas={0} prefixo={simbolo} onChange={(x) => muda("outraRenda", x)} />
        </AjustesFinos>
      )}

      <div className="flex flex-col gap-2.5 pt-1">
        {salvaComo ? (
          <Link href={`/planejamento/metas/${salvaComo}`} className="flex min-h-12 items-center justify-center rounded-full border border-border-strong bg-surface px-5 text-[15px] font-medium text-ink">
            Ver a meta
          </Link>
        ) : (
          <BotaoGrande onClick={salvar} disabled={salvando || precisa === null}>
            {salvando ? "Salvando…" : "Salvar como meta"}
          </BotaoGrande>
        )}
        {!mexendo && (
          <BotaoGrande secundario onClick={() => setMexendo(true)}>
            Mexer nos números
          </BotaoGrande>
        )}
      </div>
      <p className="px-1 pb-2 text-caption text-ink-muted">Em dinheiro de hoje: a conta já desconta a inflação. Não é recomendação de investimento.</p>
    </Fim>
  );
}
