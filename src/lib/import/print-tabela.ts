import type { LinhaDoPrint, PrintLido, Segmento } from "./print-fatura";

/**
 * Print da FATURA EM PDF (22/10/2026), não da tela do app do banco: a pessoa abre o PDF no celular
 * e manda a captura da tabela "Data | Descrição | Valor R$" com o "TOTAL DESTE CARTÃO" no fim
 * (Bradesco, "Histórico de despesas"). O leitor de print só conhecia a lista do app e dizia "não
 * consegui ler" com o texto todo legível: 3 prints seguidos e a cliente desistiu.
 *
 * O OCR troca dígito; por isso a tabela só vale quando a soma das compras fecha no centavo com o
 * total impresso no próprio print. Não fechou ou não tem total: devolve null e nada é gravado.
 */

const DATA_RE = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/;
const VALOR_RE = /^(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})(-)?$/;
const PARCELA_RE = /\s(\d{1,2})\/(\d{1,2})(?=\s|$)/;
const TOTAL_RE = /^total\b/i;
const PAGAMENTO_RE = /\bpagamento\b/i;

const centavos = (n: number) => Math.round(n * 100);
const valorDe = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));

/** As linhas da imagem: pedaços com o meio na mesma altura, da esquerda para a direita. */
export function linhasDaImagem(segmentos: Segmento[]): Segmento[][] {
  const linhas: { meio: number; segs: Segmento[] }[] = [];
  for (const s of [...segmentos].sort((a, b) => a.y0 - b.y0)) {
    const meio = (s.y0 + s.y1) / 2;
    const altura = Math.max(8, s.y1 - s.y0);
    const linha = linhas.find((l) => Math.abs(l.meio - meio) < altura * 0.6);
    if (linha) linha.segs.push(s);
    else linhas.push({ meio, segs: [s] });
  }
  return linhas.map((l) => l.segs.sort((a, b) => a.x0 - b.x0));
}

export function lerTabelaDaFatura(segmentos: Segmento[]): PrintLido | null {
  const linhas: LinhaDoPrint[] = [];
  let total: number | null = null;
  for (const segs of linhasDaImagem(segmentos)) {
    const textos = segs.map((s) => s.texto.trim()).filter(Boolean);
    if (textos.length < 2) continue;
    const valor = textos[textos.length - 1].match(VALOR_RE);
    if (TOTAL_RE.test(textos[0])) {
      if (valor && total === null) total = valorDe(valor[2]);
      continue;
    }
    const data = textos[0].match(DATA_RE);
    if (!data || !valor) continue;
    const descricao = textos.slice(1, -1).join(" ").trim();
    if (!descricao || PAGAMENTO_RE.test(descricao)) continue;
    const ano = data[3].length === 2 ? 2000 + Number(data[3]) : Number(data[3]);
    const parcela = descricao.match(PARCELA_RE);
    const menos = valor[1] ?? valor[3];
    linhas.push({
      data: `${ano}-${data[2]}-${data[1]}`,
      nome: (parcela ? descricao.replace(PARCELA_RE, " ") : descricao).replace(/\s+/g, " ").trim(),
      valor: valorDe(valor[2]),
      sinal: menos ? "-" : null,
      credito: !!menos,
      parcela: parcela ? { atual: Number(parcela[1]), total: Number(parcela[2]) } : null,
    });
  }
  if (linhas.length === 0 || total === null) return null;
  const soma = linhas.reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0);
  if (centavos(soma) !== centavos(total)) return null;
  return { linhas, cabecalhoNoFim: null, totalDaFatura: total };
}
