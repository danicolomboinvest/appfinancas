import { Explica } from "@/components/ui/Explica";

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
  /** A explicação do gráfico: um "?" pequeno ao lado do título, que abre ao tocar (07/10/2026). */
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
        <h2 className="flex items-center gap-1.5 text-[17px] font-semibold tracking-tight text-ink">
          {title}
          {/* A explicação num "?" ao lado do título (07/10/2026). A Dani: "não precisa se justificar
              em tudo"; antes era uma frase embaixo do título na primeira visita. */}
          {hint && !hintSempre && <Explica>{hint}</Explica>}
        </h2>
        {action}
      </div>
      {/* Quando a frase é um dado (e não uma explicação), ela fica sempre. */}
      {hint && hintSempre && <p className="mt-0.5 text-caption text-ink-faint">{hint}</p>}
      {/* `flex-col` com gap, e não um simples bloco: uma seção quase sempre tem mais de uma
          peça (gráfico + chips de veredito + nota de rodapé), e sem gap elas encostavam umas
          nas outras — o chip "1 categoria estourou" nascia colado na última barra. */}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}
