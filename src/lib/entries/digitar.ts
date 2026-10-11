/**
 * O "Digitar" do protótipo aprovado (11/10/2026): o valor sai de um teclado na tela, em
 * centavos, como numa maquininha ("4", "5", "9", "0" → 45,90). Sem teclado do celular, nada sobe
 * por cima da folha. Puro, para testar.
 */
export const MAX_CENTAVOS = 99_999_999_99; // R$ 99.999.999,99

export function teclar(centavos: number, tecla: string): number {
  if (tecla === "del") return Math.floor(centavos / 10);
  if (!/^\d{1,2}$/.test(tecla)) return centavos;
  const novo = Number(String(centavos) + tecla);
  return novo > MAX_CENTAVOS ? centavos : novo;
}

/** Centavos → "45.90" (o formato do campo `amount` do servidor). */
export const paraDecimal = (centavos: number) => (centavos / 100).toFixed(2);

/** "Hoje", "Ontem" ou outra data → "YYYY-MM-DD" no relógio do Brasil. */
export function dataDoChip(chip: "hoje" | "ontem" | string, hoje: Date): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (chip === "ontem") d.setDate(d.getDate() - 1);
  else if (chip !== "hoje") return chip;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
