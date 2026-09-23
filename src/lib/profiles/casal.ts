import type { ProfileKind } from "@prisma/client";

/**
 * Perfil do tipo Casal: duas pessoas compartilhando o mesmo dinheiro, um login só — quem
 * mantém a conta fala pelos dois, igual a Empresa é uma pessoa cuidando do dinheiro do
 * negócio (ver src/lib/profiles/empresa.ts). O app não tem acesso multiusuário: não dá pra
 * cada parceiro logar separado no mesmo perfil, então nada aqui depende disso.
 *
 * Diferente da Empresa, o Casal NÃO troca o vocabulário do app: "Moradia", "Alimentação",
 * "Metas" continuam fazendo sentido do jeito que já são pra um casal. A voz de cada tema
 * (Girly, Disciplina…) já foi calibrada com cuidado — sobrescrever esses textos por um
 * genérico "vocês" quebraria esse trabalho tema por tema, então a adaptação do Casal fica só
 * em pontos aditivos: uma tarefa a mais na semana (ver weekly-tasks) e uma calculadora própria
 * de como dividir as contas do casal (ver src/lib/simulators/divisao-casal.ts).
 */
export function ehCasal(kind: ProfileKind | string | null | undefined): boolean {
  return kind === "CASAL";
}
