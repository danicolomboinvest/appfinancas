"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useFolhaDaMeta } from "./FolhaDaMeta";

/** Rola até o cartão da meta e acende o contorno por um instante (protótipo: "destaque"). */
export function irParaOCartao(id: string) {
  const alvo = document.getElementById(`meta-${id}`);
  if (!alvo) return;
  const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  alvo.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  alvo.classList.remove("mt-destaque");
  void alvo.offsetWidth;
  alvo.classList.add("mt-destaque");
  window.setTimeout(() => alvo.classList.remove("mt-destaque"), 1600);
}

export function IrParaAMeta({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => irParaOCartao(id)}>
      {children}
    </button>
  );
}

/**
 * A fileira de fotos (protótipo #metas, rodada 4): um toque leva direto ao cartão da meta. O anel
 * em volta da foto é quanto ela já tem. A última bolinha abre a Nova meta.
 */
export function FileiraDeFotos({
  metas,
  novaEmDuasLinhas,
}: {
  metas: { id: string; curto: string; nome: string; foto: string; pct: number }[];
  novaEmDuasLinhas: boolean;
}) {
  const { abrir } = useFolhaDaMeta();
  return (
    <div role="list" aria-label="Ir para a meta" className="-mx-5 flex justify-between gap-1.5 overflow-x-auto px-5 py-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {metas.map((m) => (
        <button
          key={m.id}
          type="button"
          role="listitem"
          aria-label={`${m.nome}, ${m.pct}%`}
          onClick={() => irParaOCartao(m.id)}
          className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-ink max-[360px]:w-[60px]"
        >
          <span className="mt-foto-anel flex size-16 items-center justify-center rounded-full p-[3px] max-[360px]:size-14" style={{ ["--p" as string]: m.pct }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto da meta */}
            <img src={m.foto} alt="" loading="lazy" decoding="async" className="size-full rounded-full object-cover shadow-[0_0_0_2px_var(--color-canvas)]" />
          </span>
          {/* Sem reticências (regra dela): nome comprido ("Apartamento") diminui um pouco e, se ainda não couber, quebra com hífen. */}
          <b className={`max-w-full text-center font-semibold leading-tight hyphens-auto [overflow-wrap:anywhere] ${m.curto.length > 9 ? "text-[12px]" : "text-[13px] max-[360px]:text-xs"}`} lang="pt-BR">{m.curto}</b>
          <small className="text-xs font-medium leading-none text-ink-muted">{m.pct}%</small>
        </button>
      ))}
      <button type="button" role="listitem" onClick={() => abrir()} className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-ink max-[360px]:w-[60px]">
        <span className="flex size-16 items-center justify-center rounded-full text-ink-muted shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] max-[360px]:size-14">
          <Plus size={24} strokeWidth={1.6} aria-hidden />
        </span>
        {novaEmDuasLinhas ? (
          <>
            <b className="text-[13px] font-semibold leading-tight">Nova</b>
            <small className="text-xs font-medium leading-none text-ink-muted">meta</small>
          </>
        ) : (
          <b className="text-[13px] font-medium leading-tight">Nova meta</b>
        )}
      </button>
    </div>
  );
}

/** Depois de criar: a lista abre já rolada até a meta nova, com o contorno aceso (protótipo). */
export function DestacarMetaNova() {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const id = params.get("nova");
  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(() => {
      irParaOCartao(id);
      router.replace(caminho, { scroll: false });
    }, 150);
    return () => window.clearTimeout(t);
  }, [id, router, caminho]);
  return null;
}
