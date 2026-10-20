/**
 * O celular está fora do Brasil? (20/10/2026: a primeira cliente na Argentina não viu o "Moro fora
 * do Brasil" e ficou com tudo em reais.) Pelo fuso do aparelho: os fusos do Brasil são poucos e
 * conhecidos. Fuso desconhecido ou vazio conta como Brasil, para não abrir nada à toa.
 */
const FUSOS_DO_BRASIL = new Set([
  "America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife", "America/Maceio", "America/Belem",
  "America/Araguaina", "America/Santarem", "America/Manaus", "America/Cuiaba", "America/Campo_Grande",
  "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco", "America/Eirunepe", "America/Noronha",
  "Brazil/East", "Brazil/West", "Brazil/Acre", "Brazil/DeNoronha",
]);

export function pareceForaDoBrasil(fuso: string | undefined | null): boolean {
  if (!fuso || !fuso.includes("/")) return false;
  if (fuso === "Etc/UTC" || fuso.startsWith("Etc/")) return false;
  return !FUSOS_DO_BRASIL.has(fuso);
}
