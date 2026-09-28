/**
 * Em qual perfil os lançamentos de um banco conectado entram.
 *
 * A conexão ainda não guarda o perfil em que foi criada (BankConnection não tem profileId), e
 * usar o perfil ATIVO na hora da busca espalhava o mesmo banco por vários perfis: ela conecta o
 * Nubank no Pessoal, troca pra Empresa, e o cron da noite despejava os gastos da casa na DRE da
 * Empresa. Então o perfil é deduzido do que o próprio banco já deixou no app:
 *
 * 1. as transações desta busca que já foram importadas antes (a folga de 5 dias garante que quase
 *    sempre há alguma) mostram onde a conexão mora — vence o perfil com mais delas;
 * 2. sem nenhuma, o último lote "openfinance" com o nome deste banco, mas só se nenhuma outra
 *    conexão da pessoa tem o mesmo nome (dois "Nubank" em perfis diferentes seriam chute);
 * 3. sem nada disso (primeira busca), o perfil ativo — que é onde ela está ao conectar.
 */
export function escolherPerfilDaConexao(input: {
  /** profileId de cada lançamento já existente com o id de uma transação desta busca. */
  jaImportadas: (string | null)[];
  /** Perfil do último lote "openfinance" com o nome deste banco, se o nome é só desta conexão. */
  perfilDoUltimoLote: string | null;
  perfilAtivo: string;
}): string {
  const contagem = new Map<string, number>();
  for (const p of input.jaImportadas) {
    // Nulo é histórico de antes dos perfis: não diz onde a conexão mora hoje.
    if (p) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  }
  let melhor: string | null = null;
  let maior = 0;
  for (const [p, n] of contagem) {
    if (n > maior) {
      melhor = p;
      maior = n;
    }
  }
  return melhor ?? input.perfilDoUltimoLote ?? input.perfilAtivo;
}
