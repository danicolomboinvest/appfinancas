"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { Card } from "@/components/ui/Card";
import { EVENTO_REGISTRAR } from "@/components/shell/registrar-eventos";
import { DICAS_DA_SEMANA, PASSOS_DO_SONHO, REGRAS_DO_CARTAO, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { definirTetoAction, escolherRitmoAction } from "@/app/(app)/mensal/foco/actions";
import { concluirMissaoAction, salvarRespostaAction } from "../../actions";
import { vibrar } from "@/lib/celebrar";
import { NotificacaoDeConquista } from "@/components/conquista/NotificacaoDeConquista";
import type { DadosDaMissao } from "../../dados";
import type { Respostas } from "./Missao";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Botao({ children, onClick, disabled, secundario }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; secundario?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-45 ${
        secundario ? "border border-border-strong text-ink" : "bg-accent-gradient text-on-accent shadow-premium-sm"
      }`}
    >
      {children}
    </button>
  );
}

function Opcao({ ic, titulo, sub, marcada, onClick }: { ic: string; titulo: string; sub?: string; marcada: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${marcada ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
    >
      <span className="text-xl" aria-hidden>
        {ic}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{titulo}</span>
        {sub && <span className="block text-caption text-ink-muted">{sub}</span>}
      </span>
      {marcada && <Check size={18} className="shrink-0 text-accent-strong" />}
    </button>
  );
}

function Linhas({ itens }: { itens: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
      {itens.map(([a, b]) => (
        <div key={a} className="contents">
          <dt className="text-ink-muted">{a}</dt>
          <dd className="text-right font-semibold tabular-nums text-ink">{b}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A régua: quanto da renda já sai, com a marca dos 90% da aula. */
function Regua({ valor, marca, rotulo, marcaRotulo }: { valor: number; marca: number; rotulo: string; marcaRotulo: string }) {
  const passou = valor > marca;
  return (
    <div>
      <div className="relative h-3 rounded-full bg-surface-2">
        <div className={`h-3 rounded-full ${passou ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, valor * 100)}%` }} />
        <span className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${Math.min(100, marca * 100)}%` }} aria-hidden />
      </div>
      <div className="mt-1 flex justify-between text-caption text-ink-muted">
        <span>{rotulo}</span>
        <span>{marcaRotulo}</span>
      </div>
    </div>
  );
}

/**
 * A tela própria de cada dia que não acontece numa tela que o app já tem: o retrato, o que sai
 * todo mês, onde escapa, o motivo, o guardar, a divisão, a regra do cartão, o plano da semana,
 * o desafio, os 9 passos, a semana com plano e o plano final. Tudo com os números DELA.
 */
