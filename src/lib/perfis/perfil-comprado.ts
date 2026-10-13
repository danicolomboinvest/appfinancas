/**
 * O perfil comprado (13/10/2026): as marcas e os textos do aviso. Sem React e sem banco. A regra
 * de quando cria e quando avisa mora em lib/repositories/perfil-comprado.repo.ts.
 *
 * Textos: pouco texto, sem travessão, sem emoji, sem gênero, "para" e não "pra".
 */

export const PREFIXO_DO_PERFIL_COMPRADO = "perfil-comprado:";

/** Chaves em NotificationLog (único por conta + chave). */
export const CHAVES_DO_PERFIL_COMPRADO = {
  empresa: "perfil-comprado:empresa",
  avisoEmpresa: "perfil-comprado:empresa:aviso",
  vistoEmpresa: "perfil-comprado:empresa:visto",
  vistoCasal: "perfil-comprado:casal:visto",
} as const;

/** O nome com que a tela de Perfis cria a Empresa ("Criar Empresa"). */
export const NOME_DA_EMPRESA_COMPRADA = "Empresa";

export type AvisoDoPerfilComprado = { tipo: "empresa"; perfilId: string } | { tipo: "casal" };

/** Marca do aparelho, para não abrir de novo enquanto o servidor grava o visto. */
export const CHAVE_LOCAL_PERFIL_COMPRADO = "perfil-comprado-visto";

export function textosDoAvisoDoPerfilComprado(tipo: AvisoDoPerfilComprado["tipo"]) {
  if (tipo === "empresa") {
    return {
      titulo: "Sua Empresa está pronta",
      texto: "O dinheiro do negócio fica separado do seu. Para começar, são 5 perguntas rápidas.",
      abrir: "Abrir a Empresa",
      depois: "Depois",
    };
  }
  return {
    titulo: "O Casal está liberado",
    texto: "Chame o seu par para dividir as contas da casa no app.",
    abrir: "Convidar meu par",
    depois: "Depois",
  };
}
