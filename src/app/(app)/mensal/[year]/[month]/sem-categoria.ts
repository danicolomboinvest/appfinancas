/**
 * A linha de Transações de um gasto sem categoria (22/10/2026): dizia "Gasto" enquanto o
 * Orçamento mostrava o mesmo valor em "Sem categoria". As duas telas falam igual agora.
 */
export function rotuloSemCategoria(category: string, tipo: string): string {
  return category === "EXPENSE" ? "Sem categoria" : tipo;
}
