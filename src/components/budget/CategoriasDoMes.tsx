"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Tag } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { OQueFazer } from "./OQueFazer";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, emojiEscolhido, isParentCategoryKey } from "@/lib/categories";
import type { CategoriaDoMes } from "@/lib/planning/orcamento-categorias";
import { definirPlanoDaCategoriaAction } from "@/app/(app)/orcamento/actions";

export type LinhaDaCategoria = CategoriaDoMes & {
  cor: string;
  /** Ícone da categoria dela (as padrão vêm do perfil). */
  iconeProprio?: string;
  maiores: { descricao: string; valor: number; vezes: number }[];
  historico: { rotulo: string; gasto: number; planejado: number; atual: boolean }[];
  media: number;
  sugestao: { passou: number; meses: number; sugerido: number } | null;
};


/**
 * Ao lado do nome: o emoji que a própria pessoa escolheu para a categoria, quando escolheu
 * (emoji fica só no que a pessoa escreve). Sem escolha, um ponto na cor da categoria no tema
 * (versão nova, 11/10/2026: sem emoji na interface).
 */

/**
 * As categorias do mês no jeito do Copilot (01/10/2026), aprovado pela Dani: a barra pinta pela
 * PREVISÃO (verde fecha dentro, âmbar vai passar, vermelho passou), o que ainda vai vencer
 * aparece só em contorno, "Cobrir" move a sobra de uma para a que passou, e tocar abre o
 * histórico da categoria com o planejado editável ali mesmo.
 */
export function CategoriasDoMes({
  mes,
  linhas,
  essenciais = [],
  livre = null,
  diasRestantes = 1,
  abrirResolvendo,
}: {
  mes: string;
  linhas: LinhaDaCategoria[];
  /** Categorias criadas pela pessoa e marcadas "É essencial": nunca viram origem do remanejo. */
  essenciais?: string[];
  livre?: number | null;
  diasRestantes?: number;
  /** Compatibilidade: a sugestão de um toque saiu para a folha "O que fazer?". */
  cobrir?: unknown;
  /**
   * Categoria que chega pelo link do e-mail "Saúde passou R$ 67" (?resolver=SAUDE): a folha
   * "O que fazer?" dela já abre. Só abre: cobrir ou usar o livre continua pedindo o toque dela.
   */
  abrirResolvendo?: string;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const { categorias } = useProfileTheme();
  // Todas fechadas: o detalhe de cada uma (histórico, lápis, maiores gastos) abre no toque.
  const [aberta, setAberta] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<LinhaDaCategoria | null>(() => linhas.find((l) => l.key === abrirResolvendo && l.estado === "passou") ?? null);
  const paraRemanejo = linhas.map((l) => ({ key: l.key, label: l.label, planejado: l.planejado, gasto: l.gasto + l.aVencer }));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {linhas.map((l) => {
          const gasto = l.gasto + l.aVencer;
          const pct = l.planejado > 0 ? Math.round((gasto / l.planejado) * 100) : null;
          const largura = l.planejado > 0 ? Math.min(100, (gasto / l.planejado) * 100) : 0;
          const passou = l.estado === "passou";
          const estaAberta = aberta === l.key;
          const escolhido = emojiEscolhido(categorias, l.key);
          const Icone = isParentCategoryKey(l.key) ? categoryIcon(categorias, l.key) : (CUSTOM_CATEGORY_ICON_MAP[l.iconeProprio ?? ""] ?? Tag);
          return (
            <li key={l.key} className="py-3.5 first:pt-1">
              <button
                type="button"
                onClick={() => (passou ? setResolvendo(l) : setAberta(estaAberta ? null : l.key))}
                aria-expanded={passou ? undefined : estaAberta}
                className="flex w-full items-start gap-3 text-left"
              >
                {escolhido ? (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl" aria-hidden>
                    {escolhido}
                  </span>
                ) : (
                  <CategoryIcon icon={Icone} color={l.cor} size={44} variant="soft" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[16px] text-ink">{l.label}</span>
                    {pct !== null && (
                      <span className={`shrink-0 text-[16px] tabular-nums ${passou ? "text-danger" : "text-ink"}`}>
                        {pct}
                        <span className="text-[0.75em]">%</span>
                      </span>
                    )}
                  </span>
                  {/* A barra em degradê do verde ao vermelho: o pedaço já gasto mostra até onde chegou. */}
                  <span className="relative h-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${largura}%`, backgroundImage: "linear-gradient(90deg, var(--color-success), #cfaa4e 55%, #c9834a 80%, var(--color-danger))", backgroundSize: `${largura > 0 ? (100 / largura) * 100 : 100}% 100%` }}
                    />
                  </span>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="tabular-nums text-ink-muted">{l.planejado > 0 ? `${m(gasto)} de ${m(l.planejado)}` : `${m(gasto)} sem plano`}</span>
                    {l.planejado > 0 && (
                      <span className={`tabular-nums ${passou ? "text-danger" : "text-success"}`}>{passou ? `passou ${m(Math.abs(l.sobra))}` : `sobram ${m(Math.max(0, l.sobra))}`}</span>
                    )}
                  </span>
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

      <Modal open={resolvendo !== null} onClose={() => setResolvendo(null)} title={resolvendo ? `${resolvendo.label} passou do plano` : ""}>
        {resolvendo && (
          <OQueFazer
            categoria={{ key: resolvendo.key, label: resolvendo.label, planejado: resolvendo.planejado, gasto: resolvendo.gasto + resolvendo.aVencer }}
            categorias={paraRemanejo}
            essenciais={essenciais}
            livre={livre}
            diasRestantes={diasRestantes}
            revisao={resolvendo.sugestao ? { mediana: resolvendo.sugestao.sugerido } : null}
            onFeito={() => setResolvendo(null)}
            oQuePesou={
              resolvendo.maiores.length > 0 ? (
                <ul className="flex flex-col divide-y divide-border">
                  {resolvendo.maiores.map((g) => (
                    <li key={g.descricao} className="flex items-center gap-3 py-2">
                      <LogoDoLancamento descricao={g.descricao} icon={Tag} size={36} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {g.descricao}
                        {g.vezes > 1 && <span className="text-ink-muted"> ({g.vezes}x)</span>}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink">{m(g.valor)}</span>
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        )}
      </Modal>
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
