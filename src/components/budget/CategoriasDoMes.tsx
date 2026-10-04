"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ChevronDown, Pencil } from "lucide-react";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { emojiEscolhido, isParentCategoryKey } from "@/lib/categories";
import { ehEmpresa } from "@/lib/profiles/empresa";
import type { CategoriaDoMes, EstadoDaCategoria } from "@/lib/planning/orcamento-categorias";
import { cobrirCategoriaAction, definirPlanoDaCategoriaAction } from "@/app/(app)/orcamento/actions";

export type LinhaDaCategoria = CategoriaDoMes & {
  cor: string;
  /** Ícone da categoria dela (as padrão vêm do perfil). */
  iconeProprio?: string;
  maiores: { descricao: string; valor: number; vezes: number }[];
  historico: { rotulo: string; gasto: number; planejado: number; atual: boolean }[];
  media: number;
  sugestao: { passou: number; meses: number; sugerido: number } | null;
};

/** Âmbar fixo, não a cor de destaque do tema: no Girly ela é rosa e no Game ciano, e "vai passar"
 * pintado de ciano parecia coisa boa. Atenção é âmbar em qualquer tema. */
const AMBAR = "#E8A33A";

/**
 * Emoji pequeno ao lado do nome (01/10/2026: a Dani preferiu "🏠 Moradia" compacto ao círculo
 * grande com ícone). Girly e Sem filtro têm os deles; os outros temas usam estes; o Minimalista,
 * que é "sem enfeite nenhum", fica só com o nome.
 */
const EMOJI_PESSOA: Record<string, string> = { MORADIA: "🏠", ALIMENTACAO: "🍽️", TRANSPORTE: "🚗", SAUDE: "💊", LAZER: "🎉", EDUCACAO: "📚", IMPOSTOS: "🧾", OUTROS: "📦" };
const EMOJI_EMPRESA: Record<string, string> = { MORADIA: "🏢", ALIMENTACAO: "📦", TRANSPORTE: "🚚", SAUDE: "👥", LAZER: "🤝", EDUCACAO: "📣", IMPOSTOS: "🧾", OUTROS: "🗂️" };

const COR: Record<EstadoDaCategoria, string> = {
  dentro: "var(--color-success)",
  "vai-passar": AMBAR,
  passou: "var(--color-danger)",
  "sem-plano": "var(--color-ink-faint)",
};

/**
 * As categorias do mês no jeito do Copilot (01/10/2026), aprovado pela Dani: a barra pinta pela
 * PREVISÃO (verde fecha dentro, âmbar vai passar, vermelho passou), o que ainda vai vencer
 * aparece só em contorno, "Cobrir" move a sobra de uma para a que passou, e tocar abre o
 * histórico da categoria com o planejado editável ali mesmo.
 */
