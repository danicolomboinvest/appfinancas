"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Check } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { NotificacaoDeConquista } from "@/components/conquista/NotificacaoDeConquista";
import { vibrar } from "@/lib/celebrar";
import { lerSobrou } from "@/lib/consolidation/sobrou";
import { ajustarOrcamentoAction, concluirRitualAction, mandarSobraPraReservaAction, reabrirMesAction } from "../actions";
import type { EstadoDoFechamento } from "./estado";

/** `porMes`: quanto a meta pede por mês (0 = sem data, não há "em dia" a cobrar). */
export type MetaDoFechamento = { id: string; nome: string; guardado: number; porMes: number };

export type DadosFechamento = {
  /** "2026-09" */
  chave: string;
  /** "setembro" */
  mes: string;
  estado: EstadoDoFechamento;
  /** "7 de outubro", quando está fechado. */
  fechadoEm: string | null;
  entrou: number;
  gastou: number;
  guardou: number;
  sobrou: number;
  metas: MetaDoFechamento[];
  /** Onde estão as transações do mês ("Rever as transações"). */
  hrefTransacoes: string;
  ano: number;
  mesNumero: number;
  /** "outubro": o mês de agora, onde o orçamento sobe. */
  mesAtual: string;
  /** A categoria que mais passou e o valor para subir o orçamento deste mês; null = nenhuma. */
  passou: { key: string; label: string; planejado: number; gasto: number; novo: number } | null;
  /** Quanto da sobra pode ir para a reserva (o que falta para ela completar); 0 = não oferece. */
  praReserva: number;
};

/** Um atalho dentro de um passo: a frase, a ação principal e "deixar como está". */
function Atalho({ titulo, texto, botao, feito, aoFazer, salvando }: { titulo: string; texto: string; botao: string; feito: string | null; aoFazer: () => void; salvando: boolean }) {
  const [dispensado, setDispensado] = useState(false);
  if (dispensado) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl border border-border bg-surface p-4">
      <b className="text-[15px] font-medium text-ink">{titulo}</b>
      <p className="text-sm text-ink-muted">{texto}</p>
      {feito ? (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <Check size={15} aria-hidden /> {feito}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={salvando} onClick={aoFazer} className="min-h-11 rounded-full bg-accent-soft px-4 text-sm font-medium text-accent-strong disabled:opacity-60">
            {botao}
          </button>
          <button type="button" onClick={() => setDispensado(true)} className="min-h-11 px-3 text-sm text-ink-muted">
            Deixar como está
          </button>
        </div>
      )}
    </div>
  );
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const BOTAO = "flex min-h-12 w-full items-center justify-center rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent transition-opacity disabled:opacity-60";

