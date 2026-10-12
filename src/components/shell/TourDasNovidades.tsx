"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Film, Repeat, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useToast } from "@/components/ui/toast-context";
import {
  CHAVE_LOCAL_NOVIDADES,
  LINK_COMO_FUNCIONA,
  ONDE_DOS_PASSOS,
  TOTAL_DE_PASSOS,
  abreAsNovidades,
  contadorDoPasso,
  textosDasNovidades,
  type EstadoDasNovidades,
} from "@/lib/novidades/passos";
import { marcarNovidadesVistasAction } from "./novidades-actions";
import { TOUR_DONE_EVENT } from "./InstallAppBanner";
import { trackEvent } from "@/lib/usage/track-event";

const RESUMO = "/mensal/foco";
const FOLGA = 6;

type Fase = "fechado" | "abertura" | "fim" | number;
type Caixa = { top: number; left: number; right: number; bottom: number };

function lerLocal(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_LOCAL_NOVIDADES) === "1";
  } catch {
    return false;
  }
}

function visivel(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  if (r.right <= 0 || r.left >= window.innerWidth) return false;
  const estilo = getComputedStyle(el);
  return estilo.visibility !== "hidden" && Number(estilo.opacity) > 0.2;
}

/** Os elementos de verdade que o passo ilumina, entre os que existem na tela agora. */
function alvosNaTela(nomes: string[]): HTMLElement[] {
  const achados: HTMLElement[] = [];
  for (const nome of nomes) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${nome}"]`)).find(visivel);
    if (el) achados.push(el);
  }
  return achados;
}

function caixaDe(els: HTMLElement[]): Caixa | null {
  if (!els.length) return null;
  const rs = els.map((e) => e.getBoundingClientRect());
  return {
    top: Math.min(...rs.map((r) => r.top)) - FOLGA,
    left: Math.min(...rs.map((r) => r.left)) - FOLGA,
    right: Math.max(...rs.map((r) => r.right)) + FOLGA,
    bottom: Math.max(...rs.map((r) => r.bottom)) + FOLGA,
  };
}

/**
 * "Tivemos uma mudança" (versão nova, rodada 72). Só para quem já usava o app, uma vez por conta:
 * a abertura com "Ver o que mudou" e "Pular", cinco passos que iluminam o elemento de verdade de
 * cada tela (com "1 de 5", "Próximo" e "Pular" sempre à vista) e o fim "Pronto. Tudo no lugar."
 * com o atalho para os vídeos do Como funciona. Quem é novo não vê (estado "novo").
 *
 * A marca de visto é da conta (servidor) e também do aparelho, para não piscar enquanto o servidor
 * responde. Configurações › Ajuda › "Ver de novo o que mudou" reabre por /mensal/foco?novidades=1.
 */
