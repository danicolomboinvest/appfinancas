/**
 * Seção de tela sem moldura: título na página, conteúdo logo abaixo, um fio separando uma
 * seção da outra.
 *
 * É a alternativa ao "tudo é um card". Empilhar sete retângulos arredondados iguais é o que
 * mais faz uma tela parecer antiga — cada moldura cobra espaço e não acrescenta informação.
 * Sem elas, o que separa os assuntos é o espaço em branco e a hierarquia do texto, e o que
 * sobra na tela é o conteúdo.
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
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {hint && <p className="mt-0.5 text-caption text-ink-faint">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
