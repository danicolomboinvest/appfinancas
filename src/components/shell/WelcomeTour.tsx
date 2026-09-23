"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";
import { TOUR_DONE_EVENT } from "./InstallAppBanner";

const SEEN_KEY = "welcome-tour-seen";

/** Só as chaves da voz cujo valor é uma frase pronta (não função, não lista). */
type ChaveDeFrase = { [K in keyof Titulos]: Titulos[K] extends string ? K : never }[keyof Titulos];

type Step = {
  /** Valor do data-tour do elemento a destacar. Sem target = cartão centralizado (abertura/fim). */
  target?: string;
  /** Alvo redondo (o botão "+") ganha recorte circular. */
  round?: boolean;
  /** As chaves do título e do texto na voz do tema: o que o passo DIZ muda de tema pra tema. */
  title: ChaveDeFrase;
  text: ChaveDeFrase;
};

/** Os passos, na ordem: o que cada um aponta é igual nos sete temas; o que diz vem da voz. */
const STEPS: Step[] = [
  { title: "uiTourBoasVindasTitulo", text: "uiTourBoasVindasTexto" },
  { target: "registrar", round: true, title: "uiTourRegistrarTitulo", text: "uiTourRegistrarTexto" },
  { target: "fluxo", title: "uiTourFluxoTitulo", text: "uiTourFluxoTexto" },
  { target: "metas", title: "uiTourMetasTitulo", text: "uiTourMetasTexto" },
  { target: "carteira", title: "uiTourCarteiraTitulo", text: "uiTourCarteiraTexto" },
  { target: "mais", title: "uiTourMaisTitulo", text: "uiTourMaisTexto" },
  { title: "uiTourFimTitulo", text: "uiTourFimTexto" },
];

/** Acha, entre os elementos com aquele data-tour (a tab bar do mobile E a sidebar do desktop
 * têm o mesmo marcador), o que está DE FATO visível na tela agora. */
function findVisibleTarget(name: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const onScreen =
      r.width > 4 && r.height > 4 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    if (onScreen) return el;
  }
  return null;
}

/**
 * Tour de boas-vindas GUIADO na primeira entrada (uma vez por aparelho): destaca cada botão de
 * navegação de verdade com um foco iluminado e uma explicação ao lado, passo a passo, não é só
 * texto numa tela. Funciona no mobile (tab bar de baixo) e no desktop (sidebar), achando qual
 * está visível. Complementa o checklist de "primeiros passos" (que guia O QUE FAZER primeiro).
 */
export function WelcomeTour() {
  const { voz } = useProfileTheme();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage
    if (window.localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
  }, []);

  const measure = useCallback(() => {
    const s = STEPS[step];
    const el = s.target ? findVisibleTarget(s.target) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    if (!open) return;
    // rAF: espera o layout assentar antes da 1ª medição (a barra é fixed/pode entrar depois).
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    window.localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
    // Libera o convite pra instalar o app, que espera o tour acabar pra não competirem.
    window.dispatchEvent(new Event(TOUR_DONE_EVENT));
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  const pad = 8;

  // Posição do cartão de explicação: perto do alvo (acima se o alvo está na metade de baixo,
  // como a tab bar), ou centralizado quando não há alvo.
  let calloutStyle: React.CSSProperties;
  if (rect) {
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(16, Math.min(centerX - cardW / 2, vw - 16 - cardW));
    const above = rect.top > vh / 2;
    calloutStyle = above
      ? { position: "fixed", left, width: cardW, bottom: vh - rect.top + pad + 16 }
      : { position: "fixed", left, width: cardW, top: rect.bottom + pad + 16 };
  } else {
    calloutStyle = { position: "fixed", left: (vw - cardW) / 2, width: cardW, top: Math.max(24, vh / 2 - 130) };
  }

  return (
    <div className="fixed inset-0 z-[150]">
      {/* Foco iluminado no alvo (recorte + aro dourado) ou escurecimento cheio quando sem alvo. */}
      {rect ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: s.round ? 999 : 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 3px var(--color-accent)",
            pointerEvents: "none",
            transition: "all 0.25s ease",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/74" aria-hidden />
      )}

      {/* Cartão de explicação */}
      <div style={calloutStyle} className="glass rounded-2xl p-5">
        <h2 className="text-base font-semibold tracking-tight text-ink">{voz.titulos[s.title]}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{voz.titulos[s.text]}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((st, i) => (
              <span
                key={st.title}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-4 bg-accent" : "w-1.5 bg-white/20"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!isLast && (
              <button type="button" onClick={finish} className="text-xs font-medium text-ink-faint hover:text-ink">
                {voz.titulos.uiTourPular}
              </button>
            )}
            <Button type="button" size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))}>
              {isLast ? voz.titulos.uiTourComecar : voz.titulos.uiTourAvancar}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