export function TelaDoDia({ dia, dados, respostas, feita, amanha, hoje, onVoltar }: { dia: number; dados: DadosDaMissao; respostas: Respostas; feita: boolean; amanha: string; hoje: string; onVoltar: () => void }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const v = vocabularioDaVoz(voz);
  const money = useMoney();
  const m = (x: number) => money(x, { round: true });
  const router = useRouter();
  const [salvando, startTransition] = useTransition();

  const concluir = (fn?: () => Promise<unknown>) =>
    startTransition(async () => {
      if (fn) await fn();
      else await concluirMissaoAction(dia);
      vibrar("sucesso");
      router.refresh();
      onVoltar();
    });
  const abrirRegistrar = (modo: string) => window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, { detail: { modo } }));

  // Estados das telas (cada dia usa o seu).
  const [motivo, setMotivo] = useState(respostas.motivo?.texto ?? "");
  const [regra, setRegra] = useState(respostas.regra?.texto ?? "");
  const [naoFixas, setNaoFixas] = useState<string[]>([]);
  const [negociar, setNegociar] = useState<string | null>(null);
  const [teto, setTeto] = useState<number | null>(null);
  const [tetoSalvo, setTetoSalvo] = useState(false);
  const [dica, setDica] = useState<string | null>(respostas.dica?.texto ?? null);
  const [passo, setPasso] = useState(0);
  const [passos, setPassos] = useState<string[]>(() => (Array.isArray(respostas.passos?.dados) ? (respostas.passos!.dados as string[]) : PASSOS_DO_SONHO.map(() => "")));
  const [recompensa, setRecompensa] = useState(respostas.recompensa?.texto ?? "");
  // O fim dos 21 dias: a notificação de conquista (com confete), uma vez só.
  const [fimDoReset, setFimDoReset] = useState(false);

  const titulo = (txt: string, sub?: string) => (
    <div>
      <h1 className="text-h2 font-bold tracking-tight text-ink">{naVoz(txt, v)}</h1>
      {sub && <p className="mt-1 text-caption text-ink-muted">{naVoz(sub, v)}</p>}
    </div>
  );

  switch (dados.dia) {
    case 3: {
      const d = dados as Extract<DadosDaMissao, { dia: 3 }>;
      const usa = d.entra > 0 ? d.sai / d.entra : 0;
      return (
        <div className="flex flex-col gap-4">
          {titulo("Seu retrato", d.meses > 0 ? `Média dos seus últimos ${d.meses} ${d.meses === 1 ? "mês" : "meses"}` : undefined)}
          {d.meses === 0 ? (
            <Card className="p-4 text-sm text-ink-muted">Ainda não há meses fechados com lançamentos. Suba o extrato (dia 1) e volte aqui.</Card>
          ) : (
            <Card className="flex flex-col gap-4 p-4">
              <Linhas itens={[["Entra por mês", m(d.entra)], ["Sai por mês", m(d.sai)]]} />
              {d.entra > 0 && <Regua valor={usa} marca={0.9} rotulo={`${pct(usa)} do que entra`} marcaRotulo="régua: 90%" />}
              <p className="text-caption text-ink-muted">{usa > 0.9 ? `Faltam ${m(d.sai - d.entra * 0.9)} por mês para chegar na régua.` : "Você já está dentro da régua. O que sobra é o seu futuro."}</p>
            </Card>
          )}
          <Botao secundario onClick={() => abrirRegistrar("digitar")}>
            + Adicionar o que entra fora da conta (VR, VA, dinheiro)
          </Botao>
          {!feita && (
            <Botao disabled={salvando} onClick={() => concluir()}>
              Entendi
            </Botao>
          )}
        </div>
      );
    }
    case 5: {
      const d = dados as Extract<DadosDaMissao, { dia: 5 }>;
      const fixas = d.fixas.filter((f) => !naoFixas.includes(f.chave));
      const total = fixas.reduce((s, f) => s + f.mensal, 0) + d.parcelas;
      return (
        <div className="flex flex-col gap-4">
          {titulo("O que sai todo mês", "Montei com os seus últimos meses. Confira.")}
          {d.fixas.length === 0 && d.parcelas === 0 ? (
            <Card className="p-4 text-sm text-ink-muted">Ainda não achei cobranças que se repetem em 3 meses. Com mais meses de extrato a lista aparece sozinha.</Card>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {d.fixas.map((f) => {
                const tirada = naoFixas.includes(f.chave);
                return (
                  <li key={f.chave} className={`flex items-center gap-2 px-3 py-2.5 ${tirada ? "opacity-45" : ""}`}>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{f.nome}</span>
                    <span className="text-sm tabular-nums text-ink">{m(f.mensal)}</span>
                    <button type="button" onClick={() => setNaoFixas((x) => (tirada ? x.filter((k) => k !== f.chave) : [...x, f.chave]))} className="min-h-11 shrink-0 px-2 text-caption font-semibold text-ink-muted">
                      {tirada ? "É fixa" : "Não é fixa"}
                    </button>
                    {!tirada && (
                      <button type="button" aria-pressed={negociar === f.chave} onClick={() => setNegociar(negociar === f.chave ? null : f.chave)} className={`min-h-11 shrink-0 rounded-full px-2.5 text-caption font-semibold ${negociar === f.chave ? "bg-accent-soft text-accent-strong" : "text-accent-strong"}`}>
                        {negociar === f.chave ? "📞 Negociar" : "Negociar"}
                      </button>
                    )}
                  </li>
                );
              })}
              {d.parcelas > 0 && (
                <li className="flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink">Parcelas do cartão no mês que vem</span>
                  <span className="text-sm tabular-nums text-ink">{m(d.parcelas)}</span>
                </li>
              )}
            </ul>
          )}
          {negociar && <p className="rounded-xl bg-accent-soft px-3 py-2 text-caption text-ink">Ligue ou abra o chat da empresa hoje. Diga que está revendo as contas e pergunte por um plano mais barato.</p>}
          {!feita && (
            <Botao disabled={salvando} onClick={() => concluir(() => salvarRespostaAction("fixas", String(Math.round(total)), { total, naoFixas, negociar: d.fixas.find((f) => f.chave === negociar)?.nome ?? null }, 5))}>
              Confirmar · {m(total)}/mês
            </Botao>
          )}
        </div>
      );
    }
    case 6: {
      const d = dados as Extract<DadosDaMissao, { dia: 6 }>;
      const pior = d.categorias.find((c) => c.voce > c.regua) ?? null;
      const valorTeto = teto ?? (pior ? Math.round(pior.regua * d.renda) : 0);
      return (
        <div className="flex flex-col gap-4">
          {titulo("Onde o dinheiro escapa", "Você contra a distribuição da aula")}
          <Card className="flex flex-col gap-3 p-4">
            {d.categorias.map((c) => (
              <div key={c.cat}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-ink">{c.nome}</span>
                  <span className="text-caption text-ink-muted">
                    {pct(c.voce)} · régua {pct(c.regua)}
                  </span>
                </div>
                <div className="relative mt-1 h-2.5 rounded-full bg-surface-2">
                  <div className={`h-2.5 rounded-full ${c.voce > c.regua ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, c.voce * 250)}%` }} />
                  <span className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${Math.min(100, c.regua * 250)}%` }} aria-hidden />
                </div>
              </div>
            ))}
          </Card>
          {pior && !tetoSalvo && (
            <Card className="flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold text-ink">
                {pior.nome}: {m(pior.valor)} por mês
              </p>
              <p className="text-caption text-ink-muted">É a que mais passa da régua. Ponha um teto até o fim do mês.</p>
              <div className="flex flex-wrap gap-2">
                {[valorTeto, Math.round(valorTeto * 0.8), Math.round(pior.valor * 0.9)].filter((x, i, a) => x > 0 && a.indexOf(x) === i).map((x) => (
                  <button key={x} type="button" aria-pressed={valorTeto === x} onClick={() => setTeto(x)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${valorTeto === x ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-ink"}`}>
                    {m(x)}
                  </button>
                ))}
              </div>
              <Botao disabled={salvando || valorTeto <= 0} onClick={() => startTransition(async () => { await definirTetoAction({ categoria: pior.cat, valor: valorTeto }); setTetoSalvo(true); })}>
                Pôr o teto de {m(valorTeto)}
              </Botao>
            </Card>
          )}
          {(tetoSalvo || !pior) && (
            <>
              <p className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Uma dica da aula para esta semana</p>
              {DICAS_DA_SEMANA.map((x) => (
                <Opcao key={x.chave} ic={x.ic} titulo={x.t} sub={x.sub} marcada={dica === x.chave} onClick={() => setDica(x.chave)} />
              ))}
              {!feita && (
                <Botao disabled={salvando || !dica} onClick={() => concluir(() => salvarRespostaAction("dica", dica!, undefined, 6))}>
                  Combinado
                </Botao>
              )}
            </>
          )}
        </div>
      );
    }
    case 7: {
      const d = dados as Extract<DadosDaMissao, { dia: 7 }>;
      const resumo: [string, string][] = [["Sai por mês", m(d.sai)]];
      if (d.pctDaRenda !== null) resumo.push(["Da renda", pct(d.pctDaRenda)]);
      if (d.fixas) resumo.push(["Já tem dono no mês", m(d.fixas)]);
      return (
        <div className="flex flex-col gap-4">
          {titulo("Sua semana 1")}
          <Card className="p-4">
            <Linhas itens={resumo} />
          </Card>
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Por que você quer colocar o dinheiro no lugar?</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} rows={3} placeholder="Ex.: Quero dormir tranquila." className="rounded-2xl border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none" />
          </label>
          <Botao disabled={salvando || !motivo.trim()} onClick={() => concluir(() => salvarRespostaAction("motivo", motivo.trim(), undefined, feita ? undefined : 7))}>
            Salvar
          </Botao>
        </div>
      );
    }
    case 11: {
      const d = dados as Extract<DadosDaMissao, { dia: 11 }>;
      return (
        <div className="flex flex-col gap-4">
          {titulo("Guardar primeiro")}
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-caption text-ink-muted">Todo mês, no dia do salário</span>
            <span className="text-h1 font-bold tabular-nums text-ink">{d.guardar ? m(d.guardar) : "—"}</span>
            <span className="text-caption text-ink-muted">{d.guardar ? "10% liberdade + 8% sonhos, do seu {orcamento}".replace("{orcamento}", v.orcamento) : `Monte o ${v.orcamento} (dia 10) para eu calcular.`}</span>
          </Card>
          <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
            No app do banco, procure <b>Pix agendado</b> ou <b>transferência programada</b>: todo mês, no dia do salário, para a conta onde você guarda. No Nubank: Área Pix › Programar.
          </div>
          {!feita && (
            <Botao disabled={salvando} onClick={() => concluir()}>
              Fiz a transferência automática
            </Botao>
          )}
        </div>
      );
    }
    case 12: {
      const d = dados as Extract<DadosDaMissao, { dia: 12 }>;
      return (
        <div className="flex flex-col gap-4">
          {titulo("Para onde vai o guardado", "Reserva primeiro, depois os sonhos pela ordem do prazo")}
          {d.guardar === null ? (
            <Card className="p-4 text-sm text-ink-muted">Para dividir, o app precisa saber quanto você guarda por mês. Monte o {v.orcamento} (dia 10) e volte.</Card>
          ) : d.fatias.length === 0 ? (
            <Card className="p-4 text-sm text-ink-muted">Crie a reserva (dia 9) e um sonho (dia 8) para o app dividir os {m(d.guardar)} por mês.</Card>
          ) : (
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex h-3 overflow-hidden rounded-full">
                {d.fatias.map((f, i) => (
                  <span key={i} className={f.tipo === "reserva" ? "bg-success" : f.tipo === "meta" ? "bg-accent" : "bg-surface-2"} style={{ width: `${(f.valor / d.guardar!) * 100}%` }} />
                ))}
              </div>
              <Linhas itens={d.fatias.map((f) => [`${f.tipo === "reserva" ? "🛟" : f.tipo === "meta" ? "✈️" : "🌱"} ${f.tipo === "livre" ? "Liberdade financeira" : f.nome}`, m(f.valor)])} />
            </Card>
          )}
          {!feita && (
            <Botao disabled={salvando} onClick={() => concluir(() => salvarRespostaAction("divisao", "ok", d.fatias, 12))}>
              Confirmar
            </Botao>
          )}
        </div>
      );
    }
    case 13: {
      const d = dados as Extract<DadosDaMissao, { dia: 13 }>;
      return (
        <div className="flex flex-col gap-4">
          {titulo("Débito ou crédito?")}
          {d.proximaFatura > 0 && (
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-caption text-ink-muted">Já marcado para o mês que vem (parcelas e contas)</span>
              <span className="text-h2 font-bold tabular-nums text-ink">{m(d.proximaFatura)}</span>
            </Card>
          )}
          <p className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Sua regra do cartão</p>
          {REGRAS_DO_CARTAO.map((r) => (
            <Opcao key={r.chave} ic={r.ic} titulo={naVoz(r.t, v)} sub={r.sub} marcada={regra === r.chave} onClick={() => setRegra(r.chave)} />
          ))}
          <Botao disabled={salvando || !regra} onClick={() => concluir(() => salvarRespostaAction("regra", regra, undefined, feita ? undefined : 13))}>
            Salvar
          </Botao>
        </div>
      );
    }
    case 14: {
      const d = dados as Extract<DadosDaMissao, { dia: 14 }>;
      return (
        <div className="flex flex-col gap-4">
          {titulo("Seu plano da semana")}
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-caption text-ink-muted">Livre para gastar por semana</span>
            <span className="text-h1 font-bold tabular-nums text-ink">{d.livreSemana !== null ? m(d.livreSemana) : "—"}</span>
            <span className="text-caption text-ink-muted">{d.livreSemana !== null ? "Já descontadas as contas fixas e o guardar" : `Monte o ${v.orcamento} para o app calcular.`}</span>
          </Card>
          <p className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Como você quer acompanhar?</p>
          <Opcao ic="🗓️" titulo="Toda semana" sub="5 minutos, toda segunda" marcada={d.ritmo === "semanal"} onClick={() => concluir(async () => { await escolherRitmoAction("semanal"); if (!feita) await concluirMissaoAction(14); })} />
          <Opcao ic="📆" titulo="Uma vez por mês" sub="15 minutos no fechamento" marcada={d.ritmo === "mensal"} onClick={() => concluir(async () => { await escolherRitmoAction("mensal"); if (!feita) await concluirMissaoAction(14); })} />
        </div>
      );
    }
    case 17: {
      const topou = respostas.desafio?.texto ?? null;
      const passou = topou !== null && topou < hoje;
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <span className="text-5xl" aria-hidden>
              🚫
            </span>
            {titulo(topou && !passou ? "Amanhã, um dia sem gasto à toa" : passou && !feita ? "Escorregou? Tenta de novo" : "Um dia sem gasto à toa")}
          </div>
          <Card className="p-4">
            <Linhas itens={[["✅ Pode", "mercado, transporte, contas"], ["⛔ Não", "lazer, delivery, compras"]]} />
          </Card>
          {feita ? null : topou && !passou ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-center text-caption text-ink-muted">Topado! No dia seguinte o app confere sozinho.</p>
          ) : (
            <Botao disabled={salvando} onClick={() => startTransition(async () => { await salvarRespostaAction("desafio", amanha); router.refresh(); })}>
              Topo o desafio
            </Botao>
          )}
        </div>
      );
    }
    case 19: {
      const p = PASSOS_DO_SONHO[passo];
      const ultimo = passo === PASSOS_DO_SONHO.length - 1;
      return (
        <div className="flex flex-col gap-4">
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${((passo + 1) / PASSOS_DO_SONHO.length) * 100}%` }} />
          </div>
          <p className="text-caption text-ink-muted">
            Passo {passo + 1} de 9 · {p.t}
          </p>
          {titulo(p.q)}
          <textarea
            value={passos[passo]}
            onChange={(e) => setPassos((x) => x.map((y, i) => (i === passo ? e.target.value : y)))}
            maxLength={160}
            rows={3}
            placeholder={`Ex.: ${p.ex}`}
            className="rounded-2xl border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            {passo > 0 && (
              <Botao secundario onClick={() => setPasso(passo - 1)}>
                Voltar
              </Botao>
            )}
            {ultimo ? (
              <Botao disabled={salvando || passos.some((x) => !x.trim())} onClick={() => concluir(() => salvarRespostaAction("passos", "9", passos.map((x) => x.trim()), feita ? undefined : 19))}>
                Salvar
              </Botao>
            ) : (
              <Botao disabled={!passos[passo].trim()} onClick={() => setPasso(passo + 1)}>
                Próximo
              </Botao>
            )}
          </div>
        </div>
      );
    }
    case 20: {
      const d = dados as Extract<DadosDaMissao, { dia: 20 }>;
      const menos = d.mediaSemana - d.semana;
      return (
        <div className="flex flex-col gap-4">
          {titulo("Sua primeira semana com plano")}
          <Card className="flex flex-col gap-3 p-4">
            <span className="text-caption text-ink-muted">Gastou nos últimos 7 dias</span>
            <span className="text-h1 font-bold tabular-nums text-ink">{m(d.semana)}</span>
            {d.mediaSemana > 0 && <Regua valor={d.semana / (d.mediaSemana * 1.25)} marca={0.8} rotulo={`média antes: ${m(d.mediaSemana)}`} marcaRotulo="sua média" />}
            {d.mediaSemana > 0 && <p className="text-sm font-semibold text-ink">{menos >= 0 ? `${m(menos)} a menos que a sua média` : `${m(-menos)} acima da sua média`}</p>}
          </Card>
          <Botao secundario onClick={() => abrirRegistrar("importar")}>
            Subir o extrato mais recente
          </Botao>
          {!feita && (
            <Botao disabled={salvando} onClick={() => concluir()}>
              Entendi
            </Botao>
          )}
        </div>
      );
    }
    case 21: {
      const d = dados as Extract<DadosDaMissao, { dia: 21 }>;
      const linhas: [string, string][] = [];
      if (d.livreSemana !== null) linhas.push(["Livre por semana", m(d.livreSemana)]);
      if (d.guardar) linhas.push(["Guardar todo mês", m(d.guardar)]);
      if (d.reserva) linhas.push(["Reserva", `alvo ${m(d.reserva)}`]);
      if (d.sonho) linhas.push([d.sonho.nome, d.sonho.data ? new Date(`${d.sonho.data}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "sem data"]);
      if (d.ritmo) linhas.push(["Ritual", d.ritmo === "semanal" ? "toda semana" : "uma vez por mês"]);
      const regraTxt = REGRAS_DO_CARTAO.find((r) => r.chave === respostas.regra?.texto);
      const texto = `Em 21 dias eu coloquei meu dinheiro no lugar.${d.guardar ? ` Agora guardo ${m(d.guardar)} todo mês.` : ""} #MoneyReset`;
      return (
        <div className="flex flex-col gap-4">
          {fimDoReset && (
            <NotificacaoDeConquista
              conquistas={[{ chave: "reset", icone: "🏁", titulo: t.conqResetTitulo, texto: t.conqResetTexto }]}
              onFim={() => {
                router.refresh();
                onVoltar();
              }}
            />
          )}
          {titulo("Seu plano")}
          {linhas.length > 0 && (
            <Card className="p-4">
              <Linhas itens={linhas} />
            </Card>
          )}
          {respostas.motivo?.texto && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm italic text-ink">&ldquo;{respostas.motivo.texto}&rdquo;</p>}
          {regraTxt && <p className="px-1 text-caption text-ink-muted">Regra do cartão: {naVoz(regraTxt.t, v)}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Sua recompensa (pequena, e que caiba no plano)</span>
            <input value={recompensa} onChange={(e) => setRecompensa(e.target.value)} maxLength={80} placeholder="Ex.: jantar no restaurante preferido" className="min-h-11 rounded-2xl border border-border-strong bg-surface-2 px-4 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none" />
          </label>
          <Botao
            secundario
            onClick={() => {
              if (navigator.share) void navigator.share({ text: texto }).catch(() => {});
              else void navigator.clipboard?.writeText(texto);
            }}
          >
            {t.mrCompartilhar}
          </Botao>
          {!feita && (
            <Botao disabled={salvando || !recompensa.trim()} onClick={() => startTransition(async () => { await salvarRespostaAction("recompensa", recompensa.trim(), undefined, 21); setFimDoReset(true); })}>
              Concluir o Money Reset
            </Botao>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
