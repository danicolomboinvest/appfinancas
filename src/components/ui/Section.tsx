import { DicaDaPrimeiraVez } from "@/components/ui/DicaDaPrimeiraVez";

/**
 * Seção de tela. No celular, sem moldura: título na página, conteúdo logo abaixo, um fio
 * separando uma seção da outra — empilhar sete retângulos iguais numa tela estreita cobra
 * espaço e não acrescenta informação.
 *
 * No computador é o contrário: com 1.100px de largura, seções soltas uma embaixo da outra
 * viram faixas compridas e vazias. Lá a seção vira um cartão, e as páginas põem os cartões
 * lado a lado numa grade. Foi pedido da Dani: "em quadrados mesmo, sem tanto espaço".
 */
export function Section({
  title,
  hint,
  hintSempre = false,
  action,
  children,
}: {
  title: string;
  /** A frase-guia do gráfico. Aparece só na primeira vez que a pessoa vê a seção (06/10/2026). */
  hint?: string;
  /** Quando a frase é um dado (e não uma explicação), ela fica sempre. */
  hintSempre?: boolean;
  /** Link opcional no canto direito do título (ex.: "ver tudo →"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0 lg:min-w-0 lg:rounded-2xl lg:border lg:bg-surface lg:p-5 lg:pt-5 lg:first:border-t lg:first:pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {/* Frase de explicação ensina uma vez e some (a Dani: "às vezes você tenta explicar tudo em
          muito texto"). Dado fica sempre. */}
      {hint &&
        (hintSempre ? (
          <p className="mt-0.5 text-caption text-ink-faint">{hint}</p>
        ) : (
          <DicaDaPrimeiraVez chave={`secao:${title}`} className="mt-0.5 text-caption text-ink-faint">
            {hint}
          </DicaDaPrimeiraVez>
        ))}
      {/* `flex-col` com gap, e não um simples bloco: uma seção quase sempre tem mais de uma
          peça (gráfico + chips de veredito + nota de rodapé), e sem gap elas encostavam umas
          nas outras — o chip "1 categoria estourou" nascia colado na última barra. */}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}
