/**
 * "Atualizar com o extrato novo" (30/10/2026): em 14 dias, 68 pessoas subiram o mesmo arquivo de
 * novo 195 vezes, quase sempre um arquivo que o app já tinha lido. Quem faz isso quer o mês
 * atualizado, não o dobro. O app já pula o que já está gravado (a leitura marca "já estava no
 * app", a gravação pula pela chave exata e pela data + valor); aqui fica a frase da tela de
 * pronto e a contagem que ela usa.
 */

/** Linha da revisão como a tela de pronto a vê: só o que importa para contar. */
export type LinhaContada = { ignorar?: boolean; jaNoApp?: { id?: string; faturaAberta?: boolean; paguei?: boolean } | null };

/**
 * Quantas linhas do arquivo já estavam no app e NÃO vão para a gravação: o lançado à mão igual
 * (tem `id`, é acertado à parte). As que vieram de outro arquivo (sem id) vão para a gravação
 * marcadas `jaEstava` e voltam contadas em `skipped`; a compra do print da fatura aberta passa
 * para o lote da fatura e o "Paguei" entra com a categoria da conta, então nenhum dos dois conta.
 */
export function jaEstavamNoApp(linhas: LinhaContada[]): number {
  return linhas.filter((l) => !l.ignorar && l.jaNoApp && !!l.jaNoApp.id && !l.jaNoApp.faturaAberta && !l.jaNoApp.paguei).length;
}

/** "5 já estavam no app, trouxe só os 3 novos." Sem repetido, ou sem nada novo: null (a tela tem a frase dela). */
export function fraseJaEstavamNoApp(jaEstavam: number, novos: number): string | null {
  if (jaEstavam <= 0 || novos <= 0) return null;
  const antes = jaEstavam === 1 ? "1 já estava no app" : `${jaEstavam} já estavam no app`;
  const depois = novos === 1 ? "trouxe só 1 novo" : `trouxe só os ${novos} novos`;
  return `${antes}, ${depois}.`;
}
