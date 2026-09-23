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
  action,
  children,
}: {
  title: string;
  hint?: string;
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
      {hint && <p className="mt-0.5 text-caption text-ink-faint">{hint}</p>}
      {/* `flex-col` com gap, e não um simples bloco: uma seção quase sempre tem mais de uma
          peça (gráfico + chips de veredito + nota de rodapé), e sem gap elas encostavam umas
          nas outras — o chip "1 categoria estourou" nascia colado na última barra. */}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}
