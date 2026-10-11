import { Landmark } from "lucide-react";
import { marcaDaDescricao } from "@/lib/marcas/marca";

/**
 * O avatar de um ativo (rodadas 16 e 43): o logo real quando o nome traz a marca (Caixinha Nubank,
 * CDB Banco Inter); Tesouro com o ícone do prédio; o resto com a sigla num quadrado na cor do grupo
 * (nunca cinza, nunca inicial solta). Tamanho 28 na lista e 44 no detalhe.
 */
const TICKER_DA_MARCA: Record<string, string> = { BBAS3: "banco do brasil", ITUB4: "itau", ITUB3: "itau", BBDC4: "bradesco", BBDC3: "bradesco", SANB11: "santander", BPAC11: "btg pactual", NU: "nubank", INTR: "banco inter" };

export function AvatarDoAtivo({ nome, ticker, tesouro, cor, size = 28 }: { nome: string; ticker: string | null; tesouro: boolean; cor: string; size?: 28 | 44 }) {
  const raio = size === 28 ? 8 : 12;
  const marca = marcaDaDescricao(ticker && TICKER_DA_MARCA[ticker.toUpperCase()] ? TICKER_DA_MARCA[ticker.toUpperCase()] : nome);
  if (tesouro) {
    return (
      <span className="flex shrink-0 items-center justify-center bg-surface-2 text-ink-muted" style={{ width: size, height: size, borderRadius: raio }} aria-hidden>
        <Landmark size={size === 28 ? 15 : 20} strokeWidth={1.7} />
      </span>
    );
  }
  if (marca) {
    if (marca.mono) {
      const mascara = `url(${marca.src}) center / 60% no-repeat`;
      return (
        <span className="flex shrink-0" style={{ width: size, height: size, borderRadius: raio, backgroundColor: marca.cor }} role="img" aria-label={marca.nome}>
          <span className="block size-full" style={{ backgroundColor: "#ffffff", WebkitMask: mascara, mask: mascara }} />
        </span>
      );
    }
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white" style={{ width: size, height: size, borderRadius: raio }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo pequeno e estático em /public */}
        <img src={marca.src} alt={marca.nome} loading="lazy" decoding="async" className="size-[72%] object-contain" />
      </span>
    );
  }
  const sigla = (ticker ?? nome).replace(/[^A-Za-z0-9]/g, "").slice(0, ticker ? 6 : 2).toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        borderRadius: raio,
        fontSize: sigla.length > 4 ? (size === 28 ? 7.5 : 11) : size === 28 ? 9 : 13,
        backgroundColor: `color-mix(in srgb, ${cor} 22%, var(--color-surface))`,
        color: `color-mix(in srgb, ${cor} 80%, var(--color-ink))`,
      }}
      aria-hidden
    >
      {sigla}
    </span>
  );
}
