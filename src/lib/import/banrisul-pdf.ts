import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta corrente do Banrisul (PDF do app/Home Banking, em letra de máquina).
 *
 *   SALDO ANT EM 31/08/2026 12.130,19            ← saldo: não é movimento
 *   ++ MOVIMENTOS SET/2026                       ← mês e ano dos dias que vêm abaixo
 *   01 REND CDB AUT 0000RC 0,01                  ← dia só no primeiro lançamento do dia
 *   IOF ADICIONAL 000000 0,02-                   ← mesmo dia; o "-" no FIM é saída
 *   SALDO NA DATA 12.130,18
 *   11 PIX RECEBIDO BF96AD 33,22
 *   NOME: FULANA DE TAL                          ← quem mandou/recebeu: vira parte da descrição
 *   ------ MOVIMENTOS FUTUROS DA CONTA CORRENTE ------   ← agendado, ainda não aconteceu
 *
 * O leitor genérico não lia nenhuma linha: não tem data completa e o sinal vem depois do número.
 * Uma cliente subiu dois extratos (35 e 13 linhas com valor) e não viu nada.
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

const MES_RE = /^\+\+\s*MOVIMENTOS\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})/i;
const LANCAMENTO_RE = /^(?:(\d{2})\s+)?(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(-?)$/;

export function isBanrisulStatement(texto: string): boolean {
  return /^B A N R I S U L$/m.test(texto) && /MOVIMENTOS DA CONTA CORRENTE/i.test(texto) && /^\+\+\s*MOVIMENTOS\s+[A-Z]{3}\/\d{4}/im.test(texto);
}

export function parseBanrisulStatement(texto: string): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const out: ParsedTransaction[] = [];
  let dentro = false;
  let mesAno: { mes: string; ano: string } | null = null;
  let dia: string | null = null;

  for (const linha of linhas) {
    if (!linha) continue;
    // "MOVIMENTOS FUTUROS DA CONTA CORRENTE" fecha: é agendamento, não saiu da conta ainda.
    if (/MOVIMENTOS FUTUROS/i.test(linha)) break;
    if (/MOVIMENTOS DA CONTA CORRENTE/i.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (/EXTRATO EMITIDO/i.test(linha)) break;

    const mes = linha.match(MES_RE);
    if (mes) {
      mesAno = { mes: MESES[mes[1].toUpperCase()], ano: mes[2] };
      dia = null;
      continue;
    }
    if (/^NOME:\s*/i.test(linha)) {
      const ultimo = out[out.length - 1];
      if (ultimo) ultimo.description = `${ultimo.description} ${linha.replace(/^NOME:\s*/i, "")}`;
      continue;
    }
    if (/^SALDO\b/i.test(linha) || !mesAno) continue;

    const m = linha.match(LANCAMENTO_RE);
    if (!m) continue;
    if (m[1]) dia = m[1];
    if (!dia) continue;
    // A descrição termina no código do documento ("PIX 030037", "REND CDB AUT 0000RC"): fora.
    const descricao = m[2].replace(/\s+\S*\d\S*$/, "").trim() || m[2];
    const valor = parseBrazilianNumber(m[3]);
    if (!valor) continue;
    out.push({ date: `${mesAno.ano}-${mesAno.mes}-${dia}`, description: descricao, amount: m[4] === "-" ? -valor : valor });
  }
  return out;
}