export function CategoriasDoMes({
  mes,
  linhas,
  cobrir,
}: {
  mes: string;
  linhas: LinhaDaCategoria[];
  cobrir: { de: string; deLabel: string; para: string; paraLabel: string; valor: number } | null;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const { key: tema, kind, categorias } = useProfileTheme();
  const router = useRouter();
  const { showToast, showError } = useToast();
  // A mais urgente (a primeira da lista) já vem aberta: o detalhe faz parte da página.
  const [aberta, setAberta] = useState<string | null>(linhas[0]?.key ?? null);
  const [pendente, iniciar] = useTransition();

  const emoji = (l: LinhaDaCategoria): string | null => {
    // O emoji que ela escolheu (04/10/2026) vale em qualquer tema, até no Minimalista.
    const escolhido = emojiEscolhido(categorias, l.key);
    if (escolhido) return escolhido;
    if (tema === "minimalista") return null;
    const doTema = isParentCategoryKey(l.key) ? emojiDaCategoria(tema, { kind: "parent", value: l.key }) : emojiDaCategoria(tema, { kind: "custom", iconKey: l.iconeProprio });
    if (doTema) return doTema;
    if (!isParentCategoryKey(l.key)) return "🏷️";
    return (ehEmpresa(kind) ? EMOJI_EMPRESA : EMOJI_PESSOA)[l.key] ?? null;
  };

  function fazerCobrir() {
    if (!cobrir) return;
    iniciar(async () => {
      const r = await cobrirCategoriaAction({ de: cobrir.de, para: cobrir.para, valor: cobrir.valor });
      if (r.error) return showError(r.error);
      showToast(`Pronto: ${m(cobrir.valor)} de ${cobrir.deLabel} foram para ${cobrir.paraLabel} neste mês.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {linhas.map((l) => {
          const base = Math.max(l.planejado, l.gasto + l.aVencer, 1);
          const cheio = Math.min(100, (l.gasto / base) * 100);
          const reservado = Math.min(100 - cheio, (l.aVencer / base) * 100);
          const e = emoji(l);
          const estaAberta = aberta === l.key;
          return (
            <li key={l.key} className="py-2.5 first:pt-0">
              <button type="button" onClick={() => setAberta(estaAberta ? null : l.key)} aria-expanded={estaAberta} className="flex w-full flex-col gap-1.5 text-left">
                <span className="flex items-center gap-2">
                  {e && (
                    <span className="w-5 shrink-0 text-center text-base leading-none" aria-hidden>
                      {e}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{l.label}</span>
                  <span className={`shrink-0 text-caption tabular-nums ${l.estado === "passou" ? "font-semibold text-danger" : "text-ink-muted"}`}>
                    {l.estado === "sem-plano" ? `${m(l.gasto)} sem plano` : l.sobra >= 0 ? `sobra ${m(l.sobra)}` : `passou ${m(-l.sobra)}`}
                  </span>
                  <ChevronDown size={14} className={`shrink-0 text-ink-faint transition-transform ${estaAberta ? "rotate-180" : ""}`} aria-hidden />
                </span>
                <span className="flex h-2 overflow-hidden rounded-full bg-surface-2">
                  <span className="h-full" style={{ width: `${cheio}%`, backgroundColor: COR[l.estado] }} />
                  {reservado > 0 && <span className="h-full rounded-r-full border-[1.5px] border-l-0 border-dashed border-ink-faint" style={{ width: `${reservado}%` }} />}
                </span>
              </button>
              {estaAberta && (
                <div className="mt-3 rounded-2xl bg-surface-2 p-3">
                  <DetalheDaCategoria l={l} mes={mes} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-success" /> vai fechar dentro
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: AMBAR }} /> vai passar
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-danger" /> passou
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm border-[1.5px] border-dashed border-ink-faint" /> ainda vai vencer
        </span>
      </div>

      {cobrir && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <ArrowLeftRight size={18} className="shrink-0 text-accent-strong" aria-hidden />
          <span className="min-w-0 flex-1 text-sm text-ink">
            {cobrir.paraLabel} passou {m(cobrir.valor)}. Cobrir com a sobra de {cobrir.deLabel}?
          </span>
          <button type="button" disabled={pendente} onClick={fazerCobrir} className="min-h-11 shrink-0 rounded-full bg-pill px-4 text-sm font-semibold text-on-pill disabled:opacity-50">
            {pendente ? "…" : "Cobrir"}
          </button>
        </div>
      )}

    </div>
  );
}

function DetalheDaCategoria({ l, mes }: { l: LinhaDaCategoria; mes: string }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<number | undefined>(l.planejado || undefined);
  const [pendente, iniciar] = useTransition();
  const topo = Math.max(...l.historico.map((h) => Math.max(h.gasto, h.planejado)), 1) * 1.1;

  function salvar(v: number) {
    iniciar(async () => {
      const r = await definirPlanoDaCategoriaAction({ key: l.key, valor: v });
      if (r.error) return showError(r.error);
      showToast(`${l.label}: ${m(v)} por mês de ${mes} em diante.`);
      router.refresh();
      setEditando(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Numero rotulo={`Em ${mes}`} valor={m(l.gasto + l.aVencer)} />
        <Numero rotulo="Média" valor={m(l.media)} />
        <button type="button" onClick={() => setEditando((v) => !v)} className="flex flex-col gap-0.5 rounded-xl bg-surface px-2 py-2.5 text-center">
          <span className="text-caption text-ink-muted">Planejado</span>
          <span className="flex items-center justify-center gap-1 text-sm font-semibold tabular-nums text-ink underline decoration-dotted underline-offset-4">
            {l.planejado > 0 ? m(l.planejado) : "definir"} <Pencil size={12} aria-hidden />
          </span>
        </button>
      </div>

      {editando && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface p-3">
          <div className="min-w-0 flex-1">
            <CurrencyInputControlled label={`Planejado por mês, de ${mes} em diante`} value={valor} onChange={setValor} />
          </div>
          <button type="button" disabled={pendente || valor === undefined} onClick={() => valor !== undefined && salvar(valor)} className="min-h-11 rounded-full bg-pill px-5 text-sm font-semibold text-on-pill disabled:opacity-50">
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </div>
      )}

      {l.historico.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex h-24 items-end gap-2">
            {l.historico.map((h) => {
              const cor = h.atual ? "bg-accent" : h.planejado > 0 && h.gasto > h.planejado ? "bg-danger/70" : "bg-success/60";
              return (
                <div key={h.rotulo} className="relative flex h-full flex-1 flex-col justify-end">
                  {h.planejado > 0 && <span className="absolute inset-x-0 border-t-2 border-dashed border-ink-faint" style={{ bottom: `${(h.planejado / topo) * 100}%` }} />}
                  <span className={`w-full rounded-t-lg ${cor}`} style={{ height: `${Math.max(2, (h.gasto / topo) * 100)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 text-center text-xs text-ink-faint">
            {l.historico.map((h) => (
              <span key={h.rotulo} className={`flex-1 ${h.atual ? "font-semibold text-ink" : ""}`}>
                {h.rotulo}
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-muted">O tracejado é o planejado de cada mês.</p>
        </div>
      )}

      {l.sugestao && (
        <div className="flex flex-col gap-2 rounded-xl bg-accent-soft p-3 text-sm text-ink">
          <span>
            Passou do plano em {l.sugestao.passou} dos últimos {l.sugestao.meses} meses. Um plano de <b>{m(l.sugestao.sugerido)}</b> é mais realista.
          </span>
          <button type="button" disabled={pendente} onClick={() => salvar(l.sugestao!.sugerido)} className="min-h-11 w-fit rounded-full bg-pill px-4 text-sm font-semibold text-on-pill disabled:opacity-50">
            Usar {m(l.sugestao.sugerido)}
          </button>
        </div>
      )}

      {l.maiores.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-semibold text-ink-muted">Maiores gastos de {mes}</p>
          <ul className="flex flex-col divide-y divide-border">
            {l.maiores.map((g) => (
              <li key={g.descricao} className="flex justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink">
                  {g.descricao}
                  {g.vezes > 1 && <span className="text-ink-muted"> ({g.vezes}x)</span>}
                </span>
                <span className="shrink-0 tabular-nums text-ink">{m(g.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {l.aVencer > 0 && <p className="text-caption text-ink-muted">Ainda vai vencer em {mes}: {m(l.aVencer)}.</p>}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface px-2 py-2.5 text-center">
      <span className="truncate text-caption text-ink-muted">{rotulo}</span>
      <span className="truncate text-sm font-semibold tabular-nums text-ink">{valor}</span>
    </div>
  );
}
