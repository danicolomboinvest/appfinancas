/**
 * TROCAR NA JUNÇÃO DOS BRANCHES.
 *
 * A cobrança da "Conta do parceiro" (R$ 27 por ano) mora no branch cobranca-adicionais, em
 * src/lib/adicionais/acesso.ts, com esta mesma assinatura:
 *
 *   temAdicional(userId: string, adicional: Adicional, agora?: Date): Promise<boolean>
 *
 * Este arquivo é só a ponte até a junção, para o login do par não depender daquele branch. Na
 * junção, o corpo inteiro vira uma linha:
 *
 *   export { temAdicional, type Adicional } from "@/lib/adicionais/acesso";
 *
 * (e `Adicional` passa a vir de "@/lib/adicionais/config"). Nada mais muda: todo o login do par
 * chama `temAdicional(idDaTitular, "conta_parceiro")` por aqui.
 *
 * Até lá a regra é a mesma de lá ANTES do lançamento: a cobrança só liga com a variável
 * ADICIONAIS_COBRAR_DESDE; sem ela (como está hoje), todo mundo tem. Se alguém ligar a variável
 * com este arquivo ainda aqui, o par fica sem acesso (falha fechada) e o aviso abaixo aparece no
 * log: sinal de que a junção não foi feita.
 */

export type Adicional = "perfil_empresa" | "conta_parceiro";

/** A mesma leitura da variável que o branch de cobrança faz (config.ts de lá). */
export function inicioDaCobranca(valor: string | undefined = process.env.ADICIONAIS_COBRAR_DESDE): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}/.test(valor.trim())) return null;
  const d = new Date(`${valor.trim().slice(0, 10)}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A tela de compra (/adicionais/<qual>) só existe com o branch de cobrança. Enquanto a variável
 * estiver vazia, nenhum botão "Liberar" pode levar para lá.
 */
export function cobrancaDosAdicionaisLigada(valor: string | undefined = process.env.ADICIONAIS_COBRAR_DESDE): boolean {
  return inicioDaCobranca(valor) !== null;
}

export async function temAdicional(userId: string, adicional: Adicional, agora: Date = new Date()): Promise<boolean> {
  void userId;
  void adicional;
  const desde = inicioDaCobranca();
  if (!desde || agora < desde) return true;
  console.warn("[casal-login] ADICIONAIS_COBRAR_DESDE ligada sem a regra de cobrança: troque src/lib/casal-login/adicional.ts pela de src/lib/adicionais/acesso.ts.");
  return false;
}
