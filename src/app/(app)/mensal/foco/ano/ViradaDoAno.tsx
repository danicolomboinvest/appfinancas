"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMoney } from "@/components/money/MoneyProvider";
import { comecarAnoAction } from "../actions";
import { Botao, Passo, Pontos } from "../Passos";
import type { DadosVirada } from "./dados";

const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function ViradaDoAno({ v }: { v: DadosVirada }) {
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [salvando, start] = useTransition();
  const [erro, setErro] = useState(false);
  const s = v.sugestao;
  const comecar = (modo: "sugestao" | "zerado") =>
    start(async () => {
      try {
        await comecarAnoAction(modo);
        router.push("/mensal/foco");
      } catch {
        setErro(true);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <Pontos total={3} atual={passo} />

      {passo === 0 && (
        <Passo rotulo={`1 de 3 · Seu ${v.passado}`}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">Entrou</dt>
            <dd className="text-right tabular-nums text-ink">{m(v.resumo.renda)}</dd>
            <dt className="text-ink-muted">Gastou</dt>
            <dd className="text-right tabular-nums text-ink">{m(v.resumo.gastos)}</dd>
            <dt className="text-ink-muted">Guardou</dt>
            <dd className="text-right tabular-nums text-ink">{m(v.resumo.guardado)}</dd>
            <dt className="font-semibold text-ink">Sobrou</dt>
            <dd className={`text-right font-semibold tabular-nums ${v.resumo.sobrou < 0 ? "text-danger" : "text-ink"}`}>{m(v.resumo.sobrou)}</dd>
          </dl>
          {v.resumo.pctGuardado !== null && (
            <p className="text-sm text-ink">
              Você guardou <b>{pct(v.resumo.pctGuardado)}</b> do que entrou.{" "}
              {v.resumo.pctGuardado >= 0.1 ? "Passou dos 10% que a aula pede." : "A aula pede pelo menos 10%: dá pra chegar lá em " + v.ano + "."}
            </p>
          )}
          {v.resumo.maior && (
            <p className="text-sm text-ink-muted">
              Onde mais foi dinheiro: {v.resumo.maior.label}, {m(v.resumo.maior.valor)} no ano.
            </p>
          )}
          <Botao onClick={() => setPasso(1)}>Próximo</Botao>
        </Passo>
      )}

      {passo === 1 && (
        <Passo rotulo={`2 de 3 · Sugestão pra ${v.ano}`} titulo="Com base no que você viveu, eu começaria assim:">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">Renda por mês</dt>
            <dd className="text-right tabular-nums text-ink">{m(s.renda)}</dd>
            <dt className="text-ink-muted">Guardar por mês</dt>
            <dd className="text-right tabular-nums text-ink">{m(s.guardar)}</dd>
          </dl>
          {s.categorias.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Orçamento por mês</p>
              {s.categorias.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-ink">{c.label}</span>
                    {c.motivo === "real" && (
                      <span className="block text-caption text-ink-muted">
                        O plano era {m(c.planejado)}, mas você gastou em média {m(c.realMedio)}.
                      </span>
                    )}
                    {c.motivo === "novo" && <span className="block text-caption text-ink-muted">Você gastou aqui sem ter planejado.</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">{m(c.sugerido)}</span>
                </div>
              ))}
            </div>
          )}
          {v.fixas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Contas fixas que continuam</p>
              {v.fixas.map((f) => (
                <div key={`${f.descricao}|${f.valor}`} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {f.descricao}
                    {f.dia ? <span className="text-ink-faint"> · dia {f.dia}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">{m(f.valor)}</span>
                </div>
              ))}
            </div>
          )}
          {s.renda > 0 && (
            <p className="text-sm text-ink-muted">
              {s.semDestino >= 0 ? `Sobram ${m(s.semDestino)} por mês sem destino.` : `Faltam ${m(-s.semDestino)} por mês pra conta fechar.`}
            </p>
          )}
          {s.avisos.map((a) => (
            <p key={a} className="rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-ink">
              {a}
            </p>
          ))}
          <Botao onClick={() => setPasso(2)}>Próximo</Botao>
        </Passo>
      )}

      {passo === 2 && (
        <Passo rotulo={`3 de 3 · Começar ${v.ano}`} titulo={`Como você quer começar ${v.ano}?`}>
          {v.jaTemOrcamentoNoAnoNovo && (
            <p className="text-sm text-ink-muted">Você já tem orçamento em {v.ano}. Começar com a sugestão troca os valores deste mês em diante.</p>
          )}
          {erro && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Não consegui salvar agora. Tenta de novo em instantes.</p>}
          <Botao disabled={salvando} onClick={() => comecar("sugestao")}>
            Começar com a sugestão
          </Botao>
          <Botao secundario disabled={salvando} onClick={() => comecar("zerado")}>
            Começar do zero
          </Botao>
          <p className="text-caption text-ink-faint">Dá pra mudar qualquer valor depois, no Orçamento.</p>
        </Passo>
      )}
    </div>
  );
}
