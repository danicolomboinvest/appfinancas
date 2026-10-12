"use client";

import { useState, useTransition } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CUSTOM_CATEGORY_ICON_MAP, CUSTOM_CATEGORY_ICON_OPTIONS } from "@/lib/categories";
import { createCategoryAction } from "@/lib/actions/category";

/** As 6 cores da folha (protótipo): as de fábrica, que funcionam no claro e no escuro. */
export const CORES_DA_NOVA = [
  "var(--color-cat-moradia)",
  "var(--color-cat-alimentacao)",
  "var(--color-cat-saude)",
  "var(--color-cat-educacao)",
  "var(--color-cat-lazer)",
  "var(--color-cat-transporte)",
];

/**
 * A folha "Nova categoria" (protótipo, #nova-categoria): a prévia do ícone com o nome, o campo
 * Nome, a grade de 40 ícones de traço, 6 cores, a chave "É essencial · Nunca sugiro tirar dela" e
 * o botão Criar. Abre por cima do Digitar (e em Configurações › Categorias).
 */
export function NovaCategoria({ existentes = [], onCriada, onVoltar }: { existentes?: string[]; onCriada: (c: { id: string; name: string; icon: string }) => void; onVoltar?: () => void }) {
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("paw");
  const [cor, setCor] = useState(CORES_DA_NOVA[4]);
  const [essencial, setEssencial] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const limpo = nome.trim();
  const jaExiste = existentes.some((e) => e.toLowerCase() === limpo.toLowerCase());
  const Icone = CUSTOM_CATEGORY_ICON_MAP[icone];

  function criar() {
    if (!limpo || jaExiste) return;
    setErro(null);
    iniciar(async () => {
      const r = await createCategoryAction(limpo, { icone, cor, essencial }).catch(() => ({ ok: false as const, error: "Não deu para criar. Tente de novo." }));
      if (!r.ok) return setErro(r.error);
      onCriada({ id: r.id, name: r.name, icon: icone });
    });
  }

  return (
    <div className="flex flex-col gap-3.5" data-nova-categoria>
      {onVoltar && (
        <button type="button" onClick={onVoltar} className="-mt-1 flex min-h-11 items-center gap-1 self-start text-sm text-ink-muted">
          <ChevronLeft size={16} aria-hidden /> Voltar
        </button>
      )}
      <div className="flex flex-col items-center gap-2 py-1">
        <CategoryIcon icon={Icone} color={cor} size={48} variant="soft" />
        <b className="text-[17px] font-medium text-ink">{limpo || "Nova categoria"}</b>
      </div>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && criar()}
        placeholder="Nome, ex.: Pet"
        aria-label="Nome da categoria"
        maxLength={18}
        autoComplete="off"
        className="min-h-12 rounded-2xl border border-border bg-surface px-4 text-base text-ink outline-none focus:border-ink"
      />
      <h3 className="text-[15px] font-medium text-ink">Ícone</h3>
      <div className="grid grid-cols-8 gap-1.5 max-[359px]:grid-cols-6" role="group" aria-label="Ícone">
        {CUSTOM_CATEGORY_ICON_OPTIONS.map((o) => {
          const I = o.icon;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={icone === o.key}
              aria-label={`Ícone ${o.label}`}
              onClick={() => setIcone(o.key)}
              className="flex aspect-square items-center justify-center rounded-xl text-ink aria-pressed:bg-ink aria-pressed:text-surface"
            >
              <I size={19} strokeWidth={1.6} aria-hidden />
            </button>
          );
        })}
      </div>
      <h3 className="text-[15px] font-medium text-ink">Cor</h3>
      <div className="flex gap-3" role="group" aria-label="Cor">
        {CORES_DA_NOVA.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cor === c}
            aria-label="Cor"
            onClick={() => setCor(c)}
            className="flex size-9 items-center justify-center rounded-full text-white aria-pressed:ring-2 aria-pressed:ring-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-canvas"
            style={{ background: c }}
          >
            {cor === c && <Check size={16} strokeWidth={2.4} aria-hidden />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-medium text-ink">É essencial</b>
          <small className="text-caption text-ink-muted">Nunca sugiro tirar dela</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={essencial}
          aria-label="É essencial"
          onClick={() => setEssencial((v) => !v)}
          className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border-strong)] transition-colors aria-checked:bg-ink"
        >
          <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${essencial ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <button type="button" disabled={pendente || !limpo || jaExiste} onClick={criar} className="min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-40">
        {jaExiste ? "Essa já existe" : "Criar"}
      </button>
      <p className="text-center text-xs text-ink-muted">Também em Configurações › Categorias</p>
    </div>
  );
}
