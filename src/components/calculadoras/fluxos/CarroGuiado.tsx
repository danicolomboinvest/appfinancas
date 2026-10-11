"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { EXEMPLO_CARRO, type ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import { vereditoCarro } from "@/lib/calculadoras/vereditos";
import { AoVivo } from "../AoVivo";
import { CAMPOS_CARRO, COMO_LER } from "../campos";
import { Fim, Passo, useIrParaCalculadoras, type DadosDaTela, type SimulacaoAberta } from "../Passo";
import {
  AcoesDoResultado,
  AjustesFinos,
  Atalhos,
  BotaoGrande,
  BotaoVirarMeta,
  CampoFino,
  CartaoValor,
  ContadorComFoto,
  FOTO,
  HeroiDoResultado,
  Linha,
  Opcao,
  Selo,
  pc,
  useRotuloDeAtalho,
  useSalvar,
  useSimbolo,
} from "../pecas";

const NOME = "Assinar ou comprar";

/** As cores das partes da barra empilhada: a paleta de categorias do tema. */
const COR = {
  perda: "var(--color-cat-moradia)",
  rendimento: "var(--color-cat-educacao)",
  ipva: "var(--color-cat-saude)",
  mensalidade: "var(--color-cat-transporte)",
  combustivel: "var(--color-cat-lazer)",
};

/**
 * Carro: assinar ou comprar? Três perguntas: o preço (ou a meta de carro dela), quanto vale
 * daqui a 2 anos (arrastando, em % do preço) e a mensalidade da assinatura.
 */
