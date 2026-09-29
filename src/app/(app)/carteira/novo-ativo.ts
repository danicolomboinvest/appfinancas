/**
 * Pedido pra abrir o "Novo ativo" da lista da carteira, vindo de outro card da mesma tela.
 *
 * O card do aporte ("o ativo ainda não está aqui? Cadastre primeiro") apontava pra
 * /carteira#ativos, que não existia: ela já estava em /carteira, nada rolava e nenhum formulário
 * abria. O card e a lista são componentes irmãos na página, então o pedido vai por um evento da
 * janela e quem abre o modal é a própria lista, que já sabe fazer isso.
 */
export const ABRIR_NOVO_ATIVO = "carteira:novo-ativo";
