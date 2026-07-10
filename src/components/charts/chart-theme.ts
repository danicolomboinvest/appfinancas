// Paleta consistente para os gráficos Recharts no tema editorial "First Light" (papel/tinta
// + dourado). Usa var(--color-*) em vez de hex fixo — o SVG resolve os custom properties como
// qualquer outra propriedade CSS, então os gráficos acompanham a troca de tema claro/escuro
// automaticamente, sem precisar de lógica JS de detecção de tema.
export const CHART_COLORS = {
  grid: "var(--color-border)",
  axis: "var(--color-ink-muted)",
  accent: "var(--color-accent)",
  accentStrong: "var(--color-accent-strong)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  muted: "var(--color-ink-faint)",
};

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--color-surface-2)",
    border: "1px solid var(--color-border-strong)",
    borderRadius: 10,
    color: "var(--color-ink)",
    fontSize: 12,
    boxShadow: "var(--shadow-premium)",
  },
  labelStyle: { color: "var(--color-ink-muted)" },
  itemStyle: { color: "var(--color-ink)" },
  // "hover" (padrão do Recharts) não existe de verdade em touchscreen — um toque não sustenta
  // estado de hover, então o tooltip nunca aparece de forma confiável no celular. "click" faz o
  // toque mostrar/trocar o tooltip explicitamente, funcionando igual com mouse no desktop.
  trigger: "click" as const,
};

export const CHART_LEGEND_STYLE = {
  fontSize: 12,
  color: "var(--color-ink-muted)",
};
