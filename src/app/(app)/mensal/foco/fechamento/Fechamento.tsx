"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { ajustarOrcamentoAction, concluirRitualAction, mandarSobraPraReservaAction, registrarAporteDoMesAction } from "../actions";
import { Botao, Passo, Pontos } from "../Passos";

export type DadosFechamento = {
  chave: string;
  mes: string;
  ano: number;
  mesNumero: number;
  lancamentos: number;
  renda: number;
  gastos: number;
  guardado: number;
  planejado: number;
  sobra: number;
  passaram: { key: string; label: string; planejado: number; gasto: number; mae: boolean; planejadoAgora: number }[];
  aporteFaltando: number;
  /** null = sem orçamento neste mês: não existe "número do mês" pra mostrar. */
  livreMes: number | null;
  livreSemana: number | null;
  /** Pra onde a sobra pode ir: sem reserva criada, reserva já completa, ou reserva aberta. */
  reserva: "sem" | "completa" | "aberta";
  /** Quanto falta pra reserva ficar completa: a action nunca manda mais que isso. */
  faltaNaReserva: number;
};

export function Fechamento({ d }: { d: DadosFechamento }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [escolhas, setEscolhas] = useState<string[]>([]);
  const [salvando, start] = useTransition();
  const [lembrarCarteira, setLembrarCarteira] = useState(false);
  const seguir = (escolha?: string) => {
    if (escolha) setEscolhas((e) => [...e, escolha]);
    setPasso((p) => p + 1);
  };
  // Só oferece "subir" quando sobe de verdade: se o orçamento deste mês já é maior, o botão baixaria.
  const maior = d.passaram.find((p) => p.mae && Math.ceil(p.gasto / 10) * 10 > p.planejadoAgora);
  const arredondado = maior ? Math.ceil(maior.gasto / 10) * 10 : 0;
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // O que vai pra reserva de verdade: a action limita ao que falta pra ela completar. O botão diz
  // esse número, não a sobra inteira (dizia "Mandar R$ 1.500" e gravava R$ 200).
  const praReserva = Math.min(d.sobra, d.faltaNaReserva);

  return (
    <div className="flex flex-col gap-4">
      <Pontos total={6} atual={passo} />
      {/* A reserva mora em dois lugares (tela da reserva e Carteira): quem mandou a sobra pra lá
          precisa saber que a Carteira só muda quando ela marcar onde o dinheiro foi aplicado. */}
      {lembrarCarteira && (
        <p className="rounded-2xl border border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm text-ink">
          Anotado na sua reserva. Quando esse dinheiro estiver aplicado, marque o investimento como reserva na{" "}
          <Link href="/carteira" className="font-semibold text-accent-strong hover:underline">Carteira</Link> pra os números baterem.
        </p>
      )}

      {passo === 0 && (
        <Passo rotulo={`1 de 6 · ${d.mes}`} titulo={maiuscula(d.lancamentos > 0 ? t.fechImportadoT(d.mes, d.lancamentos) : t.fechImportarT(d.mes))}>
          {d.lancamentos > 0 ? (
            <Botao onClick={() => seguir()}>Próximo</Botao>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{t.fechImportarP}</p>
              <Botao onClick={() => window.dispatchEvent(new Event("spi:registrar"))}>{t.fechImportarBtn}</Botao>
              <Botao secundario onClick={() => router.refresh()}>
                Já importei
              </Botao>
              <Botao secundario onClick={() => seguir("sem gasto do dia a dia no mês")}>
                Seguir mesmo assim
              </Botao>
            </>
          )}
        </Passo>
      )}

      {passo === 1 && (
        <Passo rotulo={`2 de 6 · Raio-X de ${d.mes}`}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">Renda</dt>
            <dd className="text-right tabular-nums text-ink">{m(d.renda)}</dd>
            <dt className="text-ink-muted">Gastos</dt>
            <dd className={`text-right tabular-nums ${d.planejado > 0 && d.gastos > d.planejado ? "font-semibold text-danger" : "text-ink"}`}>
              {m(d.gastos)}
              {d.planejado > 0 && <span className="text-ink-faint"> de {m(d.planejado)}</span>}
            </dd>
            <dt className="text-ink-muted">Guardado</dt>
            <dd className="text-right tabular-nums text-ink">{m(d.guardado)}</dd>
            <dt className="font-semibold text-ink">Sobrou livre</dt>
            <dd className={`text-right font-semibold tabular-nums ${d.sobra < 0 ? "text-danger" : "text-ink"}`}>{m(d.sobra)}</dd>
          </dl>
          {d.passaram.length > 0 ? (
            <div className="flex flex-col gap-2">
              {d.passaram.map((p) => (
                <div key={p.key}>
                  <div className="mb-1 flex justify-between text-caption">
                    <span className="text-ink-muted">{p.label}</span>
                    <span className="font-semibold tabular-nums text-danger">
                      {m(p.gasto)} de {m(p.planejado)}
                    </span>
                  </div>
                  <ProgressBar percent={1} tone="danger" />
                </div>
              ))}
              <p className="text-sm text-ink">
                <b>{t.fechLicao}</b> {d.passaram.length} {d.passaram.length > 1 ? "categorias passaram" : "categoria passou"} do plano: {d.passaram.map((p) => p.label).join(", ")}.
              </p>
            </div>
          ) : d.planejado <= 0 ? (
            // Sem orçamento no mês não existe "dentro do plano": sem dado não tem conclusão.
            <p className="text-sm text-ink">
              <b>{t.fechLicao}</b> {d.mes} não tinha orçamento, então não há plano pra comparar.
            </p>
          ) : (
            <p className="text-sm text-ink">
              <b>{t.fechLicao}</b> todas as categorias ficaram dentro do plano.
            </p>
          )}
          <Botao onClick={() => seguir()}>Próximo</Botao>
        </Passo>
      )}

      {passo === 2 && (
        <Passo rotulo="3 de 6 · O que sobrou" titulo={d.sobra >= 1 ? <span className="text-[2rem] font-bold tabular-nums">{m(d.sobra)}</span> : undefined}>
          {d.sobra >= 1 && d.lancamentos === 0 ? (
            <>
              {/* Sem os gastos do mês, "sobra" é renda menos contas fixas: não é dinheiro de verdade. */}
              <p className="text-sm text-ink-muted">
                Sem os gastos de {d.mes} no app, esse número é só a renda menos as contas fixas. Importe o extrato de {d.mes} pra eu saber o que sobrou de verdade.
              </p>
              <Botao onClick={() => seguir("sobra não confirmada")}>Próximo</Botao>
            </>
          ) : d.sobra >= 1 && d.reserva === "aberta" ? (
            <>
              <p className="text-sm text-ink-muted">{t.fechSobraP}</p>
              {praReserva < d.sobra && <p className="text-sm text-ink">{t.fechSobraSoOQueFalta(m(praReserva), m(d.sobra - praReserva))}</p>}
              <Botao
                disabled={salvando}
                onClick={() =>
                  start(async () => {
                    const ok = await mandarSobraPraReservaAction(d.ano, d.mesNumero);
                    setLembrarCarteira(ok);
                    seguir(ok ? "sobra pra reserva" : "sobra na conta");
                  })
                }
              >
                {t.fechSobraReserva(m(praReserva))}
              </Botao>
              <Botao secundario onClick={() => seguir("sobra na conta")}>
                {t.fechSobraConta}
              </Botao>
            </>
          ) : d.sobra >= 1 ? (
            <>
              <p className="text-sm text-ink-muted">{d.reserva === "sem" ? t.fechSobraSemReserva : t.fechSobraReservaCompleta}</p>
              <Botao onClick={() => seguir("sobra na conta")}>Próximo</Botao>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{t.fechSemSobra}</p>
              <Botao onClick={() => seguir()}>Próximo</Botao>
            </>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo rotulo="4 de 6 · Ajustar este mês" titulo={maior ? `${maior.label}: ${m(maior.gasto)} de ${m(maior.planejado)} em ${d.mes}` : t.focoNadaTitulo}>
          {maior ? (
            <>
              <p className="text-sm text-ink-muted">{t.fechAjusteP}</p>
              <Botao
                disabled={salvando}
                onClick={() =>
                  start(async () => {
                    await ajustarOrcamentoAction(maior.key, arredondado);
                    seguir(`${maior.label} em ${m(arredondado)}`);
                  })
                }
              >
                {t.fechAjusteSubir(m(arredondado))}
              </Botao>
              <Botao secundario onClick={() => seguir(`manter ${maior.label}`)}>
                {t.fechAjusteManter}
              </Botao>
            </>
          ) : (
            <Botao onClick={() => seguir()}>Próximo</Botao>
          )}
        </Passo>
      )}

      {passo === 4 && (
        <Passo rotulo={`5 de 6 · ${t.fechAporteEy}`} titulo={d.aporteFaltando > 0 ? t.fechAporteT(m(d.aporteFaltando)) : undefined}>
          {d.aporteFaltando > 0 ? (
            <>
              <p className="text-sm text-ink-muted">{t.fechAporteP}</p>
              <Botao
                disabled={salvando}
                onClick={() =>
                  start(async () => {
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

      {passo === 5 && (
        <Passo rotulo="6 de 6 · Seu número do mês">
          <p className="text-caption text-ink-muted">{t.fechNumeroSub}</p>
          {d.livreMes !== null && d.livreSemana !== null ? (
            <>
              <p className="text-[2.25rem] font-bold leading-none tracking-tight tabular-nums text-ink">{m(d.livreMes)}</p>
              <p className="text-sm text-ink-muted">{t.fechNumeroP(m(d.livreSemana))}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t.focoSemOrcamentoSub}</p>
          )}
          <Botao
            disabled={salvando}
            onClick={() =>
              start(async () => {
                await concluirRitualAction("fechamento", d.chave, escolhas.join(" · ") || "lição registrada");
                router.push("/mensal/foco");
              })
            }
          >
            {t.fechFechar}
          </Botao>
        </Passo>
      )}

      <ReportarErro tela={`Fechamento de ${d.mes}`} regra="planejado × realizado do mês anterior; sobra = renda − gastos − guardado" />
    </div>
  );
}
