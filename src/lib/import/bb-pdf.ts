import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta corrente do Banco do Brasil em PDF.
 *
 * O sinal NÃO vem no número: vem depois dele, entre parênteses, e a descrição desce pras linhas
 * de baixo:
 *
 *   Dia Documento Valor   Lote Histórico
 *   31/08/2026 0,00 (+)   Saldo Anterior
 *   01/09/2026 20,00 (-)  11111 90002 Pix - Enviado
 *   01/09 10:03 PADARIA DO BAIRRO                     ← continuação da descrição
 *   01/09/2026 2.180,00 (+)  9903 BB Rende Fácil     ← resgate da aplicação
 *   01/09/2026 0,00 (+)   99020 Saldo do dia
 *   ...
 *   Informações Adicionais                            ← daqui pra baixo é resumo, não movimento
 *   50.000,00 (+)  CREDITO BB-MELHOR OFERTA*
 *
 * O leitor genérico ignorava o "(+)"/"(-)" e decidia o sinal pelas palavras: resgate da
 * aplicação virava gasto, pagamento do cartão virava entrada, e a oferta de crédito do rodapé
 * (centenas de milhares de reais) entrava como receita. Uma cliente viu mais de R$ 1 milhão
 * de "entrada" no mês.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)\s*(.*)$/;
/** Lote e número do documento que vêm antes do histórico ("11111 90002 Pix - Enviado"). */
const CODIGOS_RE = /^(?:\d+(?:\s+|$)){0,2}/;
const FIM_RE = /^(Informa[çc][õo]es Adicionais|Lan[çc]amentos Futuros)\b/i;
const RUIDO_RE = [
  /^Extrato de Conta Corrente$/i,
  /^Cliente:/i,
  /^Ag[êe]ncia:/i,
  /^Lan[çc]amentos$/i,
  /^Dia\s+(Lote\s+)?Documento/i,
  /^-- \d+ of \d+ --$/,
];
const SALDO_RE = /^(Saldo Anterior|Saldo do dia|S A L D O|Saldo)\b/i;
/** "01/09 10:03 " no começo da continuação: data/hora do Pix, repete o que já está na linha. */
const HORA_RE = /^\d{2}\/\d{2}\s+\d{2}:\d{2}\s+/;

export function isBancoDoBrasilStatement(texto: string): boolean {
  if (!/Extrato de Conta Corrente/i.test(texto) || !/Dia\s+(Lote\s+)?Documento/i.test(texto)) return false;
  const linhas = texto.split(/\r?\n/);
  return linhas.filter((l) => LINHA_RE.test(l.replace(/\t/g, " ").trim())).length >= 3;
}

export function parseBancoDoBrasilStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let aberto: { date: string; amount: number; partes: string[]; saldo: boolean } | null = null;

  const fechar = () => {
    if (aberto && !aberto.saldo && aberto.amount !== 0) {
      const descricao = aberto.partes.join(" ").replace(/\s+/g, " ").trim();
      out.push({ date: aberto.date, description: descricao || "Lançamento", amount: aberto.amount });
    }
    aberto = null;
  };

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").trim();
    if (!linha) continue;
    if (FIM_RE.test(linha)) break;
    if (RUIDO_RE.some((re) => re.test(linha))) {
      fechar();
      continue;
    }

    const m = linha.match(LINHA_RE);
    if (m) {
      fechar();
      const [, dd, mm, yyyy, valor, sinal, resto] = m;
      const historico = resto.replace(CODIGOS_RE, "").trim();
      const magnitude = parseBrazilianNumber(valor);
      aberto = {
        date: `${yyyy}-${mm}-${dd}`,
        amount: Number.isNaN(magnitude) ? 0 : sinal === "-" ? -magnitude : magnitude,
        partes: historico ? [historico] : [],
        saldo: SALDO_RE.test(historico),
      };
      continue;
    }

    // Continuação da descrição (no máximo três linhas: nome que quebra em duas + detalhe).
    if (aberto && aberto.partes.length < 4) aberto.partes.push(linha.replace(HORA_RE, ""));
  }
  fechar();
  return out;
}