export function TourDasNovidades({ estado, onMenu }: { estado: EstadoDasNovidades; onMenu: (aberto: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { key: tema } = useProfileTheme();
  const { showToast } = useToast();
  const tx = textosDasNovidades(tema, estado === "boas-vindas" ? "novo" : "ja-usava");
  const [fase, setFase] = useState<Fase>("fechado");
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [tela, setTela] = useState({ w: 390, h: 800 });
  const balao = useRef<HTMLDivElement>(null);
  const [, setAlturaDoBalao] = useState(200);

  useEffect(() => {
    const pedido = new URLSearchParams(window.location.search).get("novidades") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o endereço e o aparelho, que só existem no cliente
    if (abreAsNovidades(estado, pedido, lerLocal())) setFase((f) => (f === "fechado" ? "abertura" : f));
  }, [estado, pathname]);

  const indice = typeof fase === "number" ? fase : -1;
  const onde = indice >= 0 ? ONDE_DOS_PASSOS[indice] : null;

  // Cada passo vai até a tela dele (e abre o menu, no passo de Metas e Carteira).
  useEffect(() => {
    if (fase === "fechado") return;
    onMenu(Boolean(onde?.abreMenu));
    const destino = onde ? onde.rota : fase === "fim" ? RESUMO : null;
    if (destino && pathname !== destino) router.push(destino);
  }, [fase, onde, pathname, router, onMenu]);

  const medir = useCallback(() => {
    setTela({ w: window.innerWidth, h: window.innerHeight });
    if (!onde) return setCaixa(null);
    const els = alvosNaTela(onde.alvos);
    const c = caixaDe(els);
    const vh = window.innerHeight;
    // Alvo alto (a grade de perguntas do Decidir): o balão fica em cima e o destaque começa logo
    // abaixo dele, cortado no fim da tela, para os dois caberem sem se cobrir.
    if (c && c.bottom - c.top > vh * 0.5) {
      const topoDesejado = 12 + (balao.current?.offsetHeight ?? 200) + 20;
      if (Math.abs(c.top - topoDesejado) > 4) window.scrollBy({ top: c.top - topoDesejado });
      const d = caixaDe(els);
      setCaixa(d && { ...d, bottom: Math.min(d.bottom, vh - 12) });
      return;
    }
    // Alvo fora da tela (as esferas no meio do Decidir, os temas em Configurações): rola até ele.
    if (c && els[0] && (c.top < 64 || c.bottom > window.innerHeight - 240)) {
      els[0].scrollIntoView({ block: "center" });
      setCaixa(caixaDe(els));
      return;
    }
    setCaixa(c);
  }, [onde]);

  useEffect(() => {
    if (!onde) return;
    // O alvo pode entrar depois (troca de tela, o menu que desliza): mede agora e de novo até ~2 s.
    const ids = [0, 120, 300, 600, 1000, 1600, 2400].map((ms) => window.setTimeout(medir, ms));
    const aoMudar = () => medir();
    window.addEventListener("resize", aoMudar);
    window.addEventListener("scroll", aoMudar, { passive: true, capture: true });
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", aoMudar);
      window.removeEventListener("scroll", aoMudar, { capture: true });
    };
  }, [onde, medir, pathname]);

  useEffect(() => {
    if (balao.current) setAlturaDoBalao(balao.current.offsetHeight);
  }, [fase, caixa, tela]);

  const encerrar = useCallback(
    (como: "terminou" | "pulou", depois?: string) => {
      try {
        window.localStorage.setItem(CHAVE_LOCAL_NOVIDADES, "1");
        // O tour de boas-vindas antigo não aparece para quem já usava: este fala com ela.
        window.localStorage.setItem("welcome-tour-seen", "1");
      } catch {
        // Sem armazenamento: a marca da conta (servidor) segura.
      }
      trackEvent(como === "pulou" ? "novidades_pulou" : "novidades_terminou", typeof fase === "number" ? `/novidades/${fase + 1}` : `/novidades/${fase}`);
      void marcarNovidadesVistasAction(como);
      setFase("fechado");
      setCaixa(null);
      onMenu(false);
      window.dispatchEvent(new Event(TOUR_DONE_EVENT));
      if (como === "pulou" && tx.aoPular) showToast(tx.aoPular);
      const alvo = depois ?? (typeof fase === "number" && pathname !== RESUMO ? RESUMO : null);
      if (alvo) router.push(alvo);
      else if (new URLSearchParams(window.location.search).get("novidades") === "1") router.replace(pathname);
    },
    [fase, pathname, router, onMenu, showToast, tx.aoPular],
  );

  useEffect(() => {
    if (fase === "fechado") return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") encerrar("pulou");
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fase, encerrar]);

  if (fase === "fechado") return null;

  // "Pular" numa pílula com borda (protótipo), ao lado do botão preto.
  const pular = (
    <button type="button" onClick={() => encerrar("pulou")} className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface-2 px-5 text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
      {tx.abertura.pular}
    </button>
  );

  if (fase === "abertura" || fase === "fim") {
    const abertura = fase === "abertura";
    const icone = !abertura ? (
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-success" aria-hidden>
        <Check size={24} strokeWidth={2} />
      </span>
    ) : tema === "girly" ? (
      <BrandMark size={64} />
    ) : (
      <span className="flex size-16 items-center justify-center rounded-full text-on-accent [background:radial-gradient(circle_at_35%_30%,#fff8,transparent_45%),var(--color-accent)] shadow-[0_8px_28px_-6px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]" aria-hidden>
        {tema === "padrao" || estado === "boas-vindas" ? <Sparkles size={22} strokeWidth={1.8} /> : <Repeat size={20} strokeWidth={1.8} />}
      </span>
    );
    return (
      // Protótipo: o cartão preso embaixo, por cima da tela escurecida.
      <div className="fixed inset-0 z-[150] flex items-end justify-center bg-[rgba(12,8,14,0.55)] px-3 pb-[calc(0.75rem+var(--safe-bottom))]" role="dialog" aria-modal="true" aria-labelledby="novidades-titulo" data-tour-cartao="embaixo">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[28px] bg-surface px-5 pb-4 pt-6 text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--color-border)]">
          {icone}
          <h2 id="novidades-titulo" className="titulo-tema mt-1 text-[26px] font-medium leading-tight tracking-tight text-ink">
            {abertura ? tx.abertura.titulo : tx.fim.titulo}
          </h2>
          {(abertura ? tx.abertura.texto : tx.fim.texto) && <p className="text-[15px] leading-relaxed text-ink-muted">{abertura ? tx.abertura.texto : tx.fim.texto}</p>}
          <Button autoFocus className="mt-2 min-h-12 w-full text-[15px]" onClick={() => (abertura ? setFase(0) : encerrar("terminou"))}>
            {abertura ? tx.abertura.ver : tx.fim.comecar}
          </Button>
          {abertura ? (
            pular
          ) : (
            <button type="button" onClick={() => encerrar("terminou", LINK_COMO_FUNCIONA)} className="inline-flex min-h-11 items-center gap-2 px-2 text-[15px] font-medium text-accent-strong hover:underline">
              {tema === "manifestacao" || tema === "titanio" ? <Film size={16} aria-hidden /> : null}
              {tx.fim.comoFunciona}
            </button>
          )}
        </div>
      </div>
    );
  }

  const passo = tx.passos[indice];
  const ultimo = indice === TOTAL_DE_PASSOS - 1;
  const largura = Math.min(400, tela.w - 32);
  // O cartão dos passos fica sempre embaixo (protótipo); o destaque é que muda de lugar.
  const posicao: React.CSSProperties = { left: (tela.w - largura) / 2, width: largura, bottom: "calc(0.75rem + var(--safe-bottom))" };

  return (
    <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true" aria-labelledby="novidades-passo">
      {caixa ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[18px] motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: caixa.top,
            left: caixa.left,
            width: caixa.right - caixa.left,
            height: caixa.bottom - caixa.top,
            boxShadow: "0 0 0 9999px rgba(12,8,14,0.66), 0 0 0 2px var(--color-accent)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(12,8,14,0.66)]" />
      )}
      <div ref={balao} style={{ position: "fixed", ...posicao }} className="rounded-[24px] bg-surface px-5 pb-3 pt-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--color-border)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] font-semibold text-ink-muted">{contadorDoPasso(indice)}</span>
          {tx.pontinhos && (
            <span className="flex items-center gap-1" aria-hidden>
              {ONDE_DOS_PASSOS.map((_, i) => (
                <i key={i} className={`h-1.5 rounded-full transition-all ${i <= indice ? "w-4 bg-accent" : "w-1.5 bg-border-strong"}`} />
              ))}
            </span>
          )}
        </div>
        <h2 id="novidades-passo" className="titulo-tema mt-1.5 text-[17px] font-semibold tracking-tight text-ink">
          {passo.titulo}
        </h2>
        <p className="mt-1 text-[14.5px] leading-relaxed text-ink-muted">{passo.texto}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {pular}
          <Button autoFocus className="min-h-11 px-6 text-[15px]" onClick={() => setFase(ultimo ? "fim" : indice + 1)}>
            {ultimo ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
