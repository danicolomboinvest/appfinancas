"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { NovaCategoria } from "@/components/entries/NovaCategoria";
import type { ParentCategory } from "@prisma/client";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import {
  CORES_DE_CATEGORIA,
  CUSTOM_CATEGORY_ICON_OPTIONS,
  PARENT_CATEGORIES,
  PARENT_CATEGORY_COLOR,
  categoriaOculta,
  colorForCategorySlice,
  corEscolhida,
  emojiEscolhido,
  emojiValido,
  categoryDefaultLabel,
  categoryLabel,
} from "@/lib/categories";
import { apagarCategoriaPropriaAction, editarCategoriaPropriaAction, lancamentosDaCategoriaAction, salvarCategoriaPadraoAction } from "./actions";

type Propria = { id: string; name: string; icon: string };

/**
 * As categorias do perfil, editáveis (01/10/2026). A cliente queria tirar "Impostos", que não usa,
 * renomear as outras e trocar ícones, inclusive das que ela mesma criou, sem apagar e criar de
 * novo. Padrão: nome, ícone e esconder (a escondida sai das escolhas, mas os lançamentos antigos
 * continuam com ela). As dela: nome, ícone e apagar.
 */
export function EditorDeCategorias({ proprias }: { proprias: Propria[] }) {
  const { categorias } = useProfileTheme();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [aberta, setAberta] = useState<string | null>(null);
  const [corDe, setCorDe] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [, iniciar] = useTransition();

  // Versão nova (protótipo, #configuracoes-categorias): cada categoria numa linha com a bolinha da
  // cor, o nome (toque para editar nome, ícone e emoji), "Cor" e a chave Visível.
  function salvarPadrao(chave: ParentCategory, muda: { oculta?: boolean; cor?: string | null }) {
    const pref = categorias.prefs[chave] ?? {};
    iniciar(async () => {
      const r = await salvarCategoriaPadraoAction({
        key: chave,
        nome: pref.nome ?? "",
        icone: pref.icone ?? null,
        emoji: pref.emoji ?? null,
        oculta: muda.oculta ?? pref.oculta === true,
        cor: muda.cor !== undefined ? muda.cor : (pref.cor ?? null),
      });
      if (r.error) return showError(r.error);
      router.refresh();
    });
  }
  function salvarCorPropria(c: Propria, cor: string | null) {
    iniciar(async () => {
      const r = await editarCategoriaPropriaAction({ id: c.id, nome: c.name, icone: c.icon, cor });
      if (r.error) return showError(r.error);
      router.refresh();
    });
  }

  const grupo = "overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]";
  const linha = (chave: string, nome: string, cor: string, oculta: boolean | null, aoCor: (c: string | null) => void, padrao: string, editor: React.ReactNode) => (
    <li key={chave} className="border-t border-border first:border-t-0">
      {aberta === chave ? (
        <div className="bg-surface-2 p-3">{editor}</div>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-2" data-categoria={chave}>
          <span className={`size-3.5 shrink-0 rounded-full ${oculta ? "opacity-40" : ""}`} style={{ background: cor }} aria-hidden />
          <button type="button" onClick={() => setAberta(chave)} className={`min-w-0 flex-1 truncate text-left text-[15px] ${oculta ? "text-ink-faint" : "text-ink"}`}>
            {nome}
          </button>
          <button type="button" onClick={() => setCorDe(corDe === chave ? null : chave)} aria-expanded={corDe === chave} className="min-h-11 shrink-0 px-1.5 text-sm text-accent-strong underline-offset-4 hover:underline">
            Cor
          </button>
          {oculta !== null && (
            <button
              type="button"
              role="switch"
              aria-checked={!oculta}
              aria-label={`${nome}: ${oculta ? "escondida" : "visível"}`}
              onClick={() => salvarPadrao(chave as ParentCategory, { oculta: !oculta })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${!oculta ? "bg-accent" : "bg-[color-mix(in_srgb,var(--color-ink)_16%,transparent)]"}`}
            >
              <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${!oculta ? "left-[22px]" : "left-0.5"}`} />
            </button>
          )}
        </div>
      )}
      {corDe === chave && aberta !== chave && (
        <div className="px-4 pb-3">
          <EscolherCor
            valor={cor === padrao ? null : cor}
            padrao={padrao}
            onEscolher={(c) => {
              setCorDe(null);
              aoCor(c);
            }}
          />
        </div>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">Renomeie, troque a cor ou esconda categorias. As escondidas saem das escolhas; os lançamentos antigos continuam com elas.</p>
      <ul className={grupo} data-lista-categorias>
        {PARENT_CATEGORIES.map((key) =>
          linha(
            key,
            categoryLabel(categorias, key),
            corEscolhida(categorias, key) ?? PARENT_CATEGORY_COLOR[key],
            categoriaOculta(categorias, key),
            (c) => salvarPadrao(key, { cor: c }),
            PARENT_CATEGORY_COLOR[key],
            <EditarPadrao chave={key} onFechar={() => setAberta(null)} />,
          ),
        )}
        {proprias.map((c) =>
          linha(
            c.id,
            c.name,
            colorForCategorySlice({ kind: "custom", value: c.id }, categorias),
            null,
            (cor) => salvarCorPropria(c, cor),
            colorForCategorySlice({ kind: "custom", value: c.id }, null),
            <EditarPropria categoria={c} outras={proprias} onFechar={() => setAberta(null)} />,
          ),
        )}
      </ul>
      <button type="button" onClick={() => setNova(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
        <Plus size={18} aria-hidden /> Nova categoria
      </button>
      <Modal open={nova} onClose={() => setNova(false)} title="Nova categoria">
        {nova && (
          <NovaCategoria
            existentes={[...proprias.map((c) => c.name), ...PARENT_CATEGORIES.map((k) => categoryLabel(categorias, k))]}
            onCriada={(c) => {
              setNova(false);
              showToast(`${c.name} criada`);
              router.refresh();
            }}
          />
        )}
      </Modal>
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

export function EditarPropria({ categoria, onFechar, outras = [] }: { categoria: Propria; onFechar: () => void; /** As outras categorias dela, para onde os lançamentos podem ir ao apagar. */ outras?: Propria[] }) {
  const { showToast, showError } = useToast();
  const { categorias } = useProfileTheme();
  const [nome, setNome] = useState(categoria.name);
  const [icone, setIcone] = useState<string | null>(categoria.icon);
  const [cor, setCor] = useState<string | null>(corEscolhida(categorias, categoria.id));
  const [emoji, setEmoji] = useState(emojiEscolhido(categorias, categoria.id) ?? "");
  const [essencial, setEssencial] = useState(categorias.prefs.proprias?.[categoria.id]?.essencial === true);
  const [confirmar, setConfirmar] = useState(false);
  // Apagar com lançamentos (12/10/2026): quantos são e para qual categoria vão.
  const [quantos, setQuantos] = useState<number | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    iniciar(async () => {
      const r = await editarCategoriaPropriaAction({ id: categoria.id, nome, icone: icone ?? "tag", cor, emoji: emoji || null, essencial });
      if (r.error) return showError(r.error);
      showToast("Categoria salva.");
      onFechar();
    });
  }

  function apagar() {
    if (!confirmar) {
      setConfirmar(true);
      iniciar(async () => setQuantos(await lancamentosDaCategoriaAction(categoria.id)));
      return;
    }
    if (quantos && !destino) return showError("Escolha para qual categoria vão os lançamentos.");
    iniciar(async () => {
      const r = await apagarCategoriaPropriaAction(categoria.id, destino);
      if (r.error) return showError(r.error);
      showToast(quantos ? "Categoria apagada. Os lançamentos foram para a outra categoria." : "Categoria apagada.");
      onFechar();
    });
  }
  const destinos = [
    ...PARENT_CATEGORIES.filter((k) => !categoriaOculta(categorias, k)).map((k) => ({ id: k as string, nome: categoryLabel(categorias, k) })),
    ...outras.filter((o) => o.id !== categoria.id).map((o) => ({ id: o.id, nome: o.name })),
  ];

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
      {/* Versão nova: categoria essencial nunca é sugerida para cobrir outra que passou do plano. */}
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">É essencial</span>
          <span className="block text-caption text-ink-muted">O app nunca sugere tirar dinheiro dela para cobrir outra.</span>
        </span>
        <input type="checkbox" checked={essencial} onChange={(e) => setEssencial(e.target.checked)} className="h-5 w-5 shrink-0 accent-accent" />
      </label>
      <button type="button" disabled={pendente || !nome.trim() || (emoji !== "" && !emojiValido(emoji))} onClick={salvar} className="mt-1 min-h-[52px] w-full rounded-full [background:var(--botao-fundo,var(--color-ink))] text-[16px] font-semibold [color:var(--botao-tinta,var(--color-canvas))] disabled:opacity-50">
        {pendente && !confirmar ? "Salvando…" : "Salvar"}
      </button>
      {confirmar && quantos !== null && quantos > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3" data-destino-ao-apagar>
          <p className="text-sm font-medium text-ink">
            {quantos === 1 ? "1 lançamento está nela." : `${quantos} lançamentos estão nela.`} Para qual categoria eles vão?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {destinos.map((d) => (
              <button key={d.id} type="button" aria-pressed={destino === d.id} onClick={() => setDestino(d.id)} className="min-h-10 rounded-full bg-surface px-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)] aria-pressed:bg-ink aria-pressed:text-canvas aria-pressed:shadow-none">
                {d.nome}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" disabled={pendente || (confirmar && quantos === null)} onClick={apagar} className="mx-auto inline-flex min-h-11 items-center px-3 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline" data-apagar-categoria>
        {!confirmar ? "Apagar categoria" : quantos ? "Apagar e mover os lançamentos" : "Toque de novo para apagar"}
      </button>
    </div>
  );
}
