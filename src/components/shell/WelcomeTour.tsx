"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

const SEEN_KEY = "welcome-tour-seen";

type Step = {
  /** Valor do data-tour do elemento a destacar. Sem target = cartão centralizado (abertura/fim). */
  target?: string;
  /** Alvo redondo (o botão "+") ganha recorte circular. */
  round?: boolean;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    title: "Boas-vindas ao SPI Finance 👋",
    text: "Um tour rápido mostrando ONDE fica cada coisa — vou destacar os botões um por um. Dá pra pular quando quiser.",
  },
  {
    target: "registrar",
    round: true,
    title: "Este + é o coração do app",
    text: "É por aqui que você registra tudo: digite um gasto, fale por áudio, ou importe o extrato do banco. Comece sempre por ele.",
  },
  {
    target: "fluxo",
    title: "Aqui é o Fluxo",
    text: "Seu mês em um lugar: renda, gastos e o orçamento por categoria — com um alerta quando você gasta rápido demais.",
  },
  {
    target: "metas",
    title: "Aqui são as Metas",
    text: "Crie metas (viagem, casa), a reserva de emergência e a aposentadoria. O app calcula quanto guardar por mês pra você chegar lá.",
  },
  {
    target: "carteira",
    title: "Aqui é a Carteira",
    text: "Seus investimentos e o lucro de cada um. Dá até pra puxar o preço médio direto da sua declaração de Imposto de Renda.",
  },
  {
    target: "mais",
    title: "E tem mais aqui",
    text: "Visão Geral, Simuladores e Análises ficam neste menu.",
  },
  {
    title: "Tudo pronto! 🎉",
    text: "Bora começar? Toque no + e registre seu primeiro lançamento — em segundos você já vê seu mês tomando forma.",
  },
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
 * navegação de verdade com um foco iluminado e uma explicação ao lado, passo a passo — não é só
 * texto numa tela. Funciona no mobile (tab bar de baixo) e no desktop (sidebar), achando qual
 * está visível. Complementa o checklist de "primeiros passos" (que guia O QUE FAZER primeiro).
 */
export function WelcomeTour() {
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
        <h2 className="text-base font-semibold tracking-tight text-ink">{s.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.text}</p>

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
                Pular
              </button>
            )}
            <Button type="button" size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))}>
              {isLast ? "Começar" : "Avançar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
