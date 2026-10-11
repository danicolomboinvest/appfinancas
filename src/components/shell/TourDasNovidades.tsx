"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { ABERTURA_DAS_NOVIDADES, CHAVE_LOCAL_NOVIDADES, PASSOS_DAS_NOVIDADES, contadorDoPasso } from "@/lib/novidades/passos";
import { marcarNovidadesVistasAction } from "./novidades-actions";
import { TOUR_DONE_EVENT } from "./InstallAppBanner";
import { trackEvent } from "@/lib/usage/track-event";

const RESUMO = "/mensal/foco";

function lerLocal(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_LOCAL_NOVIDADES) === "1";
  } catch {
    return false;
  }
}

/** O elemento de verdade que o passo ilumina, entre os que estão visíveis na tela agora. */
function alvoVisivel(nome: string): DOMRect | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${nome}"]`))) {
    const r = el.getBoundingClientRect();
    const opaco = Number(getComputedStyle(el).opacity) > 0.2;
    if (opaco && r.width > 4 && r.height > 4 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight) return r;
  }
  return null;
}

/**
 * "Tivemos uma mudança" (versão nova, 11/10/2026). Todo mundo vê uma vez, quem chegou agora e
 * quem já usava: primeiro a abertura com "Ver o que mudou" e "Pular", depois cinco passos que
 * iluminam o elemento de verdade da tela, com "2 de 5", "Próximo" e "Pular" sempre à vista.
 *
 * A marca de visto é da conta (servidor) e também do aparelho (para não piscar enquanto o
 * servidor responde). Configurações › Ajuda › "Ver de novo o que mudou" reabre pelo endereço
 * /mensal/foco?novidades=1.
 */
export function TourDasNovidades({ jaViu }: { jaViu: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [fase, setFase] = useState<"fechado" | "abertura" | number>("fechado");
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const pedido = new URLSearchParams(window.location.search).get("novidades") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o endereço e o aparelho, que só existem no cliente
    if (pedido || (!jaViu && !lerLocal())) setFase("abertura");
  }, [jaViu, pathname]);

  const passo = typeof fase === "number" ? PASSOS_DAS_NOVIDADES[fase] : null;

  const medir = useCallback(() => {
    setRect(passo ? alvoVisivel(passo.alvo) : null);
  }, [passo]);

  useEffect(() => {
    if (!passo) return;
    // O alvo pode entrar depois (troca de tela, o + que volta): mede agora e de novo logo depois.
    window.scrollTo({ top: 0 });
    const ids = [requestAnimationFrame(medir), window.setTimeout(medir, 250), window.setTimeout(medir, 700)];
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(ids[0]);
      window.clearTimeout(ids[1]);
      window.clearTimeout(ids[2]);
      window.removeEventListener("resize", medir);
    };
  }, [passo, medir, pathname]);

  const encerrar = useCallback(
    (como: "terminou" | "pulou") => {
      try {
        window.localStorage.setItem(CHAVE_LOCAL_NOVIDADES, "1");
        // O tour antigo de boas-vindas não volta: este substitui ele.
        window.localStorage.setItem("welcome-tour-seen", "1");
      } catch {
        // Sem armazenamento: a marca da conta (servidor) segura.
      }
      trackEvent(como === "pulou" ? "novidades_pulou" : "novidades_terminou", typeof fase === "number" ? `/novidades/${fase + 1}` : "/novidades/abertura");
      void marcarNovidadesVistasAction(como);
      setFase("fechado");
      window.dispatchEvent(new Event(TOUR_DONE_EVENT));
      if (new URLSearchParams(window.location.search).get("novidades") === "1") router.replace(pathname);
    },
    [fase, pathname, router],
  );

  if (fase === "fechado") return null;

  const pular = (
    <button type="button" onClick={() => encerrar("pulou")} className="inline-flex min-h-11 items-center px-2 text-[15px] font-medium text-ink-muted hover:text-ink">
      {ABERTURA_DAS_NOVIDADES.pular}
    </button>
  );

  if (fase === "abertura") {
    return (
      <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="novidades-titulo">
        <div className="w-full max-w-sm rounded-[28px] bg-surface p-6 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.45)]">
          <BrandMark size={52} />
          <h2 id="novidades-titulo" className="titulo-tema mt-4 text-2xl font-medium tracking-tight text-ink">
            {ABERTURA_DAS_NOVIDADES.titulo}
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-muted">{ABERTURA_DAS_NOVIDADES.texto}</p>
          <div className="mt-6 flex items-center justify-between gap-3">
            {pular}
            <button
              type="button"
              onClick={() => {
                if (pathname !== RESUMO) router.push(RESUMO);
                setFase(0);
              }}
              className="min-h-12 rounded-full bg-ink px-6 text-[15px] font-medium text-canvas"
            >
              {ABERTURA_DAS_NOVIDADES.ver}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const indice = fase;
  const ultimo = indice === PASSOS_DAS_NOVIDADES.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const largura = Math.min(360, vw - 32);
  const folga = 8;
  let posicao: React.CSSProperties;
  if (rect) {
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - largura / 2, vw - 16 - largura));
    posicao = rect.top > vh / 2 ? { left, width: largura, bottom: vh - rect.top + folga + 14 } : { left, width: largura, top: rect.bottom + folga + 14 };
  } else {
    posicao = { left: (vw - largura) / 2, width: largura, top: Math.max(24, vh / 2 - 120) };
  }

  return (
    <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true" aria-labelledby="novidades-passo">
      {rect ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: rect.top - folga,
            left: rect.left - folga,
            width: rect.width + folga * 2,
            height: rect.height + folga * 2,
            borderRadius: passo?.redondo ? 999 : 22,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62), 0 0 0 3px var(--color-accent)",
            transition: "all 0.25s ease",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}
      <div style={{ position: "fixed", ...posicao }} className="rounded-3xl bg-surface p-5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.45)]">
        <p className="text-caption font-medium text-ink-muted">{contadorDoPasso(indice)}</p>
        <h2 id="novidades-passo" className="titulo-tema mt-1 text-lg font-medium tracking-tight text-ink">
          {passo?.titulo}
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{passo?.texto}</p>
        {passo?.acao && (
          <Link href={passo.acao.href} onClick={() => encerrar("terminou")} className="mt-2 inline-flex min-h-11 items-center text-[15px] font-medium text-accent-strong underline-offset-2 hover:underline">
            {passo.acao.rotulo}
          </Link>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          {pular}
          <button
            type="button"
            onClick={() => (ultimo ? encerrar("terminou") : setFase(indice + 1))}
            className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas"
          >
            {ultimo ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
