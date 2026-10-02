import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da Conta Digital XP (PDF "Conta Digital XP | Extrato", do app da XP).
 *
 *   Data Descrição Valor Saldo
 *   01/10/26 às 11:19:19 Transferência recebida da conta investimento R$ 275,00 R$ 292,78
 *   30/09/26 às 16:25:48 Pix enviado para Mercado X -R$ 65,22 R$ 17,78
 *   20/09/26 às 17:56:26 Pix enviado para Empresa de Nome Muito Comprido   ← a descrição quebra
 *   Pagamentos Ltda                                                          e o valor desce
 *   -R$ 23,90 R$ 682,91                                                      pra outra linha
 *
 * Ano com dois dígitos e "às" no meio: o leitor genérico não achava a data e não lia nada (duas
 * clientes, 25 e 37 linhas com valor, zero lançamentos).
 */

const INICIO_RE = /^(\d{2})\/(\d{2})\/(\d{2}) às \d{2}:\d{2}(?::\d{2})?\s*(.*)$/;
const VALOR = String.raw`(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})`;
const VALOR_E_SALDO_RE = new RegExp(`^(.*?)\\s*${VALOR}\\s+-?R\\$\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2}$`);

export function isXpContaDigitalStatement(texto: string): boolean {
  return /Conta Digital XP \| Extrato/i.test(texto) && /^Data Descrição Valor Saldo$/m.test(texto);
}

export function parseXpContaDigitalStatement(texto: string): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const out: ParsedTransaction[] = [];
  let atual: { date: string; partes: string[] } | null = null;

  for (const linha of linhas) {
    if (!linha) continue;
    const inicio = linha.match(INICIO_RE);
    if (inicio) {
      atual = { date: `20${inicio[3]}-${inicio[2]}-${inicio[1]}`, partes: [] };
      const resto = inicio[4];
      if (!fechar(resto)) atual.partes.push(resto);
      continue;
    }
    if (!atual) continue;
    if (!fechar(linha)) {
      // Rodapé ou cabeçalho de página antes do valor aparecer: a linha não era continuação.
      if (atual.partes.length >= 3 || /^(Data Descrição|Extrato simples|-- \d+ of)/.test(linha)) atual = null;
      else atual.partes.push(linha);
    }
  }
  return out;

  function fechar(trecho: string): boolean {
    const m = trecho.match(VALOR_E_SALDO_RE);
    if (!m || !atual) return false;
    const descricao = [...atual.partes, m[1]].join(" ").replace(/\s+/g, " ").trim() || "Lançamento";
    const valor = parseBrazilianNumber(m[3]);
    if (valor) out.push({ date: atual.date, description: descricao, amount: m[2] === "-" ? -valor : valor });
    atual = null;
    return true;
  }
}
