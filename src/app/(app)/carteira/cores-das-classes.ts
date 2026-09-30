/**
 * A cor de cada tipo de investimento na rosca "Por tipo" e na bolinha da lista.
 *
 * Uma cor por fatia. Antes Renda Fixa e Tesouro Direto saíam com a mesma cor e lado a lado
 * (pareciam uma fatia só), e Fundos, Cripto e Outros eram todos cinza, iguais ao "Outros".
 *
 * Só usa tokens de gráfico que já existem (`--color-strat-*` e `--color-chart-*`), que cada
 * tema já pinta do jeito dele — nenhuma cor nova, nenhum token mexido. INTERNACIONAL fica com
 * a cor de EXTERIOR, o mesmo balde da Estratégia.
 *
 * Fica fora do AssetsSection (que é de cliente) pra dar pra testar sem React.
 */
export const CLASS_COLOR: Record<string, string> = {
  ACAO: "var(--color-strat-acoes)",
  FII: "var(--color-strat-fiis)",
  FUNDO: "var(--color-strat-pre)",
  INTERNACIONAL: "var(--color-strat-exterior)",
  RENDA_FIXA: "var(--color-strat-pos)",
  TESOURO_DIRETO: "var(--color-strat-ipca)",
  // O lilás do chart-5 é parecido com o do strat-pre (Fundos) no tema Padrão: por isso Cripto
  // fica longe de Fundos na ordem da rosca, entre o verde do Tesouro e o cinza de Outros.
  CRIPTO: "var(--color-chart-5)",
  OUTRO: "var(--color-strat-outros)",
};

/**
 * Ordem fixa das classes na rosca e nos filtros (cores estáveis entre visitas). A ordem também
 * separa as cores parecidas: fatia vizinha nunca tem tom próximo (Renda Fixa azul ao lado do
 * Tesouro verde, e não de outro azul).
 */
export const CLASS_ORDER = ["ACAO", "FII", "FUNDO", "INTERNACIONAL", "RENDA_FIXA", "TESOURO_DIRETO", "CRIPTO", "OUTRO"];
