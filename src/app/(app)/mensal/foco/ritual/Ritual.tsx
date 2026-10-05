"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { concluirRitualAction, definirTetoAction, dispensarAvisoAction, registrarAporteDoMesAction } from "../actions";
import { Botao, Passo, Pontos } from "../Passos";

export type DadosRitual = {
  semana: string;
  semanaPassada: { total: number; media: number | null; maior: { label: string; valor: number } | null };
  /** `avisoId`: o mesmo aviso do Foco ("estouro-LAZER"), pra "Foi só dessa vez" dispensar ele lá também. */
  alvo: { key: string; label: string; uso: number; gasto: number; planejado: number; sobra: number; diasRestantes: number; avisoId: string } | null;
  aporteFaltando: number;
  /** null = sem orçamento: não existe "livre" pra mostrar. */
  livreSemana: number | null;
  porCategoria: { key: string; label: string; semana: number }[];
};

export function Ritual({ d }: { d: DadosRitual }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [escolhas, setEscolhas] = useState<string[]>([]);
  const [salvando, start] = useTransition();
  const seguir = (escolha?: string) => {
    if (escolha) setEscolhas((e) => [...e, escolha]);
    setPasso((p) => p + 1);
  };
  const { showError } = useToast();
  // Igual ao Fechamento: uma gravação que falha (internet, sessão expirada) vira aviso no mesmo
  // passo, em vez de derrubar o app inteiro na tela de erro; o passo só avança se deu certo.
  const gravar = (acao: () => Promise<void>) =>
    start(async () => {
      try {
        await acao();
      } catch (err) {
        console.error("Ritual: a gravação falhou", err);
        showError(t.acaoFalhou);
      }
    });

  const variacao = d.semanaPassada.media && d.semanaPassada.media > 0 ? (d.semanaPassada.total - d.semanaPassada.media) / d.semanaPassada.media : null;

  return (
    <div className="flex flex-col gap-4" data-guia="ritual">
      <Pontos total={4} atual={passo} />

      {passo === 0 && (
        <Passo rotulo={`1 de 4 · ${t.ritSemanaPassada}`}>
          {d.semanaPassada.total > 0 ? (
            <>
              <p className="text-[2rem] font-bold leading-none tracking-tight tabular-nums text-ink">{m(d.semanaPassada.total)}</p>
              {variacao !== null && (
                <p className="text-sm text-ink-muted">
                  Sua média é {m(d.semanaPassada.media ?? 0)} por semana:{" "}
                  <b className={variacao > 0.05 ? "text-accent-strong" : "text-success"}>
                    {variacao > 0.05 ? `${Math.round(variacao * 100)}% acima` : variacao < -0.05 ? `${Math.round(-variacao * 100)}% abaixo` : "no ritmo"}
                  </b>
                  .
                </p>
              )}
              {d.semanaPassada.maior && (
                <p className="text-sm text-ink-muted">
                  O que mais pesou: {d.semanaPassada.maior.label}, {m(d.semanaPassada.maior.valor)}.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">Não achei gasto com data na semana passada. Se ainda não importou o extrato, vale importar pra eu enxergar a semana.</p>
          )}
          <Botao onClick={() => seguir()}>Próximo</Botao>
        </Passo>
      )}

      {passo === 1 && (
        <Passo
          rotulo={`2 de 4 · ${t.ritAtencao}`}
          titulo={d.alvo ? (d.alvo.uso > 1 ? t.focoEstouroT(d.alvo.label) : t.focoRitmoT(d.alvo.label, `${Math.floor(d.alvo.uso * 100)}%`)) : t.focoNadaTitulo}
        >
          {d.alvo ? (
            <>
              <p className="text-sm text-ink-muted">
                {d.alvo.uso > 1 ? t.focoEstouroP(m(d.alvo.gasto), m(d.alvo.planejado), d.alvo.diasRestantes) : t.focoRitmoP(d.alvo.diasRestantes, m(d.alvo.sobra))}
              </p>
              <Botao
                disabled={salvando}
                onClick={() =>
                  gravar(async () => {
                    await definirTetoAction({ categoria: d.alvo!.key, valor: d.alvo!.sobra });
                    seguir(`teto em ${d.alvo!.label}`);
                  })
                }
              >
                {d.alvo.uso > 1 ? t.focoSegurarBotao(d.alvo.label) : t.focoTetoBotao(m(d.alvo.sobra))}
              </Botao>
              {/* A mesma resposta do "Foi pontual" no Foco: o aviso some até o mês virar. Antes só
                  seguia o ritual, e o aviso esperava lá no Foco com o mesmo botão. */}
              <Botao
                secundario
                disabled={salvando}
                onClick={() =>
                  gravar(async () => {
                    await dispensarAvisoAction(d.alvo!.avisoId, "mes");
                    seguir("seguir o plano");
                  })
                }
              >
                {t.focoPontual}
              </Botao>
            </>
          ) : (
            <Botao onClick={() => seguir()}>Próximo</Botao>
          )}
        </Passo>
      )}

      {passo === 2 && (
        <Passo rotulo={`3 de 4 · ${t.ritFio}`} titulo={d.aporteFaltando > 0 ? t.fechAporteT(m(d.aporteFaltando)) : t.fechAporteEy}>
          {d.aporteFaltando > 0 ? (
            <>
              <p className="text-sm text-ink-muted">{t.fechAporteP}</p>
              <Botao
                disabled={salvando}
                onClick={() =>
                  gravar(async () => {
                    await registrarAporteDoMesAction();
                    seguir("aporte feito");
                  })
                }
              >
                {t.fechAporteFeito}
              </Botao>
              <Botao secundario onClick={() => seguir("aporte depois")}>
                {t.fechAporteDepois}
              </Botao>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Em dia neste mês. ✓</p>
              <Botao onClick={() => seguir()}>Próximo</Botao>
            </>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo rotulo={`4 de 4 · ${t.ritSemana}`}>
          {d.livreSemana !== null ? (
            <>
              <p className="text-caption text-ink-muted">{t.focoLivreSemana}</p>
              <p className="text-[2.25rem] font-bold leading-none tracking-tight tabular-nums text-ink">{m(d.livreSemana)}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t.focoSemOrcamentoSub}</p>
          )}
          {d.porCategoria.length > 0 && (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
              {d.porCategoria.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-ink-muted">{c.label}</dt>
                  <dd className="text-right tabular-nums text-ink">{m(c.semana)}</dd>
                </div>
              ))}
            </dl>
          )}
          <Botao
            disabled={salvando}
            onClick={() =>
              gravar(async () => {
                await concluirRitualAction("ritual", d.semana, escolhas.join(" · ") || "seguir o plano");
                router.push("/mensal/foco");
              })
            }
          >
            {t.ritFechar}
          </Botao>
        </Passo>
      )}
    </div>
  );
}
