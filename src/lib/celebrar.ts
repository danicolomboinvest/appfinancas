/**
 * A comemoração do momento grande (05/10/2026, "cara de premium"): uma chuva dourada leve, nas
 * cores do tema (o dourado do Padrão, o rosa do Girly), e um toque de sucesso no celular.
 *
 * Rara de propósito: a Dani viu a primeira versão (confete colorido saindo dos cantos) e disse
 * "é para ter raramente, não sempre; ficou esquisito". Hoje só no fim dos 21 dias do Money
 * Reset. Fechar o mês ganha só o toque. Sem chuva para quem pediu menos movimento no aparelho.
 */

/** Toque no celular: sucesso (dois toques curtos), erro (três) ou leve. iPhone só quando o app
 * de iPhone tiver o plugin de vibração; no Android funciona no navegador. */
export function vibrar(tipo: "sucesso" | "erro" | "leve" = "leve") {
  try {
    const cap = (window as unknown as { Capacitor?: { isPluginAvailable?: (n: string) => boolean; Plugins?: Record<string, { notification?: (o: unknown) => Promise<void>; impact?: (o: unknown) => Promise<void> }> } }).Capacitor;
    const haptics = cap?.isPluginAvailable?.("Haptics") ? cap.Plugins?.Haptics : undefined;
    if (haptics) {
      if (tipo === "leve") void haptics.impact?.({ style: "LIGHT" });
      else void haptics.notification?.({ type: tipo === "sucesso" ? "SUCCESS" : "ERROR" });
      return;
    }
    navigator.vibrate?.(tipo === "sucesso" ? [12, 60, 18] : tipo === "erro" ? [20, 50, 20, 50, 20] : 8);
  } catch {
    // Sem vibração neste aparelho: segue sem.
  }
}

export function celebrar() {
  vibrar("sucesso");
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const estilo = getComputedStyle(document.documentElement);
  const cor = (nome: string, padrao: string) => estilo.getPropertyValue(nome).trim() || padrao;
  const cores = [cor("--color-accent", "#e0821b"), cor("--color-accent-2", "#f4a94e"), cor("--color-accent-strong", "#b8630f")];

  // Desenha num canvas solto no body: sobrevive à troca de tela que costuma vir logo depois.
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: `${w}px`, height: `${h}px`, pointerEvents: "none", zIndex: "250" });
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  // Poucas gotas douradas caindo devagar do alto, balançando de leve, e sumindo.
  const gotas = Array.from({ length: 36 }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.4,
    vy: 1.6 + Math.random() * 1.6,
    fase: Math.random() * Math.PI * 2,
    amplitude: 0.6 + Math.random() * 0.8,
    raio: 2 + Math.random() * 2.5,
    cor: cores[Math.floor(Math.random() * cores.length)],
  }));

  const inicio = performance.now();
  const DURACAO = 2600;
  const quadro = (agora: number) => {
    const t = agora - inicio;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t > DURACAO - 700 ? Math.max(0, (DURACAO - t) / 700) : Math.min(1, t / 250);
    for (const g of gotas) {
      g.y += g.vy;
      g.fase += 0.05;
      ctx.beginPath();
      ctx.fillStyle = g.cor;
      ctx.arc(g.x + Math.sin(g.fase) * 8 * g.amplitude, g.y, g.raio, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t < DURACAO) requestAnimationFrame(quadro);
    else canvas.remove();
  };
  requestAnimationFrame(quadro);
}
