/**
 * Pílula com contorno em gradiente, trio Renda/Gastos/Aportes do documento de referência de
 * design: fundo sólido, borda de 1,5px em gradiente da cor do contexto, valor abreviado dentro
 * e rótulo pequeno colorido embaixo. Assume que fica direto sobre o fundo da página (canvas),
 * não dentro de um card, se precisar usar sobre outra superfície, passe `fillColor`.
 */
export function GradientPill({
  label,
  value,
  colorFrom,
  colorTo,
  fillColor = "var(--color-canvas)",
}: {
  label: string;
  value: string;
  colorFrom: string;
  colorTo: string;
  fillColor?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5"
      style={{
        border: "1.5px solid transparent",
        backgroundImage: `linear-gradient(${fillColor}, ${fillColor}), linear-gradient(135deg, ${colorFrom}, ${colorTo})`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: colorTo }}>
        {label}
      </span>
    </div>
  );
}
