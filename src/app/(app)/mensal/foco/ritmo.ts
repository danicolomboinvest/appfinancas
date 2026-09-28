export type Ritmo = "semanal" | "mensal";

export function lerRitmo(valor: string | null | undefined): Ritmo | null {
  return valor === "semanal" || valor === "mensal" ? valor : null;
}

/** "2026-W40": a semana ISO de uma data (segunda a domingo). */
export function chaveDaSemana(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const diaSemana = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((t.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/** "2026-08": ano-mês. */
export function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}