/** Os quatro números do mês, na conta única (sobrou = entrou − gastou − guardou). */
export function QuatroNumeros({ d }: { d: Pick<DadosFechamento, "entrou" | "gastou" | "guardou" | "sobrou"> }) {
  const money = useMoney();
  const s = lerSobrou(d.sobrou);
  const itens: [string, number, string][] = [
    ["Entrou", d.entrou, "bg-surface-2"],
    ["Gastou", d.gastou, "bg-surface-2"],
    ["Guardou", d.guardou, "bg-surface-2"],
    [s.rotulo, s.valor, s.situacao === "faltou" ? "bg-[color-mix(in_srgb,var(--color-dinheiro-faltou)_14%,var(--color-surface))]" : "bg-success-soft"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {itens.map(([rotulo, valor, fundo]) => (
        <div key={rotulo} className={`min-w-0 rounded-2xl px-3 py-3 ${fundo}`}>
          <dt className="text-[13px] text-ink-muted">{rotulo}</dt>
          <dd className="mt-1 text-ink">
            <ValorDestaque texto={money(valor, { round: true })} className="text-[1.6rem] font-light leading-none tabular-nums" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Barras({ passo }: { passo: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Passo ${passo} de 3`}>
      {[1, 2, 3].map((k) => (
        <span key={k} className={`h-1 flex-1 rounded-full ${k <= passo ? "bg-accent" : "bg-surface-2"}`} />
      ))}
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="titulo-tema text-[28px] leading-tight text-ink">{children}</h2>;
}

/**
 * Fechar o mês (protótipo aprovado, rodada 42): três passos e o fim, uma coisa por tela.
 * 1. O mês em números (confere se bate). 2. As metas do mês (registrar o que faltou).
 * 3. "Pronto para fechar?". Fim: "Setembro fechado" com a data. Nenhum passo diz "aberto".
 */
export function Fechamento({ d, detalheReaberto }: { d: DadosFechamento; detalheReaberto?: string }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const { showError } = useToast();
  const [passo, setPasso] = useState<1 | 2 | 3 | "fim">(1);
  const [fechadoEm, setFechadoEm] = useState<string | null>(null);
  const [primeiroMes, setPrimeiroMes] = useState(false);
  const [salvando, iniciar] = useTransition();
  const [subiu, setSubiu] = useState(false);
  const [mandou, setMandou] = useState<number | null>(null);
  const gravar = (acao: () => Promise<void>) =>
    iniciar(async () => {
      try {
        await acao();
      } catch {
        showError(t.acaoFalhou);
      }
    });

  const fechar = () =>
    iniciar(async () => {
      try {
        const { primeiro } = await concluirRitualAction("fechamento", d.chave, `${d.mes} fechado`);
        vibrar("sucesso");
        setFechadoEm(new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }));
        setPasso("fim");
        if (primeiro) setPrimeiroMes(true);
        // Sem router.refresh(): a tela trocaria para o "mês fechado" antes de ela ver o fim.
      } catch {
        showError(t.acaoFalhou);
      }
    });

  // Um componente só para os dois estados: quando ela fecha, o servidor já devolve "fechado", e
  // a tela continua aqui no fim (com a data) em vez de pular direto para o resumo.
  if (d.estado === "fechado" && passo !== "fim") return <MesFechado d={d} />;

  return (
    <div className="flex flex-col gap-5">
      {d.estado === "reaberto" && passo !== "fim" && detalheReaberto && <p className="-mt-3 text-sm text-ink-muted">{detalheReaberto}</p>}
      {primeiroMes && (
        <NotificacaoDeConquista conquistas={[{ chave: "primeiro-fechamento", icone: "🗓️", titulo: t.conqFechamentoTitulo, texto: t.conqFechamentoTexto }]} onFim={() => setPrimeiroMes(false)} />
      )}
      {passo !== "fim" && <Barras passo={passo} />}

      {passo === 1 && (
        <>
          <Titulo>{maiuscula(d.mes)} em números</Titulo>
          <QuatroNumeros d={d} />
          <p className="text-sm text-ink-muted">Confira se bate com o que você lembra.</p>
          {d.passou && (
            <Atalho
              titulo={`${d.passou.label} passou do plano`}
              texto={`${money(d.passou.gasto, { round: true })} de ${money(d.passou.planejado, { round: true })} em ${d.mes}.`}
              botao={`Subir ${d.passou.label} para ${money(d.passou.novo, { round: true })} em ${d.mesAtual}`}
              feito={subiu ? `${d.passou.label} de ${d.mesAtual}: ${money(d.passou.novo, { round: true })}` : null}
              salvando={salvando}
              aoFazer={() => gravar(async () => { await ajustarOrcamentoAction(d.passou!.key, d.passou!.novo); setSubiu(true); })}
            />
          )}
          <div className="flex flex-col items-center gap-3">
            <button type="button" className={BOTAO} onClick={() => setPasso(2)}>
              Está certo
            </button>
            <Link href={d.hrefTransacoes} className="min-h-11 py-2 text-sm text-ink underline underline-offset-2">
              Rever as transações
            </Link>
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <Titulo>Suas metas em {d.mes}</Titulo>
          {d.metas.length > 0 ? (
            <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-4">
              {d.metas.map((m) => (
                <li key={m.id} className="flex min-h-16 items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{m.nome}</span>
                    <span className="block text-[13px] text-ink-muted">{m.guardado > 0 ? `${money(m.guardado, { round: true })} guardados` : "nada registrado"}</span>
                  </span>
                  {/* "Em dia" só quando guardou o que a meta pede por mês (R$ 10 de R$ 500 não é em dia). */}
                  {m.guardado > 0 && m.guardado + 0.5 >= m.porMes ? (
                    <span className="flex shrink-0 items-center gap-1 text-[13px] text-success">
                      <Check size={14} aria-hidden /> em dia
                    </span>
                  ) : m.guardado > 0 ? (
                    <span className="shrink-0 text-[13px] tabular-nums text-ink-muted">de {money(m.porMes, { round: true })}</span>
                  ) : (
                    <Link href={`/planejamento/metas/${m.id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-surface-2 px-4 text-sm font-medium text-ink">
                      Registrar
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-3xl border border-border bg-surface px-4 py-4 text-sm text-ink-muted">Nenhuma meta neste perfil.</p>
          )}
          {d.praReserva >= 1 && (
            <Atalho
              titulo={`Sobrou ${money(lerSobrou(d.sobrou).valor, { round: true })} em ${d.mes}`}
              texto="Quer guardar na reserva de emergência?"
              botao={`Mandar ${money(d.praReserva, { round: true })} para a reserva`}
              feito={mandou !== null ? `${money(mandou, { round: true })} na reserva. Na Carteira, marque o investimento como reserva.` : null}
              salvando={salvando}
              aoFazer={() => gravar(async () => { const ok = await mandarSobraPraReservaAction(d.ano, d.mesNumero); if (ok) setMandou(d.praReserva); else showError(t.acaoFalhou); })}
            />
          )}
          <button type="button" className={BOTAO} onClick={() => setPasso(3)}>
            Continuar
          </button>
        </>
      )}

      {passo === 3 && (
        <>
          <Titulo>Fechar {d.mes} agora?</Titulo>
          <p className="flex gap-2.5 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink">
            <CalendarDays size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>Os números de {d.mes} ficam guardados como estão. Se precisar mudar, dá para reabrir depois.</span>
          </p>
          <button type="button" className={BOTAO} disabled={salvando} onClick={fechar}>
            Fechar {d.mes}
          </button>
        </>
      )}

      {passo === "fim" && (
        <>
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={22} aria-hidden />
            </span>
            <Titulo>{maiuscula(d.mes)} fechado</Titulo>
            {fechadoEm && <p className="text-sm text-ink-muted">Fechado em {fechadoEm}.</p>}
          </div>
          <QuatroNumeros d={d} />
          <Link href="/mensal/foco" className={BOTAO}>
            Voltar ao Resumo
          </Link>
        </>
      )}
    </div>
  );
}

/** O mês já fechado: a data, os quatro números e o "Reabrir" com a confirmação na própria tela. */
export function MesFechado({ d }: { d: DadosFechamento }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError, showToast } = useToast();
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <CalendarCheck size={16} aria-hidden /> {maiuscula(d.mes)} fechado{d.fechadoEm ? ` em ${d.fechadoEm}` : ""}
      </p>
      <QuatroNumeros d={d} />
      {confirmando ? (
        <div role="group" aria-label={`Reabrir ${d.mes}`} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
          <b className="text-[15px] font-medium text-ink">Reabrir {d.mes}?</b>
          <p className="text-sm text-ink-muted">Os números voltam a poder mudar. Depois é só fechar de novo.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await reabrirMesAction(d.chave);
                  if (!r.ok) return showError("Não reabriu. Tente de novo.");
                  // Vai para outra tela: pílula curta.
                  showToast(`${maiuscula(d.mes)} reaberto`);
                  router.push("/mensal/foco");
                })
              }
              className="min-h-11 rounded-full border border-border-strong px-4 text-sm font-medium text-ink disabled:opacity-60"
            >
              Reabrir
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="min-h-11 rounded-full bg-accent-gradient px-4 text-sm font-medium text-on-accent">
              Manter fechado
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="mx-auto min-h-11 text-sm text-ink underline underline-offset-2">
          Reabrir {d.mes}
        </button>
      )}
    </div>
  );
}
