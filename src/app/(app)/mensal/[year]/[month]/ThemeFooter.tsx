/** A linha de fecho de alguns temas ("Progresso, não perfeição 💗"). Sem texto, não existe. */
export function ThemeFooter({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <p className="text-center text-sm italic text-ink-faint">{texto}</p>;
}
