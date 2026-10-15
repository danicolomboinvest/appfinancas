import { ehMovimentoEntrePessoas } from "./comerciante";
import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta corrente BTG Pactual em PDF (o do site/app, "Extrato de conta corrente").
 *
 *   Data e hora Categoria Transação Descrição Valor
 *   05/10/2026 10h51 Investimentos Transferência enviada Fulana Exemplo -R$ 1.816,52
 *   01/10/2026 08h09 Impostos e                                  ← a categoria quebra a linha
 *   Tributos IOF limite da conta BTG Pactual -R$ 1,75
 *   01/01/2026 23h59 Saldo Diário R$ 1.694,29                    ← saldo, não é lançamento
 *
 * O leitor genérico lia, mas a descrição saía com a hora e a categoria do banco grudadas
 * ("10h50 Seguro Pix recebido Fulana"), diferente da planilha do mesmo extrato ("Pix recebido ·
 * Fulana"), e a categoria do banco não chegava ao motor. Aqui sai igual à planilha.
 */

// As categorias que o BTG escreve, da mais longa para a mais curta (a quebra de linha vira espaço).
const CATEGORIAS = [
  "Lazer e Entretenimento", "Impostos e Tributos", "Bares e Restaurantes", "Outra Categoria", "Casa e Decoração",
  "Investimentos", "Transferência", "Supermercado", "Alimentação", "Assinaturas", "Transporte", "Educação",
  "Vestuário", "Serviços", "Compras", "Viagens", "Viagem", "Moradia", "Salário", "Seguro", "Contas", "Tarifas",
  "Saúde", "Beleza", "Pets", "Pet", "Casa",
];
const TRANSACOES = [
  "Pagamento de fatura do cartão", "Compra no débito autorizada", "Transferência recebida", "Transferência enviada",
  "Pagamento de boleto", "Pagamento de conta", "IOF limite da conta", "Compra no débito", "Débito automático",
  "Pix recebido", "Pix enviado", "TED recebida", "TED enviada", "Estorno", "Rendimento", "Saque",
];

const INICIO_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+\d{1,2}h\d{2}\b\s*(.*)$/;
const VALOR_FIM_RE = /^(.*?)\s*(-?)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tirarDoComeco(texto: string, lista: string[]): { achado: string | null; resto: string } {
  const t = semAcento(texto);
  for (const item of lista) {
    const i = semAcento(item);
    if (t === i || t.startsWith(i + " ")) return { achado: texto.slice(0, item.length), resto: texto.slice(item.length).trim() };
  }
  return { achado: null, resto: texto };
}

export function isBtgExtratoContaPdf(texto: string): boolean {
  return /Extrato de conta corrente/i.test(texto) && /BTG Pactual/i.test(texto) && /^Data e hora Categoria Transa[çc][ãa]o Descri[çc][ãa]o Valor\s*$/im.test(texto);
}

export function parseBtgExtratoContaPdf(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let atual: { data: string; corpo: string } | null = null;
  const fechar = (corpo: string, data: string) => {
    const v = corpo.match(VALOR_FIM_RE);
    if (!v) return false;
    const [, miolo, menos, valorTxt] = v;
    const juntos = miolo.replace(/\s+/g, " ").trim();
    if (/^saldo di[áa]rio$/i.test(juntos) || !juntos) return true;
    const cat = tirarDoComeco(juntos, CATEGORIAS);
    const tr = tirarDoComeco(cat.resto, TRANSACOES);
    const descricao = tr.achado ? [tr.achado, tr.resto].filter(Boolean).join(" · ") : cat.resto || juntos;
    const valor = parseBrazilianNumber(valorTxt);
    if (!Number.isFinite(valor) || valor === 0) return true;
    // A categoria do banco só vale em compra no cartão (ramo da maquininha): no Pix e na
    // transferência o BTG chuta (ver ehMovimentoEntrePessoas). "Investimentos" fica sempre: é o
    // que diz que a transferência foi para a corretora (aplicação) ou veio dela (resgate).
    const vale = cat.achado && (!ehMovimentoEntrePessoas(descricao) || /invest/i.test(cat.achado));
    out.push({ date: data, description: descricao, amount: menos ? -valor : valor, ...(vale ? { categoriaDoBanco: cat.achado! } : {}) });
    return true;
  };
  // O topo traz "12/10/2026 10h04 / Lançamentos: R$ 0,00" (a hora da emissão): só vale o que
  // vem depois do cabeçalho da tabela.
  let naTabela = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (/^Data e hora Categoria Transa/i.test(linha)) {
      naTabela = true;
      atual = null;
      continue;
    }
    // Cada página repete o topo (com a hora da emissão): sai da tabela até o próximo cabeçalho.
    if (/^Extrato de conta corrente\b/i.test(linha) || /^-- \d+ of \d+ --$/.test(linha)) {
      naTabela = false;
      atual = null;
      continue;
    }
    if (!naTabela) continue;
    const ini = linha.match(INICIO_RE);
    if (ini) {
      atual = { data: `${ini[3]}-${ini[2]}-${ini[1]}`, corpo: ini[4] };
    } else if (atual) {
      atual.corpo = `${atual.corpo} ${linha}`;
    } else continue;
    if (atual && fechar(atual.corpo, atual.data)) atual = null;
    // Linha que nunca fecha (cabeçalho, rodapé): não carrega para longe.
    if (atual && atual.corpo.length > 300) atual = null;
  }
  return out;
}
