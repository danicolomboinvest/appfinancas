import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta Mercado Pago em PDF.
 *
 *   EXTRATO DE CONTA
 *   Saldo inicial: R$ 0,08 Entradas: R$ 10.635,42
 *   Saidas: R$ -10.625,71
 *   DETALHE DOS MOVIMENTOS
 *   Data Descrição ID da operação Valor Saldo
 *   02-08-2026 Dinheiro retirado Reserva 170862863469 R$ 85,69 R$ 85,77    ← tudo numa linha
 *   02-08-2026                                                              ← ou a data sozinha,
 *   Pagamento com QR Pix                                                       a descrição em
 *   LOJA EXEMPLO LTDA                                                          várias linhas, e
 *   171758506078 R$ -58,48 R$ 27,29                                            ID + valor + saldo
 *
 * O leitor genérico não entendia a data com hífen nem a descrição quebrada: 0 de 90 linhas.
 * O valor já vem com sinal; o último número da linha é o saldo, não o lançamento.
 */

const DATA_RE = /^(\d{2})-(\d{2})-(\d{4})\b\s*(.*)$/;
const FIM_RE = /^(.*?)\s*(\d{6,})?\s*R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s+R\$\s*-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
const IGNORAR_RE = /^(Data Descri|Saldo final|\d+\/\d+$|--\s*\d+ of \d+)/i;

export function isMercadoPagoStatement(texto: string): boolean {
  return /EXTRATO DE CONTA/.test(texto) && /DETALHE DOS MOVIMENTOS/i.test(texto) && /ID da opera[çc][ãa]o/i.test(texto);
}

export function parseMercadoPagoStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let aberto: { date: string; partes: string[] } | null = null;
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!dentro) {
      dentro = /^DETALHE DOS MOVIMENTOS/i.test(linha);
      continue;
    }
    if (!linha || IGNORAR_RE.test(linha)) continue;

    let resto = linha;
    const data = linha.match(DATA_RE);
    if (data) {
      aberto = { date: `${data[3]}-${data[2]}-${data[1]}`, partes: [] };
      resto = data[4];
    }
    if (!aberto) continue;
    const fim = resto.match(FIM_RE);
    if (!fim) {
      if (resto) aberto.partes.push(resto);
      continue;
    }
    const amount = parseBrazilianNumber(fim[3]);
    const description = [...aberto.partes, fim[1]].join(" ").replace(/\s+/g, " ").trim() || "Lançamento";
    if (!Number.isNaN(amount) && amount !== 0) out.push({ date: aberto.date, description, amount });
    aberto = null;
  }
  return out;
}
