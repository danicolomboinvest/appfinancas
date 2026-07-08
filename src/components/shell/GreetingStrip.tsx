export function GreetingStrip({
  greeting,
  dateLabel,
  summary,
}: {
  /** Ex.: "Bom dia, Daniela." — já pronto, computado no servidor. */
  greeting: string;
  /** Ex.: "Terça-feira, 6 de julho" */
  dateLabel: string;
  /** 1 linha de resumo financeiro do momento — ex.: "Seu saldo este mês está positivo em R$ 1.500,00." */
  summary: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1 border-b border-border pb-5">
      <p className="text-h2 font-serif italic font-normal tracking-tight text-ink">{greeting}</p>
      <p className="text-body text-ink-muted">
        {dateLabel} · {summary}
      </p>
    </div>
  );
}
