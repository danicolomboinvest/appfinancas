/**
 * A ponte da cobrança, já juntada (11/10/2026): a regra da "Conta do parceiro" (R$ 27 por ano)
 * mora em src/lib/adicionais/acesso.ts. Todo o login do par chama
 * `temAdicional(idDaTitular, "conta_parceiro")` por aqui.
 *
 * `inicioDaCobranca` e `cobrancaDosAdicionaisLigada` continuam saindo daqui porque as telas de
 * Perfis e do Nós dois decidem por elas se mostram o "Liberar" (a compra em /adicionais/<qual>).
 */

import { inicioDaCobranca } from "@/lib/adicionais/config";

export { temAdicional } from "@/lib/adicionais/acesso";
export { inicioDaCobranca, type Adicional } from "@/lib/adicionais/config";

/** Com a variável vazia ou inválida a cobrança está desligada: nenhum botão "Liberar" leva para a compra. */
export function cobrancaDosAdicionaisLigada(valor: string | undefined = process.env.ADICIONAIS_COBRAR_DESDE): boolean {
  return inicioDaCobranca(valor) !== null;
}
