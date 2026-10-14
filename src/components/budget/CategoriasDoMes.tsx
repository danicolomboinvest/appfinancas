"use client";

import { Selinho } from "@/components/ui/Selinho";
import { useSelos } from "@/lib/ui/selos";
import { brilharQuandoAparecer } from "@/lib/ui/brilho";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Tag } from "lucide-react";
import Link from "next/link";
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
  hrefTransacoes,
}: {
  /** As Transações do mês ("/mensal/2026/10"); o painel abre já filtrado na categoria. */
  hrefTransacoes?: string;
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
  // O selinho da categoria ("pontual"), marcado pela folha "O que fazer?" (14/10/2026).
  const selos = useSelos();
  // Todas fechadas: o detalhe de cada uma (histórico, lápis, maiores gastos) abre no toque.
  const [aberta, setAberta] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<LinhaDaCategoria | null>(() => linhas.find((l) => l.key === abrirResolvendo && l.estado === "passou") ?? null);
  const abertaLinha = linhas.find((l) => l.key === aberta) ?? null;
  const paraRemanejo = linhas.map((l) => ({ key: l.key, label: l.label, planejado: l.planejado, gasto: l.gasto + l.aVencer }));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface px-4">
        {linhas.map((l) => {
          const gasto = l.gasto + l.aVencer;
          // Estorno maior que o gasto (devolução de compra do mês passado): a barra fica em 0%, nunca "-17%".
          const pct = l.planejado > 0 ? Math.max(0, Math.round((gasto / l.planejado) * 100)) : null;
          const largura = l.planejado > 0 ? Math.min(100, (gasto / l.planejado) * 100) : 0;
          const passou = l.estado === "passou";
          const escolhido = emojiEscolhido(categorias, l.key);
          const Icone = isParentCategoryKey(l.key) ? categoryIcon(categorias, l.key) : (CUSTOM_CATEGORY_ICON_MAP[l.iconeProprio ?? ""] ?? Tag);
          return (
            <li key={l.key} data-brilho={`cat-${l.key}`} className="-mx-4 px-4 py-3.5">
              <button
                type="button"
                onClick={() => setAberta(l.key)}
                aria-haspopup="dialog"
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
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-[16px] text-ink">{l.label}</span>
                      {selos[`cat-${l.key}@${mes ?? ""}`] && <Selinho>{selos[`cat-${l.key}@${mes ?? ""}`]}</Selinho>}
                    </span>
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
            </li>
          );
        })}
      </ul>

      <Modal open={abertaLinha !== null} onClose={() => setAberta(null)} title={abertaLinha?.label ?? ""}>
        {abertaLinha && (
          <DetalheDaCategoria
            l={abertaLinha}
            mes={mes}
            hrefTransacoes={hrefTransacoes ? `${hrefTransacoes}?categoria=${encodeURIComponent(abertaLinha.key)}` : undefined}
            onOQueFazer={() => {
              setAberta(null);
              setResolvendo(abertaLinha);
            }}
          />
        )}
      </Modal>

      <Modal open={resolvendo !== null} onClose={() => setResolvendo(null)} title="O que fazer?">
        {resolvendo && (
          <OQueFazer
            mes={mes}
            quantos={resolvendo.maiores.reduce((s, g) => s + g.vezes, 0) || undefined}
            icone={<IconeDaLinha l={resolvendo} />}
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

function IconeDaLinha({ l }: { l: LinhaDaCategoria }) {
  const { categorias } = useProfileTheme();
  const escolhido = emojiEscolhido(categorias, l.key);
  const Icone = isParentCategoryKey(l.key) ? categoryIcon(categorias, l.key) : (CUSTOM_CATEGORY_ICON_MAP[l.iconeProprio ?? ""] ?? Tag);
  if (escolhido)
    return (
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-2xl" aria-hidden>
        {escolhido}
      </span>
    );
  return <CategoryIcon icon={Icone} color={l.cor} size={48} variant="soft" />;
}

/**
 * O painel da categoria (protótipo, #categoria): o mês x plano com a barra, as colunas dos últimos
 * meses com a média tracejada, uma frase, "Onde mais foi" e "Ver todas as transações". Na que
 * passou, "O que fazer?" abre a folha dos caminhos. O planejado continua editável no lápis.
 */
function DetalheDaCategoria({ l, mes, hrefTransacoes, onOQueFazer }: { l: LinhaDaCategoria; mes: string; hrefTransacoes?: string; onOQueFazer: () => void }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showError } = useToast();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<number | undefined>(l.planejado || undefined);
  const [pendente, iniciar] = useTransition();
  const gasto = l.gasto + l.aVencer;
  const passou = l.estado === "passou";
  // A média dos 3 meses fechados mais recentes (protótipo r65), sem o mês aberto.
  const fechados = l.historico.filter((h) => !h.atual);
  const ultimos3 = fechados.slice(-3);
  const media = ultimos3.length ? ultimos3.reduce((s2, h) => s2 + h.gasto, 0) / ultimos3.length : 0;
  const topo = Math.max(media, gasto, ...l.historico.map((h) => h.gasto), 1) * 1.1;
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
  const frase = passou
    ? `Passou ${m(gasto - l.planejado)} do plano`
    : gasto === 0
      ? `Nada em ${mes} · média ${m(media)}`
      : gasto > media && media > 0
        ? `${m(gasto - media)} acima da média`
        : media > 0
          ? `${m(media - gasto)} abaixo da média`
          : "";

  function salvar(v: number) {
    iniciar(async () => {
      const r = await definirPlanoDaCategoriaAction({ key: l.key, valor: v });
      if (r.error) return showError(r.error);
      // Sem aviso (14/10/2026): o plano novo aparece no painel e a linha acende.
      router.refresh();
      setEditando(false);
      brilharQuandoAparecer(`cat-${l.key}`);
    });
  }

  return (
    <div className="flex flex-col gap-4" data-painel-categoria>
      <div className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <small className="text-sm text-ink-muted">{mesCap} até agora</small>
        <b className="flex flex-wrap items-baseline gap-x-2 font-light">
          <span className="text-[1.75rem] tabular-nums tracking-[-0.02em] text-ink">{m(gasto)}</span>
          {l.planejado > 0 && <em className="not-italic text-[15px] text-ink-muted">de {m(l.planejado)}</em>}
        </b>
        {l.planejado > 0 && (
          <span className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span className={`absolute inset-y-0 left-0 rounded-full ${passou ? "bg-danger" : "bg-ink"}`} style={{ width: `${Math.min(100, (gasto / l.planejado) * 100)}%` }} />
          </span>
        )}
      </div>

      {l.historico.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="relative flex h-32 items-end gap-2">
            {l.historico.map((h) => (
              <div key={h.rotulo} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-ink-muted">{Math.round(h.gasto).toLocaleString("pt-BR")}</span>
                <span className={`w-full max-w-9 rounded-t-lg ${h.atual ? (passou ? "bg-danger" : "bg-accent") : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border)]"}`} style={{ height: `${Math.max(2, (h.gasto / topo) * 78)}%` }} />
              </div>
            ))}
            {media > 0 && (
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-muted" style={{ bottom: `${(media / topo) * 78}%` }} />
            )}
          </div>
          <div className="flex gap-2 text-center text-xs text-ink-faint">
            {l.historico.map((h) => (
              <span key={h.rotulo} className={`flex-1 ${h.atual ? "font-semibold text-ink" : ""}`}>
                {h.rotulo.charAt(0).toUpperCase() + h.rotulo.slice(1)}
              </span>
            ))}
          </div>
          {media > 0 && (
            <p className="mt-1 flex items-center justify-center gap-2 text-xs text-ink-muted">
              <span className="w-5 border-t border-dashed border-ink-muted" aria-hidden /> média dos últimos 3 meses {m(media)}
            </p>
          )}
        </div>
      )}

      {frase && <p className={`text-center text-[15px] ${passou ? "text-danger" : "text-ink"}`}>{frase}</p>}

      {passou && (
        <button type="button" onClick={onOQueFazer} className="min-h-12 rounded-full bg-ink text-base font-medium text-surface">
          O que fazer?
        </button>
      )}

      {l.maiores.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[15px] font-medium text-ink">Onde mais foi em {mes}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {l.maiores.map((g) => (
              <li key={g.descricao} className="flex items-center gap-3 py-2.5 text-[15px]">
                <LogoDoLancamento descricao={g.descricao} icon={Tag} size={36} />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {g.descricao}
                  {g.vezes > 1 && <span className="text-ink-muted"> ({g.vezes}x)</span>}
                </span>
                <span className="shrink-0 tabular-nums text-ink">− {money(g.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {l.aVencer > 0 && <p className="text-caption text-ink-muted">Ainda vai vencer em {mes}: {m(l.aVencer)}.</p>}

      {l.sugestao && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-3 text-sm text-ink">
          <span>
            Passou do plano em {l.sugestao.passou} dos últimos {l.sugestao.meses} meses. Um plano de <b>{m(l.sugestao.sugerido)}</b> é mais realista.
          </span>
          <button type="button" disabled={pendente} onClick={() => salvar(l.sugestao!.sugerido)} className="min-h-11 w-fit rounded-full bg-pill px-4 text-sm font-semibold text-on-pill disabled:opacity-50">
            Usar {m(l.sugestao.sugerido)}
          </button>
        </div>
      )}

      {l.key === "SEM" ? null : editando ? (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface-2 p-3">
          <div className="min-w-0 flex-1">
            <CurrencyInputControlled label={`Planejado por mês, de ${mes} em diante`} value={valor} onChange={setValor} />
          </div>
          <button type="button" disabled={pendente || valor === undefined} onClick={() => valor !== undefined && salvar(valor)} className="min-h-11 rounded-full bg-pill px-5 text-sm font-semibold text-on-pill disabled:opacity-50">
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="inline-flex min-h-11 items-center justify-center gap-1.5 self-center text-sm text-ink-muted">
          <Pencil size={14} aria-hidden /> {l.planejado > 0 ? `Plano de ${m(l.planejado)} por mês` : "Definir um plano"}
        </button>
      )}

      {hrefTransacoes && (
        <Link href={hrefTransacoes} className="flex min-h-12 items-center justify-center rounded-full text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
          Ver todas as transações
        </Link>
      )}
    </div>
  );
}
