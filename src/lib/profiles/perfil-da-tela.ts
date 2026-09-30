/**
 * O perfil ativo é da CONTA (fica no servidor), não da aba: trocar pra Pessoal no notebook vale
 * também para o celular. Uma tela que ficou aberta na Empresa (a revisão de um extrato, o
 * formulário de lançamento) gravava no perfil que estivesse ativo na HORA de salvar — os 80
 * lançamentos da Empresa entravam no Pessoal. Quem grava manda junto o id do perfil que a tela
 * mostra, e o servidor recusa se ele não é mais o ativo.
 */
export const MSG_TROCOU_DE_PERFIL = "Você trocou de perfil; recarregue a página.";

/**
 * A tela foi aberta num perfil que não é mais o ativo? Sem id (tela de antes desta versão, ainda
 * aberta durante o deploy) não barra nada: melhor gravar como antes do que recusar todo mundo.
 */
export function trocouDePerfil(perfilDaTela: unknown, perfilAtivo: string): boolean {
  return typeof perfilDaTela === "string" && perfilDaTela !== "" && perfilDaTela !== perfilAtivo;
}
