/**
 * A busca de Transações (14/10/2026). Antes só achava com o acento certo: "pao" não achava "Pão de
 * Açúcar", e quase ninguém digita acento no celular. E não achava pelo valor: "103,30" (o que ela
 * vê no extrato do banco) dava "Nada com esse filtro".
 */
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function casaComABusca(busca: string, textos: (string | null | undefined)[], valor: number): boolean {
  const termo = semAcento(busca.trim());
  if (!termo) return true;
  if (semAcento(textos.filter(Boolean).join(" ")).includes(termo)) return true;
  // Só número (com vírgula ou ponto de centavos): compara com o valor, sem sinal.
  const numero = termo.replace(/^r\$\s*/, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(numero)) return false;
  const v = Math.abs(valor);
  const temCentavos = /[.,]\d{1,2}$/.test(numero) && !/^\d{1,3}(\.\d{3})+$/.test(numero);
  const n = temCentavos ? Number(numero.replace(/\.(?=\d{3})/g, "").replace(",", ".")) : Number(numero.replace(/\./g, ""));
  return temCentavos ? Math.abs(v - n) < 0.005 : Math.floor(v) === n;
}
