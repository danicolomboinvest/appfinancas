/**
 * Textos da calculadora "Quanto cada um contribui?" (`/divisao`), na voz do Padrão — as frases
 * EXATAS que o app tinha antes desses textos existirem por tema. Só existe no perfil Casal, e
 * só nele: então, ao contrário do resto do catálogo, não precisa de camada de tipo — cada tema
 * já pode escrever a versão dele diretamente aqui, sem risco de vazar pra Pessoal ou Empresa.
 *
 * Prefixo `cas` (não `div`, que já é de Dividendos em `voice-base.ts`).
 */
export type TextosCasal = {
  casTitulo: string;
  casSub: string;
  casRendaA: string;
  casRendaAHint: string;
  casRendaB: string;
  casRendaBHint: string;
  casDespesas: string;
  casDespesasHint: string;
  /** "Vocês gastaram R$ 4.200 este mês" — a sugestão que preenche as despesas comuns. */
  casDespesasSugestao(valor: string): string;
  casPctLabel: string;
  /** O sufixo dentro do campo de percentual: "% pro outro". */
  casPctSufixo: string;
  /** "Voltar pra sugestão da renda (40%)". */
  casPctVoltar(pct: number): string;
  casPctDica: string;
  casSemRenda: string;
  casHeaderAuto: string;
  casHeaderManual: string;
  casTextoAuto: string;
  casTextoManual: string;
  casContribA: string;
  casContribB: string;
  /** "60% das despesas comuns". */
  casContribPct(pct: number): string;
  casSobraLivre(valor: string): string;
  casComparandoTitulo: string;
  casComparandoIgual(valor: string): string;
  casComparandoMenos(valor: string): string;
  casComparandoMais(valor: string): string;
  casComparandoParecido: string;
  casComparandoManualNota(pct: number): string;
  casRendaConjunta(valor: string): string;
};

export const PADRAO_CASAL: TextosCasal = {
  casTitulo: "Quanto cada um contribui?",
  casSub: "A prática mais recomendada quando as rendas são diferentes: dividir as contas do casal na mesma proporção da renda de cada um, não 50/50.",
  casRendaA: "Quanto um dos dois recebe por mês",
  casRendaAHint: "A renda de uma pessoa do casal, líquida.",
  casRendaB: "Quanto o outro recebe por mês",
  casRendaBHint: "A renda da outra pessoa, líquida.",
  casDespesas: "Despesas comuns do mês",
  casDespesasHint: "Aluguel, mercado, contas da casa: o que é dos dois, não o gasto individual de cada um.",
  casDespesasSugestao: (valor) => `Vocês gastaram ${valor} este mês`,
  casPctLabel: "Já combinaram um percentual diferente? (opcional)",
  casPctSufixo: "% pro outro",
  casPctVoltar: (pct) => `Voltar pra sugestão da renda (${pct}%)`,
  casPctDica: "Em branco, o app sugere pela renda de cada um.",
  casSemRenda: "Preencha a renda dos dois pra ver quanto cada um contribui.",
  casHeaderAuto: "Divisão proporcional à renda",
  casHeaderManual: "Percentual combinado por vocês",
  casTextoAuto: "A prática mais recomendada quando as rendas são diferentes: cada um contribui na mesma proporção que representa na renda do casal, não 50/50.",
  casTextoManual: "Vocês digitaram o próprio percentual, em vez de seguir a proporção da renda.",
  casContribA: "Um dos dois contribui",
  casContribB: "O outro contribui",
  casContribPct: (pct) => `${pct}% das despesas comuns`,
  casSobraLivre: (valor) => `Sobra livre: ${valor}`,
  casComparandoTitulo: "Comparando com 50/50",
  casComparandoIgual: (valor) => `Se dividissem igual, cada um pagaria ${valor}.`,
  casComparandoMenos: (valor) => `Do jeito que está, quem ganha menos paga ${valor} a menos por mês.`,
  casComparandoMais: (valor) => `Do jeito que está, quem ganha menos paga ${valor} a mais por mês.`,
  casComparandoParecido: "As duas rendas são parecidas, então dá quase no mesmo que 50/50.",
  casComparandoManualNota: (pct) => `Pela proporção da renda, seria ${pct}% pro outro.`,
  casRendaConjunta: (valor) => `Renda conjunta: ${valor}. A conta não fica salva — é só pra decidir a divisão desse mês.`,
};