export function CarroGuiado({ dados, salva }: { dados: DadosDaTela; salva: SimulacaoAberta }) {
  const money = useMoney();
  const atalho = useRotuloDeAtalho();
  const simbolo = useSimbolo();
  const sair = useIrParaCalculadoras();
  const r0 = (v: number) => money(v, { round: true });
  const metaCarro = dados.metaCarro;
  const [v, setV] = useState<ValoresDaCalculadora>(salva ? { ...EXEMPLO_CARRO, ...salva.valores } : { ...EXEMPLO_CARRO });
  const [modo, setModo] = useState<"guiado" | "fim" | "vivo">(salva ? "vivo" : "guiado");
  const [passo, setPasso] = useState(1);
  const [tocou, setTocou] = useState<Record<string, boolean>>({});
  const [daMeta, setDaMeta] = useState(false);
  const muda = (k: string, x: number | string) => {
    setV((a) => ({ ...a, [k]: x }));
    setTocou((t) => ({ ...t, [k]: true }));
    if (k === "carPrice") setDaMeta(false);
  };
  const preco = Number(v.carPrice);
  const revenda = Number(v.priceAfter2Years);
  const res = vereditoCarro(v);
  const s = useSalvar("CARRO", v, `${res.veredito.frase} · ${r0(res.veredito.numero)}`);
  const metaDoCarro = { nome: "Comprar o carro", alvo: preco, foto: "carro", icone: "CARRO" as const };

  if (modo === "vivo") {
    return (
      <AoVivo
        nome="Carro: assinar ou comprar?"
        ajuda={COMO_LER.carro}
        campos={CAMPOS_CARRO}
        exemplo={EXEMPLO_CARRO}
        inicial={v}
        tipo="CARRO"
        salvaInicial={!!salva}
        onValores={setV}
        calcular={(x) => ({ veredito: vereditoCarro(x).veredito, sub: "É quanto você economiza" })}
        meta={(x) => ({ titulo: "Virar meta", sub: `Comprar o carro · ${r0(Number(x.carPrice))}`, meta: { ...metaDoCarro, alvo: Number(x.carPrice) } })}
        detalhes={(x) => {
          const r = vereditoCarro(x).r;
          return (
            <div className="glass flex flex-col divide-y divide-border rounded-2xl px-4">
              <Linha rotulo="Assinar: mensalidade + combustível" valor={r0(r.netResultSubscription)} />
              <Linha rotulo="Comprar: carro + uso − revenda" valor={r0(r.netResultPurchase)} />
              <Linha rotulo="Rendimento que o dinheiro perderia" valor={r0(r.opportunityCost)} />
            </div>
          );
        }}
      />
    );
  }

  if (modo === "fim") {
    const compra = res.r.winner === "COMPRA";
    const p = res.partesComprar;
    const a = res.partesAssinar;
    const mx = Math.max(res.r.netResultPurchase, res.r.netResultSubscription, 1);
    const pilha = (titulo: string, total: number, partes: [string, number][], vence: boolean) => (
      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2 text-[15px]">
          <span className="flex items-center gap-2">
            <b className="font-medium text-ink">{titulo}</b>
            {vence && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">vence</span>}
          </span>
          <b className="font-medium tabular-nums text-ink">{r0(total)}</b>
        </span>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" style={{ width: `${Math.max(4, (total / mx) * 100).toFixed(1)}%` }}>
          {partes.filter(([, x]) => x > 0).map(([cor, x], i) => (
            <i key={i} style={{ flex: x, background: cor }} />
          ))}
        </div>
      </div>
    );
    return (
      <Fim>
        <HeroiDoResultado
          rotulo={daMeta ? `Carro de ${r0(preco)}, da sua meta` : `Carro de ${r0(preco)}`}
          frase={`Em 24 meses, ${compra ? "comprar" : "assinar"} sai`}
          numero={r0(res.veredito.numero)}
          sub={`mais barato que ${compra ? "assinar" : "comprar"}`}
        />
        <div className="glass flex flex-col gap-4 rounded-3xl p-4">
          {pilha("Comprar", res.r.netResultPurchase, [[COR.perda, p.perdaNaRevenda], [COR.rendimento, p.rendimentoPerdido], [COR.ipva, p.ipvaESeguro], [COR.combustivel, p.combustivel]], compra)}
          {pilha("Assinar", res.r.netResultSubscription, [[COR.mensalidade, a.mensalidade], [COR.combustivel, a.combustivel]], !compra)}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-caption text-ink-muted">
            {(
              [
                ["Perda na revenda", COR.perda],
                ["Rendimento perdido", COR.rendimento],
                ["IPVA e seguro", COR.ipva],
                ["Mensalidade", COR.mensalidade],
                ["Combustível", COR.combustivel],
              ] as const
            ).map(([t, cor]) => (
              <span key={t} className="flex items-center gap-1.5">
                <i className="size-2 shrink-0 rounded-full" style={{ background: cor }} />
                {t}
              </span>
            ))}
          </div>
        </div>
        {daMeta && metaCarro ? (
          <Link href={`/planejamento/metas/${metaCarro.id}`} className="glass flex items-center gap-3 rounded-2xl p-2.5 pr-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FOTO("carro")} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-xl bg-surface-2 object-cover" />
            <span className="min-w-0 flex-1">
              <small className="block text-caption text-ink-muted">Ver minha meta</small>
              <b className="block text-[15px] font-medium text-ink">{metaCarro.nome} · {r0(metaCarro.alvo)}</b>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
          </Link>
        ) : (
          <BotaoVirarMeta titulo="Virar meta" sub={`Comprar o carro · ${r0(preco)}`} meta={metaDoCarro} />
        )}
        <AcoesDoResultado s={s} onMexer={() => setModo("vivo")} />
      </Fim>
    );
  }

  const voltar = () => (passo > 1 ? setPasso(passo - 1) : sair());
  const seguir = () => (passo < 3 ? setPasso(passo + 1) : setModo("fim"));

  if (passo === 1) {
    return (
      <Passo passo={1} total={3} nome={NOME} pergunta="Quanto custa o carro?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir} disabled={!(preco > 0)}>Próximo</BotaoGrande>}>
        <ContadorComFoto foto="carro" rotulo="Preço do carro" valor={preco} passo={1000} min={20000} selo={daMeta ? "Da sua meta" : tocou.carPrice ? undefined : "Exemplo"} onChange={(x) => muda("carPrice", x)} />
        <Atalhos opcoes={[60000, 100000, 150000].map((x) => ({ valor: x, rotulo: atalho(x) }))} ativo={preco} onEscolher={(x) => muda("carPrice", x)} />
        {metaCarro && metaCarro.alvo > 0 && (
          <Opcao
            on={daMeta}
            onClick={() => {
              // A revenda começa em 75% do preço (o mesmo ponto do exemplo); ela arrasta no passo seguinte.
              setV((a) => ({ ...a, carPrice: metaCarro.alvo, priceAfter2Years: Math.round((metaCarro.alvo * 0.75) / 100) * 100 }));
              setDaMeta(true);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FOTO("carro")} alt="" loading="lazy" decoding="async" className="size-12 shrink-0 rounded-xl bg-surface-2 object-cover" />
            <span className="min-w-0">
              <small className="block text-caption text-ink-muted">Da sua meta · {r0(metaCarro.alvo)}</small>
              <b className="block text-[15px] font-medium text-ink">Usar a sua meta {metaCarro.nome}</b>
            </span>
          </Opcao>
        )}
      </Passo>
    );
  }

  if (passo === 2) {
    const pct = preco > 0 ? Math.round((revenda / preco) * 100) : 75;
    return (
      <Passo passo={2} total={3} nome={NOME} pergunta="Quanto ele vale daqui a 2 anos?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Próximo</BotaoGrande>}>
        <div className="glass flex flex-col gap-2 rounded-3xl p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm text-ink-muted">Revenda depois de 2 anos</span>
            <Selo>{pct}% do preço</Selo>
          </div>
          <span className="text-ink"><ValorDestaque texto={r0(revenda)} /></span>
          <p className="text-sm text-ink-muted">Perde {r0(Math.max(0, preco - revenda))} do preço de {r0(preco)}.</p>
          <input
            type="range"
            aria-label="Revenda em % do preço"
            min={40}
            max={95}
            step={1}
            value={Math.min(95, Math.max(40, pct))}
            onChange={(e) => muda("priceAfter2Years", Math.round((preco * Number(e.target.value)) / 100 / 100) * 100)}
            className="slider-app mt-2 w-full"
            style={{ ["--pct" as string]: `${((Math.min(95, Math.max(40, pct)) - 40) / 55) * 100}%` }}
          />
          <div className="flex justify-between text-caption text-ink-muted">
            <span>Desvaloriza muito</span>
            <span>Segura o preço</span>
          </div>
          <p className="text-sm text-ink-muted">Arraste. Não precisa saber o valor exato.</p>
        </div>
      </Passo>
    );
  }

  const mens = Number(v.subscriptionMonthlyFee);
  const comb = Number(v.monthlyFuelCost);
  const total = mens + comb;
  const sobra = dados.sobra;
  const resumoFinos = `combustível ${r0(comb)} por mês · IPVA e seguro ${r0(Number(v.annualFixedCosts))} por ano · rende ${pc(Number(v.opportunityCostMonthlyRate) * 100)}% ao mês`;
  return (
    <Passo passo={3} total={3} nome={NOME} pergunta="Quanto é a assinatura?" onVoltar={voltar} pe={<BotaoGrande onClick={seguir}>Ver o resultado</BotaoGrande>}>
      <CartaoValor
        rotulo="Mensalidade da assinatura"
        sufixo="por mês"
        selo={tocou.subscriptionMonthlyFee ? undefined : "Exemplo"}
        valor={mens}
        onChange={(x) => muda("subscriptionMonthlyFee", x)}
        sub={`Com combustível, ${r0(total)} por mês.${sobra ? ` ${total > sobra ? "Mais que" : "Cabe na"} a sua sobra de ${r0(sobra)}, do seu orçamento.` : ""}`}
      />
      <AjustesFinos resumo={resumoFinos}>
        <CampoFino rotulo="Combustível por mês" valor={comb} casas={0} prefixo={simbolo} onChange={(x) => muda("monthlyFuelCost", x)} />
        <CampoFino rotulo="IPVA, seguro e revisões por ano" valor={Number(v.annualFixedCosts)} casas={0} prefixo={simbolo} onChange={(x) => muda("annualFixedCosts", x)} />
        <CampoFino rotulo="Rendimento do dinheiro" valor={Number(v.opportunityCostMonthlyRate) * 100} sufixo="% a.m." onChange={(x) => muda("opportunityCostMonthlyRate", x / 100)} />
      </AjustesFinos>
    </Passo>
  );
}
