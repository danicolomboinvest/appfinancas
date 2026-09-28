/**
 * Lê o que a pessoa digitou num campo de percentual ou número dos simuladores: "10,5" (teclado
 * em português) e "10.5" (teclado numérico ou celular em inglês, que só tem ponto).
 *
 * Devolve null enquanto o texto ainda não é um número ("", "-", ","), para o campo não gravar
 * nada no meio da digitação. Antes, "10." chegava vazio do <input type=number>, virava 0, o
 * React regravava "0" e o "5" seguinte dava "05": 10,5% virava 5% sem ninguém ver.
 *
 * Ponto só é separador de milhar quando também há vírgula ("1.234,5"), como no parseRate.
 * Zero e negativos valem (IR de 0%, imóvel que desvaloriza).
 */
export function parseWizardNumber(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return clean !== "" && Number.isFinite(n) ? n : null;
}
