"use client";

import { useState, useTransition } from "react";
import { ChevronRight, EyeOff, Tag } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import {
  CORES_DE_CATEGORIA,
  CUSTOM_CATEGORY_ICON_MAP,
  CUSTOM_CATEGORY_ICON_OPTIONS,
  PARENT_CATEGORIES,
  PARENT_CATEGORY_COLOR,
  categoriaOculta,
  colorForCategorySlice,
  corEscolhida,
  emojiEscolhido,
  emojiValido,
  categoryDefaultLabel,
  categoryIcon,
  categoryLabel,
  subcategoriesFor,
} from "@/lib/categories";
import { apagarCategoriaPropriaAction, editarCategoriaPropriaAction, salvarCategoriaPadraoAction } from "./actions";

type Propria = { id: string; name: string; icon: string };

/**
 * As categorias do perfil, editáveis (01/10/2026). A cliente queria tirar "Impostos", que não usa,
 * renomear as outras e trocar ícones, inclusive das que ela mesma criou, sem apagar e criar de
 * novo. Padrão: nome, ícone e esconder (a escondida sai das escolhas, mas os lançamentos antigos
 * continuam com ela). As dela: nome, ícone e apagar.
 */
export function EditorDeCategorias({ proprias }: { proprias: Propria[] }) {
  const { categorias, kind } = useProfileTheme();
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-ink">Categorias do app</p>
        <ul className="mt-1 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {PARENT_CATEGORIES.map((key) => {
            const Icone = categoryIcon(categorias, key);
            const oculta = categoriaOculta(categorias, key);
            return aberta === key ? (
              <li key={key} className="bg-surface-2 p-3">
                <EditarPadrao chave={key} onFechar={() => setAberta(null)} />
              </li>
            ) : (
              <li key={key}>
                <button type="button" onClick={() => setAberta(key)} className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong ${oculta ? "opacity-40" : ""}`}>
                    {emojiEscolhido(categorias, key) ? <span className="text-lg leading-none">{emojiEscolhido(categorias, key)}</span> : <Icone size={18} strokeWidth={1.75} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${oculta ? "text-ink-faint" : "text-ink"}`}>{categoryLabel(categorias, key)}</span>
                    <span className="block truncate text-caption text-ink-faint">
                      {oculta ? "Escondida" : subcategoriesFor(kind, key).slice(0, 4).join(", ")}
                    </span>
                  </span>
                  {oculta && <EyeOff size={16} className="shrink-0 text-ink-faint" aria-hidden />}
                  <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-ink">Criadas por você</p>
        {proprias.length === 0 ? (
          <p className="text-caption text-ink-muted">Você ainda não criou nenhuma. Dá para criar no Orçamento ou na hora de lançar um gasto (+ Nova).</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {proprias.map((c) => {
              const Icone = CUSTOM_CATEGORY_ICON_MAP[c.icon] ?? Tag;
              return aberta === c.id ? (
                <li key={c.id} className="bg-surface-2 p-3">
                  <EditarPropria categoria={c} onFechar={() => setAberta(null)} />
                </li>
              ) : (
                <li key={c.id}>
                  <button type="button" onClick={() => setAberta(c.id)} className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                      {emojiEscolhido(categorias, c.id) ? <span className="text-lg leading-none">{emojiEscolhido(categorias, c.id)}</span> : <Icone size={18} strokeWidth={1.75} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.name}</span>
                    <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EscolherIcone({ valor, onEscolher, comPadrao }: { valor: string | null; onEscolher: (k: string | null) => void; comPadrao?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {comPadrao && (
        <button
          type="button"
          onClick={() => onEscolher(null)}
          aria-pressed={valor === null}
          className={`min-h-11 rounded-full border px-3 text-xs font-medium ${valor === null ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong text-ink-muted"}`}
        >
          O de sempre
        </button>
      )}
      {CUSTOM_CATEGORY_ICON_OPTIONS.map((o) => {
        const Icone = o.icon;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onEscolher(o.key)}
            aria-pressed={valor === o.key}
            aria-label={o.label}
            title={o.label}
            className={`flex size-11 items-center justify-center rounded-full border ${valor === o.key ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong text-ink-muted hover:text-ink"}`}
          >
            <Icone size={18} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A cor da categoria (04/10/2026): as bolinhas são os tokens do tema (CORES_DE_CATEGORIA), então a
 * escolha vale no claro e no escuro. "A de sempre" volta para a cor de fábrica.
 */
function EscolherCor({ valor, onEscolher, padrao }: { valor: string | null; onEscolher: (c: string | null) => void; padrao: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onEscolher(null)}
        aria-pressed={valor === null}
        className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${valor === null ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong text-ink-muted"}`}
      >
        <span className="size-3.5 rounded-full" style={{ background: padrao }} aria-hidden />A de sempre
      </button>
      {CORES_DE_CATEGORIA.map((cor, i) => (
        <button
          key={cor}
          type="button"
          onClick={() => onEscolher(cor)}
          aria-pressed={valor === cor}
          aria-label={`Cor ${i + 1}`}
          className={`flex size-11 items-center justify-center rounded-full border ${valor === cor ? "border-ink" : "border-transparent"}`}
        >
          <span className="size-6 rounded-full" style={{ background: cor }} />
        </button>
      ))}
    </div>
  );
}

/**
 * Emoji do celular no lugar do ícone (sugestão de cliente, 04/10/2026). Um campo onde ela abre o
 * teclado de emoji do celular; vale um emoji só, e o "x" volta para o ícone.
 */
function EscolherEmoji({ valor, onEscolher }: { valor: string; onEscolher: (e: string) => void }) {
  const invalido = valor !== "" && !emojiValido(valor);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          value={valor}
          onChange={(e) => onEscolher(e.target.value.trim())}
          placeholder="🙂"
          aria-label="Emoji da categoria"
          maxLength={16}
          className="min-h-11 w-16 rounded-xl border border-border-strong bg-surface text-center text-2xl text-ink outline-none focus:border-accent"
        />
        {valor ? (
          <button type="button" onClick={() => onEscolher("")} className="min-h-11 px-2 text-sm text-ink-muted hover:text-ink">
            Tirar emoji
          </button>
        ) : (
          <span className="text-caption text-ink-faint">Use o teclado de emoji do celular. Fica no lugar do ícone.</span>
        )}
      </div>
      {invalido && <p className="text-caption text-danger">Coloque um emoji só.</p>}
    </div>
  );
}

const CAMPO = "min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent";

export function EditarPadrao({ chave, onFechar }: { chave: ParentCategory; onFechar: () => void }) {
  const { categorias } = useProfileTheme();
  const { showToast, showError } = useToast();
  const pref = categorias.prefs[chave] ?? {};
  const [nome, setNome] = useState(pref.nome ?? "");
  const [icone, setIcone] = useState<string | null>(pref.icone ?? null);
  const [cor, setCor] = useState<string | null>(pref.cor ?? null);
  const [emoji, setEmoji] = useState(pref.emoji ?? "");
  const [oculta, setOculta] = useState(pref.oculta === true);
  const [pendente, iniciar] = useTransition();
  const deFabrica = categoryDefaultLabel(categorias, chave);

  function salvar(valores: { nome: string; icone: string | null; oculta: boolean; cor: string | null; emoji: string | null }) {
    iniciar(async () => {
      const r = await salvarCategoriaPadraoAction({ key: chave, ...valores });
      if (r.error) return showError(r.error);
      showToast("Categoria salva.");
      onFechar();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={deFabrica} maxLength={40} className={CAMPO} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Ícone</span>
        <EscolherIcone valor={icone} onEscolher={setIcone} comPadrao />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Ou um emoji</span>
        <EscolherEmoji valor={emoji} onEscolher={setEmoji} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Cor</span>
        <EscolherCor valor={cor} onEscolher={setCor} padrao={PARENT_CATEGORY_COLOR[chave]} />
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" checked={oculta} onChange={(e) => setOculta(e.target.checked)} className="h-5 w-5 shrink-0 accent-accent" />
        Esconder: não uso esta categoria
      </label>
      {oculta && <p className="text-caption text-ink-muted">Ela sai das escolhas ao lançar e do orçamento. O que você já lançou nela continua aparecendo.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pendente || (emoji !== "" && !emojiValido(emoji))} onClick={() => salvar({ nome, icone, oculta, cor, emoji: emoji || null })} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50">
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onFechar} className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink">
          Cancelar
        </button>
        {(pref.nome || pref.icone || pref.oculta || pref.cor || pref.emoji) && (
          <button type="button" disabled={pendente} onClick={() => salvar({ nome: "", icone: null, oculta: false, cor: null, emoji: null })} className="ml-auto min-h-11 px-3 text-sm font-medium text-accent-strong hover:underline">
            Voltar para &quot;{deFabrica}&quot;
          </button>
        )}
      </div>
    </div>
  );
}

export function EditarPropria({ categoria, onFechar }: { categoria: Propria; onFechar: () => void }) {
  const { showToast, showError } = useToast();
  const { categorias } = useProfileTheme();
  const [nome, setNome] = useState(categoria.name);
  const [icone, setIcone] = useState<string | null>(categoria.icon);
  const [cor, setCor] = useState<string | null>(corEscolhida(categorias, categoria.id));
  const [emoji, setEmoji] = useState(emojiEscolhido(categorias, categoria.id) ?? "");
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    iniciar(async () => {
      const r = await editarCategoriaPropriaAction({ id: categoria.id, nome, icone: icone ?? "tag", cor, emoji: emoji || null });
      if (r.error) return showError(r.error);
      showToast("Categoria salva.");
      onFechar();
    });
  }

  function apagar() {
    if (!confirmar) return setConfirmar(true);
    iniciar(async () => {
      const r = await apagarCategoriaPropriaAction(categoria.id);
      if (r.error) return showError(r.error);
      showToast("Categoria apagada. O que você lançou nela ficou sem categoria.");
      onFechar();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} className={CAMPO} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Ícone</span>
        <EscolherIcone valor={icone} onEscolher={setIcone} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Ou um emoji</span>
        <EscolherEmoji valor={emoji} onEscolher={setEmoji} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Cor</span>
        <EscolherCor valor={cor} onEscolher={setCor} padrao={colorForCategorySlice({ kind: "custom", value: categoria.id })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pendente || !nome.trim() || (emoji !== "" && !emojiValido(emoji))} onClick={salvar} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50">
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onFechar} className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink">
          Cancelar
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={apagar}
          className={`ml-auto min-h-11 rounded-full px-4 text-sm font-semibold ${confirmar ? "bg-danger text-on-accent" : "text-danger hover:bg-danger-soft"}`}
        >
          {confirmar ? "Toque de novo para apagar" : "Apagar"}
        </button>
      </div>
    </div>
  );
}
