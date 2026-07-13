"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Share2, X } from "lucide-react";
import type { WeeklyRecap } from "@/lib/recap/weekly";
import { buildRecapShareImage, buildRecapShareText } from "./share-image";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Paleta dos stories — tema escuro imersivo fixo (independente do tema do app). */
const GOLD = "#f0c989";
const SAGE = "#6fcb9f";
const TERRA = "#e2836a";

function Glow({ tone }: { tone: "gold" | "sage" | "terra" }) {
  const color = tone === "gold" ? "rgba(221,161,94,0.35)" : tone === "sage" ? "rgba(111,203,159,0.28)" : "rgba(226,131,106,0.30)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[45%]"
      style={{ background: `radial-gradient(80% 100% at 50% 0%, ${color} 0%, transparent 70%)` }}
    />
  );
}

function BigNumber({ children, color = GOLD }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="text-[clamp(2.6rem,11vw,4.2rem)] font-bold leading-none tracking-tight" style={{ color }}>
      {children}
    </p>
  );
}

/** Barra horizontal comparativa (estilo "declarado vs. real" do Opal). */
function CompareBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max(8, (value / max) * 100) : 8;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xl font-bold text-white">{formatBRL(value)}</p>
      <div className="h-11 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="flex h-full items-center rounded-full px-4 text-sm font-semibold text-black/80"
          style={{ width: `${width}%`, background: color, minWidth: "fit-content" }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function RecapStories({ recap }: { recap: WeeklyRecap }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const touchStartX = useRef<number | null>(null);

  /** Gera a imagem do resumo e abre o menu nativo de compartilhar (Instagram/WhatsApp/...).
   * Degrada com elegância: sem share de arquivo → share de texto → copiar para a área de transferência. */
  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await buildRecapShareImage(recap);
      const file = new File([blob], "resumo-semanal.png", { type: "image/png" });
      const shareData: ShareData = { files: [file], title: "Meu resumo da semana" };
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.(shareData) && navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.share) {
        await navigator.share({ title: "Meu resumo da semana", text: buildRecapShareText(recap) });
      } else {
        await navigator.clipboard.writeText(buildRecapShareText(recap));
        // Baixa a imagem como alternativa quando não há API de compartilhamento (desktop).
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resumo-semanal.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Usuário cancelou o share (AbortError) ou algo falhou — silencioso, sem quebrar a tela.
    } finally {
      setSharing(false);
    }
  }

  // Portal em document.body: o wrapper do layout (animate-fade-in) cria stacking context e
  // prenderia o z-index — fora dele, o story cobre a tab bar e o resto do chrome do app.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção de montagem p/ createPortal
    setMounted(true);
  }, []);

  const delta = recap.weekDeltaPercent;
  const spentLess = delta !== null && delta < 0;
  const savedPositive = recap.allTimeSaved > 0;

  // --- Slides (cada um = uma tela cheia com UM destaque) ---
  const slides: { key: string; tone: "gold" | "sage" | "terra"; content: React.ReactNode }[] = [
    {
      key: "intro",
      tone: "gold",
      content: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{recap.rangeLabel}</p>
          <h1 className="font-serif text-5xl text-white">Resumo Semanal</h1>
          <p className="text-base text-white/70">O que aconteceu com o seu dinheiro esta semana.</p>
        </div>
      ),
    },
    {
      key: "gasto",
      tone: "gold",
      content: (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-white/80">Esta semana você gastou</p>
          <BigNumber>{formatBRL(recap.weekSpent)}</BigNumber>
          {recap.topCategory && (
            <p className="text-base text-white/70">
              A maior parte foi com{" "}
              <span className="font-semibold" style={{ color: GOLD }}>
                {recap.topCategory.label}
              </span>{" "}
              ({formatBRL(recap.topCategory.value)})
            </p>
          )}
        </div>
      ),
    },
    {
      key: "comparacao",
      tone: delta === null ? "gold" : spentLess ? "sage" : "terra",
      content: (
        <div className="flex w-full flex-col gap-8">
          <div className="text-center">
            <p className="text-lg text-white/80">Comparado com a semana anterior, você gastou</p>
            <BigNumber color={delta === null ? GOLD : spentLess ? SAGE : TERRA}>
              {delta === null ? "—" : `${Math.abs(Math.round(delta * 100))}% ${spentLess ? "menos" : "a mais"}`}
            </BigNumber>
          </div>
          <div className="flex flex-col gap-5">
            <CompareBar
              label="Esta semana"
              value={recap.weekSpent}
              max={Math.max(recap.weekSpent, recap.prevWeekSpent)}
              color={delta !== null && !spentLess ? TERRA : SAGE}
            />
            <CompareBar
              label="Semana passada"
              value={recap.prevWeekSpent}
              max={Math.max(recap.weekSpent, recap.prevWeekSpent)}
              color="rgba(255,255,255,0.25)"
            />
          </div>
        </div>
      ),
    },
    {
      key: "dias",
      tone: "gold",
      content: (
        <div className="flex w-full flex-col gap-8">
          {recap.bestDay && (
            <p className="text-center text-xl text-white/90">
              Seu dia mais econômico foi{" "}
              <span className="font-bold" style={{ color: SAGE }}>
                {recap.bestDay.label}
              </span>
            </p>
          )}
          <div className="flex items-end justify-between gap-2">
            {recap.byWeekday.map((d) => {
              const max = Math.max(...recap.byWeekday.map((x) => x.value), 1);
              // Altura em px (não %): dentro de flex sem altura fixa, % colapsa pra zero.
              const h = Math.max(6, (d.value / max) * 150);
              const isWorst = recap.worstDay && d.label === recap.worstDay.label && d.value === recap.worstDay.value;
              return (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full max-w-9 rounded-full"
                    style={{
                      height: `${h}px`,
                      background: isWorst
                        ? `linear-gradient(180deg, #fff 0%, ${TERRA} 60%, rgba(226,131,106,0.25) 100%)`
                        : "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 100%)",
                    }}
                  />
                  <span className="text-xs text-white/50">{d.label}</span>
                </div>
              );
            })}
          </div>
          {recap.worstDay && (
            <p className="text-center text-xl text-white/90">
              O mais gastador foi{" "}
              <span className="font-bold" style={{ color: TERRA }}>
                {recap.worstDay.label}
              </span>{" "}
              com {formatBRL(recap.worstDay.value)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "acumulado",
      tone: savedPositive ? "sage" : "terra",
      content: (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-white/80">
            Desde que você chegou aqui ({recap.monthsActive} {recap.monthsActive === 1 ? "mês" : "meses"}),
            {savedPositive ? " ficou no seu bolso" : " o saldo ficou"}
          </p>
          <BigNumber color={savedPositive ? SAGE : TERRA}>{formatBRL(recap.allTimeSaved)}</BigNumber>
          <p className="text-base text-white/70">
            {savedPositive
              ? "É renda que não virou gasto — e pode virar patrimônio."
              : "Semana a semana dá pra virar esse jogo. O primeiro passo é ver o número."}
          </p>
        </div>
      ),
    },
    {
      key: "projecao",
      tone: "gold",
      content: (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-white/80">Se você mantiver esse ritmo e investir, em 10 anos isso vira até…</p>
          <BigNumber>{formatBRL(Math.max(0, recap.projection10y))}</BigNumber>
          <p className="text-sm text-white/50">
            *Poupança média de {formatBRL(Math.max(0, recap.avgMonthlySaving))}/mês a 10% a.a. — estimativa educativa, não garantia.
          </p>
        </div>
      ),
    },
    {
      key: "final",
      tone: "gold",
      content: (
        <div className="flex w-full flex-col gap-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{recap.rangeLabel}</p>
            <h2 className="mt-1 font-serif text-4xl text-white">Destaques</h2>
          </div>
          <div className="flex flex-col divide-y divide-white/10">
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-3xl font-bold text-white">{formatBRL(recap.weekSpent)}</p>
                <p className="text-sm text-white/60">Gastos da semana</p>
              </div>
              {delta !== null && (
                <span
                  className="rounded-full px-3 py-1.5 text-sm font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: spentLess ? SAGE : TERRA }}
                >
                  {spentLess ? "▼" : "▲"} {Math.abs(Math.round(delta * 100))}%
                </span>
              )}
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-3xl font-bold text-white">{formatBRL(recap.allTimeSaved)}</p>
                <p className="text-sm text-white/60">No bolso desde o início</p>
              </div>
              <span
                className="rounded-full px-3 py-1.5 text-sm font-bold"
                style={{ background: "rgba(255,255,255,0.08)", color: savedPositive ? SAGE : TERRA }}
              >
                {savedPositive ? "OK" : "!"}
              </span>
            </div>
            <div className="py-4">
              <p className="text-3xl font-bold" style={{ color: GOLD }}>
                {formatBRL(Math.max(0, recap.projection10y))}
              </p>
              <p className="text-sm text-white/60">Potencial em 10 anos</p>
            </div>
          </div>
          <div className="mt-2 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition-transform hover:opacity-90 active:scale-95 disabled:opacity-60"
            >
              <Share2 size={18} strokeWidth={2.2} />
              {sharing ? "Gerando imagem…" : "Compartilhar resumo"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/mensal")}
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Concluir
            </button>
          </div>
        </div>
      ),
    },
  ];

  const total = slides.length;
  const isLast = index === total - 1;

  function next() {
    if (isLast) return;
    setIndex((i) => Math.min(total - 1, i + 1));
  }
  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  // Teclado: ← → navegam, Esc sai.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") router.push("/mensal");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, router]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] overflow-hidden bg-[#0a0a0a] text-white"
      // Swipe: arrasta pro lado pra trocar de tela (mesma linguagem de stories).
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx < -48) next();
        else if (dx > 48) prev();
      }}
    >
      {/* Barrinhas de progresso (uma por slide) */}
      <div className="absolute inset-x-4 top-4 z-20 flex gap-1.5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {slides.map((s, i) => (
          <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: i <= index ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Fechar */}
      <button
        type="button"
        onClick={() => router.push("/mensal")}
        aria-label="Fechar resumo"
        className="absolute left-4 top-10 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-xl transition-colors hover:bg-white/15"
      >
        <X size={20} />
      </button>

      {/* Áreas de toque: esquerda volta, direita avança */}
      <button type="button" aria-label="Anterior" onClick={prev} className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default" />
      <button type="button" aria-label="Próximo" onClick={next} className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-default" />

      {/* Trilho de slides — a página inteira desliza (efeito "vidro") */}
      <div
        className="flex h-full transition-transform duration-500"
        style={{ transform: `translateX(-${index * 100}%)`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {slides.map((slide, i) => (
          <div key={slide.key} className="relative flex h-full w-full shrink-0 flex-col items-center justify-center px-7">
            <Glow tone={slide.tone} />
            <div
              className={`relative w-full max-w-md transition-all duration-500 ${
                i === index ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              {slide.content}
            </div>
          </div>
        ))}
      </div>

      {/* Seta de vidro (como a referência) — some no último slide */}
      {!isLast && (
        <button
          type="button"
          onClick={next}
          aria-label="Avançar"
          className="absolute bottom-10 right-6 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:bg-white/15 active:scale-90"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <ChevronRight size={26} strokeWidth={2.2} />
        </button>
      )}
    </div>,
    document.body,
  );
}
