/**
 * Lê a cotação que a pessoa digitou: "5,9071" (teclado em português) e "5.9071" (celular em
 * inglês, cujo teclado decimal só tem ponto).
 *
 * Ponto só é separador de milhar quando também há vírgula ("1.234,56"). Apagar todo ponto
 * transformava "5.91" em 591 e o salário de € 2.000 virava R$ 1.182.000.
 */
export function parseRate(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return clean !== "" && Number.isFinite(n) && n > 0 ? n : null;
}
