"use client";

import { useState } from "react";
import { LineChart, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { EXEMPLO_MARCACAO, type ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import { valoresDoTitulo, type TituloDaCarteira } from "@/lib/calculadoras/fontes";
import { variacaoDoPreco, vereditoMarcacao } from "@/lib/calculadoras/vereditos";
import { COMO_LER } from "../campos";
import { Fim, useIrParaCalculadoras, type DadosDaTela, type SimulacaoAberta } from "../Passo";
import { AcoesDoResultado, AjustesFinos, BotaoGrande, CampoFino, IconeRedondo, Opcao, Pe, Pergunta, SegmentoFino, TopoDoAssistente, pc, useSalvar, useSimbolo } from "../pecas";

const PONTOS = [-3, -2, -1, 0, 1, 2, 3];

/**
 * Vender a renda fixa antes do prazo? (protótipo aprovado): primeiro "Qual título?", com os
 * títulos IPCA+ e prefixados da carteira dela, e depois uma tela só, ao vivo: ela arrasta a taxa
 * de hoje e vê o lucro ou o prejuízo de vender agora. A conta é a de sempre
 * (lib/simulators/mark-to-market.ts).
 *
 * A taxa da compra não está guardada no app: começa num exemplo, dito na tela, e ela troca nos
 * ajustes finos.
 */
export function MarcacaoAoVivo({ dados, salva }: { dados: DadosDaTela; salva: SimulacaoAberta }) {
  const money = useMoney();
  const simbolo = useSimbolo();
  const sair = useIrParaCalculadoras();
  const titulos = dados.titulos;
  const [titulo, setTitulo] = useState<TituloDaCarteira | null>(salva ? null : (titulos[0] ?? null));
  const [tela, setTela] = useState<"escolha" | "vivo">(salva ? "vivo" : "escolha");
  const inicial = (t: TituloDaCarteira | null): ValoresDaCalculadora => valoresDoTitulo(t, dados.anoAtual) ?? { ...EXEMPLO_MARCACAO, investedAmount: 10000 };
  const [v, setV] = useState<ValoresDaCalculadora>(salva ? { ...EXEMPLO_MARCACAO, ...salva.valores } : inicial(titulos[0] ?? null));
  const muda = (k: string, x: number | string) => setV((a) => ({ ...a, [k]: x }));
  const res = vereditoMarcacao(v);
  const nome = titulo?.nome ?? "Outro título";
  const s = useSalvar("MARCACAO_MERCADO", v, `${nome} · ${res.lucro ? "lucro" : "prejuízo"} de ${money(Math.abs(res.resultado))} se vender hoje`, salva ? JSON.stringify({ ...EXEMPLO_MARCACAO, ...salva.valores }) : null);
  const taxa = (x: number) => (titulo?.ipca ? `IPCA + ${pc(x * 100)}%` : `${pc(x * 100)}% ao ano`);

  if (tela === "escolha") {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-xl flex-col gap-5">
        <TopoDoAssistente voltar="Calculadoras" onVoltar={sair} />
        <Pergunta nome="Vender antes do prazo">Qual título?</Pergunta>
        <div className="flex flex-col gap-3">
          {titulos.map((t) => (
            <Opcao key={t.id} on={titulo?.id === t.id} onClick={() => (setTitulo(t), setV(inicial(t)))}>
              <IconeRedondo>
                <LineChart size={18} aria-hidden />
              </IconeRedondo>
              <span className="min-w-0">
                <b className="block text-[15px] font-medium text-ink">{t.nome}</b>
                <small className="text-caption text-ink-muted">Da sua carteira · {money(t.investido, { round: true })} investidos</small>
              </span>
            </Opcao>
          ))}
          <Opcao on={!titulo} onClick={() => (setTitulo(null), setV(inicial(null)))}>
            <IconeRedondo>
              <Plus size={18} aria-hidden />
            </IconeRedondo>
            <span className="min-w-0">
              <b className="block text-[15px] font-medium text-ink">Outro título</b>
              <small className="text-caption text-ink-muted">CDB, LCI, prefixado</small>
            </span>
          </Opcao>
          <p className="px-1 text-sm text-ink-muted">
            {titulo
              ? "A taxa da compra e a de hoje começam num exemplo: troque pelas suas nos ajustes."
              : "Os números começam num exemplo: troque pelos do seu título nos ajustes."}
          </p>
        </div>
        <Pe>
          <BotaoGrande onClick={() => setTela("vivo")}>Usar este</BotaoGrande>
        </Pe>
      </div>
    );
  }

  const original = Number(v.originalRate);
  const hoje = Number(v.newRate);
  const faltam = Math.round(Number(v.yearsRemaining));
  const ano = dados.anoAtual + faltam;
  const investido = titulo?.investido ?? 0;
  const lucro = res.lucro;
  const abaixo = !lucro && investido > 0 && res.vendaHoje < investido;
  const rotuloSelo = lucro ? "Lucro de" : investido > 0 && !abaixo ? "Deixa de ganhar" : "Prejuízo de";
  const numero = abaixo ? investido - res.vendaHoje : Math.abs(res.resultado);
  const minR = Math.max(0.005, original - 0.04);
  const maxR = original + 0.04;
  const linhas = [...new Set([1, 5, faltam].filter((a) => a >= 1))].sort((a, b) => a - b);
  const d0 = Math.round((hoje - original) * 100);

  return (
    <Fim>
      <div className="flex flex-col gap-0.5 px-1">
        <b className="text-[1.375rem] font-medium leading-tight text-ink">{nome}</b>
        <small className="text-sm text-ink-muted">
          {investido > 0 ? `${money(investido, { round: true })} investidos · ` : ""}faltam {faltam} {faltam === 1 ? "ano" : "anos"}
        </small>
      </div>

      <HeroiDoTema>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[15px] text-heroi-suave">Se vender hoje</span>
          <Explica noHeroi rotulo="Como ler">{COMO_LER.marcacao}</Explica>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${lucro ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{rotuloSelo}</span>
        <span aria-live="polite">
          <ValorDestaque texto={money(numero)} />
        </span>
        <span className="text-[15px] text-heroi-suave">
          {lucro
            ? res.resultado < 0.005
              ? "Hoje o mercado paga o mesmo que você comprou."
              : `O preço subiu ${pc(res.r.approximateSensitivity * 100, 1)}% porque a taxa caiu.`
            : abaixo
              ? `Vendendo hoje, sai abaixo dos ${money(investido, { round: true })} investidos. Levar até ${ano} elimina esse risco.`
              : `Levar até ${ano} rende o combinado.`}
        </span>
      </HeroiDoTema>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="glass rounded-2xl p-3.5">
          <small className="block text-caption text-ink-muted">Você comprou</small>
          <b className="text-[17px] font-medium text-ink">{taxa(original)}</b>
        </div>
        <div className="glass rounded-2xl p-3.5 shadow-[inset_0_0_0_2px_var(--color-ink)]">
          <small className="block text-caption text-ink-muted">Hoje o mercado paga</small>
          <b className="text-[17px] font-medium text-ink">{taxa(hoje)}</b>
        </div>
      </div>

      <div className="glass flex flex-col gap-2 rounded-2xl p-4">
        <span className="text-sm text-ink-muted">Arraste a taxa de hoje</span>
        <div className="relative pb-5">
          <input
            type="range"
            aria-label="Taxa de hoje, arraste"
            min={minR}
            max={maxR}
            step={0.0005}
            value={Math.min(maxR, Math.max(minR, hoje))}
            onChange={(e) => muda("newRate", Math.round(Number(e.target.value) * 10000) / 10000)}
            className="slider-app w-full"
            style={{ ["--pct" as string]: `${((Math.min(maxR, Math.max(minR, hoje)) - minR) / (maxR - minR)) * 100}%` }}
          />
          <span className="absolute top-6 flex -translate-x-1/2 flex-col items-center text-xs text-ink-muted" style={{ left: `calc(10px + (100% - 20px) * ${((original - minR) / (maxR - minR)).toFixed(4)})` }}>
            <i className="h-2 w-0.5 rounded bg-ink-muted" aria-hidden />
            Compra
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="glass rounded-2xl p-3.5">
          <small className="block text-caption text-ink-muted">Se vender hoje</small>
          <b className="text-[17px] font-medium tabular-nums text-ink">{money(res.vendaHoje)}</b>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <small className="block text-caption text-ink-muted">Na curva, até {ano}</small>
          <b className="text-[17px] font-medium tabular-nums text-ink">{money(res.naCurva)}</b>
        </div>
      </div>

      <div className="glass flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <b className="text-[15px] font-medium text-ink">Se a taxa mudar (preço em %)</b>
          <Explica rotulo="Como ler">Cada linha é quanto falta para vencer; cada coluna, quanto a taxa do mercado subiu ou caiu, em pontos. O quadrado marcado é onde você está.</Explica>
        </div>
        <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs tabular-nums">
          <thead>
            <tr className="text-ink-muted">
              <th className="w-10 font-normal">anos</th>
              {PONTOS.map((d) => (
                <th key={d} className="font-normal">{d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : "0"}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((a) => (
              <tr key={a}>
                <th className="font-normal text-ink-muted">{a}</th>
                {PONTOS.map((d) => {
                  const p = variacaoDoPreco(original, a, d);
                  const forca = Math.round(Math.min(1, Math.abs(p) / 25) * 55) + 8;
                  const eu = a === faltam && d === d0;
                  return (
                    <td
                      key={d}
                      className={`rounded-md py-1.5 text-ink ${eu ? "shadow-[inset_0_0_0_2px_var(--color-ink)]" : ""}`}
                      style={{ background: `color-mix(in srgb, ${p < 0 ? "var(--color-danger)" : "var(--color-success)"} ${Math.abs(p) < 0.5 ? 6 : forca}%, var(--color-surface))` }}
                    >
                      {p > 0.5 ? "+" : p < -0.5 ? "−" : ""}
                      {Math.abs(Math.round(p))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AjustesFinos resumo={`compra ${pc(original * 100)}% · ${faltam} ${faltam === 1 ? "ano" : "anos"} · ${v.hasSemiannualCoupons === "sim" ? "com cupom" : "sem cupom"}`}>
        <CampoFino rotulo="Taxa contratada" valor={original * 100} sufixo="% a.a." onChange={(x) => muda("originalRate", x / 100)} />
        <CampoFino rotulo="Prazo total" valor={Number(v.totalYears)} casas={0} sufixo="anos" onChange={(x) => muda("totalYears", x)} />
        <CampoFino rotulo="Anos que faltam" valor={faltam} casas={0} sufixo="anos" onChange={(x) => muda("yearsRemaining", x)} />
        <SegmentoFino rotulo="Paga cupom?" valor={String(v.hasSemiannualCoupons)} opcoes={[{ valor: "nao", rotulo: "Não" }, { valor: "sim", rotulo: "Sim" }]} onChange={(x) => muda("hasSemiannualCoupons", x)} />
        {v.hasSemiannualCoupons === "sim" && <CampoFino rotulo="Duration" valor={Number(v.duration)} sufixo="anos" onChange={(x) => muda("duration", x)} />}
        <CampoFino rotulo="Valor do título hoje" valor={Number(v.investedAmount)} casas={0} prefixo={simbolo} onChange={(x) => muda("investedAmount", x)} />
      </AjustesFinos>

      <AcoesDoResultado s={s} extra={<button type="button" onClick={() => setTela("escolha")} className="min-h-11 flex-1 rounded-full bg-surface-2 text-[15px] text-ink">Trocar o título</button>} />
    </Fim>
  );
}
