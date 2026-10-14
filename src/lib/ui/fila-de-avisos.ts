/**
 * A fila dos avisos do rodapé (14/10/2026). Achado no teste de lançar: ela tocou em Salvar sem
 * categoria, escolheu a categoria e salvou, e o "Escolha uma categoria" continuou na tela EM CIMA
 * do "Lançamento salvo". Parecia que tinha dado errado. Agora:
 * - o aviso de que deu certo tira da fila os avisos de erro (o erro era da tentativa anterior);
 * - o mesmo texto não entra duas vezes (dois toques em Salvar viravam dois avisos iguais).
 */
export type AvisoNaFila = { id: number; message: string; erro?: boolean };

export function entrarNaFila<T extends AvisoNaFila>(fila: T[], novo: T): T[] {
  const sobra = fila.filter((a) => a.message !== novo.message && (novo.erro || !a.erro));
  return [...sobra, novo];
}
