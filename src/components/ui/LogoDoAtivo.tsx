import { Landmark } from "lucide-react";
import { logoDoAtivo } from "@/lib/marcas/ativos";

/**
 * O quadradinho de um ativo (Análises, Carteira, qualquer lista de ativos): o ícone oficial do
 * ticker; sem ele, a marca do nome ("CDB Banco Inter"); sem nada, as letras do código na cor da
 * marca ou do tema. Renda fixa sem marca ganha o prédio de traço. Nunca a inicial numa bolinha.
 *
 * Sem "use client": serve em lista de servidor e de cliente.
 */
export function LogoDoAtivo({ ticker, nome, tamanho = 40, rendaFixa = false }: { ticker?: string | null; nome?: string | null; tamanho?: number; rendaFixa?: boolean }) {
  const caixa = { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) };
  const logo = logoDoAtivo(rendaFixa ? null : ticker, nome ?? ticker);

  if (logo.tipo === "icone") {
    return (
      <span className="inline-flex shrink-0 overflow-hidden" style={caixa} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone pequeno e estático em /public */}
        <img src={logo.src} alt="" width={tamanho} height={tamanho} loading="lazy" decoding="async" className="size-full object-cover" />
      </span>
    );
  }
  if (logo.tipo === "marca") {
    const m = logo.marca;
    if (m.cheio) {
      return (
        <span className="inline-flex shrink-0 overflow-hidden" style={caixa} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone pequeno e estático em /public */}
          <img src={m.src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        </span>
      );
    }
    if (m.mono) {
      const mascara = `url(${m.src}) center / 58% no-repeat`;
      return (
        <span className="inline-flex shrink-0" style={{ ...caixa, backgroundColor: m.cor }} aria-hidden>
          <span className="block size-full" style={{ backgroundColor: "#ffffff", WebkitMask: mascara, mask: mascara }} />
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white" style={caixa} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo pequeno e estático em /public */}
        <img src={m.src} alt="" loading="lazy" decoding="async" className="size-[72%] object-contain" />
      </span>
    );
  }
  if (rendaFixa) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center text-accent-strong" style={{ ...caixa, background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }} aria-hidden>
        <Landmark size={Math.round(tamanho * 0.48)} strokeWidth={1.6} />
      </span>
    );
  }
  const cor = logo.cor ?? "var(--color-accent-strong)";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-semibold tracking-[0.02em]"
      style={{ ...caixa, color: cor, background: `color-mix(in srgb, ${cor} 12%, transparent)`, fontSize: Math.max(11, Math.round(tamanho * (logo.texto.length > 3 ? 0.27 : 0.32))) }}
      aria-hidden
    >
      {logo.texto}
    </span>
  );
}
