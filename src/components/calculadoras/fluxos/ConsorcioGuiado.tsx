"use client";

import { useState } from "react";
import { Home, Tag } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { EXEMPLO_CONSORCIO, valorInicialDoBem, type ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import { vereditoConsorcio } from "@/lib/calculadoras/vereditos";
import { AoVivo } from "../AoVivo";
import { CAMPOS_CONSORCIO, COMO_LER } from "../campos";
import { Fim, Passo, useIrParaCalculadoras, type DadosDaTela, type SimulacaoAberta } from "../Passo";
import {
  AcoesDoResultado,
  AjustesFinos,
  Alerta,
  Atalhos,
  BotaoGrande,
  CampoFino,
  CartaoValor,
  Colunas,
  ContadorComFoto,
  FOTO,
  HeroiDoResultado,
  IconeRedondo,
  Linha,
  Opcao,
  SegmentoFino,
  Selo,
  pc,
  useDinheiroParaGuardar,
  useRotuloDeAtalho,
  useSalvar,
} from "../pecas";

const NOME = "Consórcio ou financiar";
type Bem = "meta" | "imovel" | "outro";

/**
 * Consórcio ou financiamento? Quatro perguntas: o que quer comprar (a meta de carro dela, quando
 * existe), quanto custa, a entrada (o que já está guardado na meta, se houver) e em quanto tempo.
 */
export function ConsorcioGuiado({ dados, salva }: { dados: DadosDaTela; salva: SimulacaoAberta }) {
  const money = useMoney();
  const atalho = useRotuloDeAtalho();
  const sair = useIrParaCalculadoras();
  const r0 = (v: number) => money(v, { round: true });
  const metaCarro = dados.metaCarro;
  const [modo, setModo] = useState<"guiado" | "fim" | "vivo">(salva ? "vivo" : "guiado");
  const [passo, setPasso] = useState(1);
  const [bem, setBem] = useState<Bem | null>(metaCarro ? "meta" : null);
  // Com a meta de carro já escolhida de partida, o preço começa no dela.
  const [v, setV] = useState<ValoresDaCalculadora>(salva ? { ...EXEMPLO_CONSORCIO, ...salva.valores } : { ...EXEMPLO_CONSORCIO, creditValue: valorInicialDoBem(metaCarro ? "meta" : null, metaCarro?.alvo) });
  const [tocou, setTocou] = useState<Record<string, boolean>>({});
  const [outraEntrada, setOutraEntrada] = useState(false);
  const muda = (k: string, x: number | string) => {
    setV((a) => ({ ...a, [k]: x }));
    setTocou((t) => ({ ...t, [k]: true }));
  };
  const valorDoBem = Number(v.creditValue);
  const res = vereditoConsorcio(v);
  const guardar = useDinheiroParaGuardar();
  const s = useSalvar("CONSORCIO_VS_FINANCIAMENTO", v, res.veredito.erro ?? `${res.veredito.frase} · ${guardar(res.veredito.numero, { round: true })}`);
  const usaMeta = bem === "meta" && metaCarro && metaCarro.guardado > 0 && !outraEntrada;

  if (modo === "vivo") {
    return (
      <AoVivo
        nome="Consórcio ou financiamento?"
        ajuda={COMO_LER.consorcio}
        campos={CAMPOS_CONSORCIO}
        exemplo={EXEMPLO_CONSORCIO}
        inicial={v}
        tipo="CONSORCIO_VS_FINANCIAMENTO"
        salvaInicial={!!salva || s.salva}
        onValores={setV}
        calcular={(x) => ({ veredito: vereditoConsorcio(x).veredito, sub: "É a diferença de custo entre os dois" })}
        detalhes={(x) => {
          const r = vereditoConsorcio(x).r;
          return (
            <div className="glass flex flex-col divide-y divide-border rounded-2xl px-4">
              <Linha rotulo="Parcela do consórcio" valor={money(r.consortium.installment)} />
              <Linha rotulo="1ª parcela do financiamento" valor={money(r.financing.firstInstallment)} />
              <Linha rotulo="Juros do financiamento" valor={r0(r.financing.operationCost)} />
              <Linha rotulo="Rendimento que a entrada perderia" valor={r0(r.financing.downPaymentOpportunityCost)} />
            </div>
          );
        }}
      />
    );
  }

  const nomeDoBem = bem === "imovel" ? "Imóvel" : bem === "meta" ? "Carro" : "Bem";

  if (modo === "fim") {
    const anos = Math.round(Number(v.consortiumTermMonths) / 12);
    const consorcio = res.r.winner === "CONSORCIO";
    return (
      <Fim>
        {res.veredito.erro ? (
          <Alerta>{res.veredito.erro}</Alerta>
        ) : (
          <>
            <HeroiDoResultado
              rotulo={`${nomeDoBem} de ${r0(valorDoBem)} · em ${anos} ${anos === 1 ? "ano" : "anos"}`}
              frase={consorcio ? "O consórcio custa" : "O financiamento custa"}
              numero={r0(res.veredito.numero)}
              sub="a menos, somando taxa e juros"
            />
            <Colunas
              itens={[
                { rotulo: "Consórcio", valor: res.r.consortium.operationCost, vence: consorcio },
                { rotulo: "Financiamento", valor: res.r.financing.totalCostWithOpportunity, vence: !consorcio },
              ]}
            />
            <div className="glass flex flex-col divide-y divide-border rounded-2xl px-4">
              <p className="py-3 text-[15px] font-medium text-ink">Quando {bem === "imovel" ? "o imóvel" : bem === "meta" ? "o carro" : "o bem"} chega</p>
              <Linha rotulo="Financiamento" valor="hoje" />
              <Linha rotulo="Consórcio" valor="no sorteio ou no lance" />
            </div>
          </>
        )}
        <AcoesDoResultado s={res.veredito.erro ? null : s} onMexer={() => setModo("vivo")} />
      </Fim>
    );
  }

  const voltar = () => (passo > 1 ? (setOutraEntrada(false), setPasso(passo - 1)) : sair());
  const seguir = () => {
    // "Sim, usar": o guardado na meta vira a entrada.
    if (passo === 3 && usaMeta) setV((a) => ({ ...a, financingDownPayment: Math.min(metaCarro!.guardado, Number(a.creditValue)) }));
    setOutraEntrada(false);
    if (passo < 4) setPasso(passo + 1);
    else setModo("fim");
  };
  const escolheBem = (b: Bem) => {
    setBem(b);
    // A meta de carro já diz quanto o carro custa (14/10/2026: antes vinha o exemplo de R$ 100 mil
    // ao lado de "28% de R$ 30.000" da meta, dois preços para o mesmo carro).
    if (!tocou.creditValue) setV((a) => ({ ...a, creditValue: valorInicialDoBem(b, metaCarro?.alvo) }));
  };

  if (passo === 1) {
    return (
      <Passo passo={1} total={4} nome={NOME} pergunta="O que você quer comprar?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!bem}>Próximo</BotaoGrande>}>
        {metaCarro && (
          <Opcao on={bem === "meta"} onClick={() => escolheBem("meta")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FOTO("carro")} alt="" loading="lazy" decoding="async" className="size-12 shrink-0 rounded-xl bg-surface-2 object-cover" />
            <span className="min-w-0">
              <small className="block text-caption text-ink-muted">Sua meta</small>
              <b className="block text-[15px] font-medium text-ink">Carro · {metaCarro.nome}</b>
            </span>
          </Opcao>
        )}
        <Opcao on={bem === "imovel"} onClick={() => escolheBem("imovel")}>
          <IconeRedondo>
            <Home size={18} aria-hidden />
          </IconeRedondo>
          <b className="text-[15px] font-medium text-ink">Imóvel</b>
        </Opcao>
        <Opcao on={bem === "outro"} onClick={() => escolheBem("outro")}>
          <IconeRedondo>
            <Tag size={18} aria-hidden />
          </IconeRedondo>
          <b className="text-[15px] font-medium text-ink">Outro bem</b>
        </Opcao>
      </Passo>
    );
  }

  if (passo === 2) {
    const imovel = bem === "imovel";
    return (
      <Passo
        passo={2}
        total={4}
        nome={NOME}
        pergunta={imovel ? "Quanto custa o imóvel?" : bem === "meta" ? "Quanto custa o carro?" : "Quanto custa?"}
        onVoltar={voltar}
        pe={<BotaoGrande onClick={seguir} disabled={!(valorDoBem > 0)}>Próximo</BotaoGrande>}
      >
        <ContadorComFoto
          foto={imovel ? "apartamento" : bem === "meta" ? "carro" : "presente"}
          rotulo={imovel ? "O imóvel" : bem === "meta" ? "O carro" : "O bem"}
          valor={valorDoBem}
          passo={imovel ? 10000 : 1000}
          min={10000}
          selo={tocou.creditValue ? undefined : bem === "meta" && metaCarro && metaCarro.alvo > 0 ? "Da sua meta" : "Exemplo"}
          onChange={(x) => muda("creditValue", x)}
        />
        <Atalhos opcoes={(imovel ? [300000, 500000, 800000] : [60000, 100000, 150000]).map((x) => ({ valor: x, rotulo: atalho(x) }))} ativo={valorDoBem} onEscolher={(x) => muda("creditValue", x)} />
      </Passo>
    );
  }

  if (passo === 3) {
    if (usaMeta) {
      return (
        <Passo
          passo={3}
          total={4}
          nome={NOME}
          pergunta={`Você já tem ${r0(metaCarro!.guardado)} para o carro.`}
          onVoltar={voltar}
          pe={
            <>
              <BotaoGrande secundario onClick={() => setOutraEntrada(true)}>Outro valor</BotaoGrande>
              <BotaoGrande onClick={seguir}>Sim, usar</BotaoGrande>
            </>
          }
        >
          <div className="glass flex flex-col gap-2 rounded-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-ink-muted">Guardado na meta</span>
              <Selo>Da sua meta · {metaCarro!.nome}</Selo>
            </div>
            <span className="text-ink"><ValorDestaque texto={r0(metaCarro!.guardado)} /></span>
            {metaCarro!.alvo > 0 && <p className="text-sm text-ink-muted">{pc((metaCarro!.guardado / metaCarro!.alvo) * 100, 0)}% de {r0(metaCarro!.alvo)}</p>}
          </div>
          <p className="px-1 text-[15px] leading-snug text-ink">
            Usar como entrada? Aí falta financiar <b>{r0(Math.max(0, valorDoBem - metaCarro!.guardado))}</b> dos {r0(valorDoBem)} do preço.
          </p>
        </Passo>
      );
    }
    const entrada = Number(v.financingDownPayment);
    return (
      <Passo passo={3} total={4} nome={NOME} pergunta="Quanto você dá de entrada?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Próximo</BotaoGrande>}>
        <CartaoValor
          rotulo="Entrada"
          selo={tocou.financingDownPayment ? undefined : "Exemplo"}
          valor={entrada}
          onChange={(x) => muda("financingDownPayment", Math.min(x, valorDoBem))}
          sub={`Vai financiar ${r0(Math.max(0, valorDoBem - entrada))}.`}
        />
      </Passo>
    );
  }

  const resumoFinos = `administração ${pc(Number(v.consortiumAdminFeeRate) * 100)}% · CET ${pc(Number(v.financingCetAnnualRate) * 100)}% · ${v.financingSystem === "SAC" ? "SAC" : "Price"}`;
  return (
    <Passo passo={4} total={4} nome={NOME} pergunta="Em quanto tempo quer pagar?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Ver o resultado</BotaoGrande>}>
      {[5, 10, 15].map((anos) => {
        const meses = anos * 12;
        const on = Number(v.consortiumTermMonths) === meses;
        // A parcela do consórcio para esse prazo sai da mesma conta (lib/simulators/consortium.ts).
        const parcela = vereditoConsorcio({ ...v, consortiumTermMonths: meses }).r.consortium.installment;
        return (
          <Opcao
            key={anos}
            on={on}
            onClick={() => {
              setV((a) => ({ ...a, consortiumTermMonths: meses, ...(tocou.financingTermMonths ? {} : { financingTermMonths: meses }) }));
            }}
          >
            <span className="min-w-0">
              <b className="block text-[15px] font-medium text-ink">{anos} anos</b>
              <small className="text-caption text-ink-muted">Parcela do consórcio: {r0(parcela)} por mês</small>
            </span>
          </Opcao>
        );
      })}
      <AjustesFinos resumo={resumoFinos}>
        <CampoFino rotulo="Taxa de administração total" valor={Number(v.consortiumAdminFeeRate) * 100} sufixo="%" onChange={(x) => muda("consortiumAdminFeeRate", x / 100)} />
        <CampoFino rotulo="Custo do financiamento (CET)" valor={Number(v.financingCetAnnualRate) * 100} sufixo="% a.a." onChange={(x) => muda("financingCetAnnualRate", x / 100)} />
        <SegmentoFino rotulo="Sistema" valor={String(v.financingSystem)} opcoes={[{ valor: "PRICE", rotulo: "Price" }, { valor: "SAC", rotulo: "SAC" }]} onChange={(x) => muda("financingSystem", x)} />
        <CampoFino rotulo="Prazo do financiamento" valor={Number(v.financingTermMonths)} casas={0} sufixo="meses" onChange={(x) => muda("financingTermMonths", x)} />
        <CampoFino rotulo="Rendimento que a entrada teria" valor={Number(v.opportunityCostAnnualRate) * 100} sufixo="% a.a." onChange={(x) => muda("opportunityCostAnnualRate", x / 100)} />
      </AjustesFinos>
    </Passo>
  );
}
