import type { ReactNode } from "react";
import { Landmark } from "lucide-react";
import type { Forca } from "@/lib/analysis/quatro-perguntas";
import type { Logo } from "@/lib/analysis/analises-dados";

/**
 * Os anéis das Análises (rodadas 48, 52 e 56). Sem cinza (regra da Dani): tudo na cor do tema.
 * "Vai bem" no verde do tema, "na média" num tom do destaque do tema (rosé no Girly, champanhe no
 * Titânio, dourado no Padrão), "atenção" no tom de alerta do tema, e o que não tem dado como trilho
 * suave do próprio destaque. Nada de vermelho gritante.
 */
export const TRILHO = "color-mix(in srgb, var(--color-accent) 16%, transparent)";

export function corDaForca(f: Forca | null): string {
  return f === "forte" ? "var(--color-success)" : f === "atencao" ? "var(--color-atencao)" : f === "ok" ? "var(--color-accent)" : TRILHO;
}
export function opacidadeDaForca(f: Forca | null): number {
  return f === "forte" ? 1 : f === "atencao" ? 0.9 : f === "ok" ? 0.5 : 1;
}

/** O pontinho da legenda e das respostas, na cor do estado. */
export function Ponto({ f, tamanho = 8 }: { f: Forca | null; tamanho?: number }) {
  return <i aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: tamanho, height: tamanho, background: corDaForca(f), opacity: opacidadeDaForca(f) }} />;
}

/**
 * Anel de pedaços iguais (um por pergunta), com vão visível entre eles: 5,5 graus mais a
 * compensação das pontas arredondadas. `selecionada` engrossa o pedaço daquela pergunta.
 */
export function AnelDePerguntas({
  forcas,
  tamanho,
  espessura,
  chaves,
  selecionada,
  onToque,
  meio,
  rotulo,
}: {
  forcas: (Forca | null)[];
  tamanho: number;
  espessura: number;
  chaves?: string[];
  selecionada?: string | null;
  onToque?: (chave: string) => void;
  meio?: ReactNode;
  rotulo?: string;
}) {
  const r = tamanho / 2 - espessura / 2 - 2;
  const c = 2 * Math.PI * r;
  const n = forcas.length;
  const vao = n > 1 ? (c * 5.5) / 360 + espessura : 0;
  const seg = Math.max(0.5, c / n - vao);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} width={tamanho} height={tamanho} className="absolute inset-0" role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
        {forcas.map((f, i) => {
          const k = chaves?.[i];
          const on = k !== undefined && selecionada === k;
          return (
            <circle
              key={i}
              className="an-seg"
              cx={tamanho / 2}
              cy={tamanho / 2}
              r={r}
              fill="none"
              stroke={corDaForca(f)}
              strokeOpacity={opacidadeDaForca(f)}
              strokeWidth={on ? espessura + 3 : espessura}
              strokeLinecap="round"
              strokeDasharray={`${seg.toFixed(2)} ${(c - seg).toFixed(2)}`}
              strokeDashoffset={(-(i * c) / n + c / 4 - vao / 2).toFixed(2)}
              style={{ ["--d" as string]: `${i * 70}ms`, ["--s" as string]: seg.toFixed(2), cursor: onToque && k ? "pointer" : undefined, pointerEvents: onToque && k ? "stroke" : "none" }}
              onClick={onToque && k ? () => onToque(k) : undefined}
            />
          );
        })}
      </svg>
      {meio && <span className="relative flex flex-col items-center justify-center text-center">{meio}</span>}
    </span>
  );
}

/**
 * Marcas cujo arquivo de logo é o nome escrito por extenso (ilegível num quadrado de 40 px): viram
 * a sigla na cor oficial, como o símbolo que a marca usa no app dela.
 */
const MONOGRAMA: Record<string, { texto: string; fundo: string; tinta: string }> = {
  bancodobrasil: { texto: "BB", fundo: "#FCF800", tinta: "#465EFF" },
};

/** O quadradinho do ativo dentro do anel: o logo real da marca; sem logo, o código em letra de tinta. */
export function TileDoAtivo({ ticker, logo, tamanho = 40 }: { ticker: string; logo: Logo; tamanho?: number }) {
  const mono = logo ? MONOGRAMA[logo.slug] : undefined;
  if (mono) {
    return (
      <span
        className="inline-flex items-center justify-center font-bold tracking-[-0.02em]"
        style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28), background: mono.fundo, color: mono.tinta, fontSize: Math.round(tamanho * 0.4) }}
        aria-hidden
      >
        {mono.texto}
      </span>
    );
  }
  if (logo) {
    const caixa = { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) };
    if (logo.mono) {
      const mascara = `url(${logo.src}) center / 58% no-repeat`;
      return (
        <span className="inline-flex" style={{ ...caixa, backgroundColor: logo.cor }} aria-hidden>
          <span className="block size-full" style={{ backgroundColor: "#ffffff", WebkitMask: mascara, mask: mascara }} />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center overflow-hidden border border-border bg-white" style={caixa} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo pequeno e estático em /public */}
        <img src={logo.src} alt="" loading="lazy" decoding="async" className="size-[72%] object-contain" />
      </span>
    );
  }
  // Renda fixa vem pelo nome ("Tesouro IPCA+ 2035"): o prédio de traço no quadrado cinza.
  if (/\s/.test(ticker)) {
    return (
      <span className="inline-flex items-center justify-center text-accent-strong" style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28), background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }} aria-hidden>
        <Landmark size={Math.round(tamanho * 0.48)} strokeWidth={1.6} />
      </span>
    );
  }
  return <span className="text-[13px] font-semibold tracking-[0.04em] text-accent-strong">{ticker.replace(/\d+$/, "")}</span>;
}

/** "13%" com o número e o % na mesma linha, o % menor (rodadas 48 e 52). */
export function Pct({ valor, className = "" }: { valor: number; className?: string }) {
  const n = Math.round(valor);
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {n < 1 && valor > 0 ? "<1" : n}
      <small className="ml-[0.06em] text-[0.78em]">%</small>
    </span>
  );
}
