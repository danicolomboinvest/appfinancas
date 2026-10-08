import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta da Unicred em PDF (internet banking).
 *
 *   Coop: 582 - AG: 1310 - Conta: 000000	Período de 30/09/2026 a 07/10/2026
 *   Saldo em 29/09/2026: R$ 21,51
 *   Lançamentos Saldo (R$)	Data Valor (R$)
 *   30/09/2026 RECEBIMENTO DE TED CTA SALARIO ( Doc.: 4065670
 *   / FULANA ) R$ 7.293,31	R$ 7.271,80              ← SALDO primeiro, depois o VALOR
 *   30/09/2026 DEB MENSALID PREVIDENCIA (
 *   Doc.: 32857 ) R$ 7.067,00	- R$ 226,31             ← saída com "- R$"
 *   Saldo no final do período R$ 1.982,36
 *   Lançamentos futuros                                ← agendado, ainda não aconteceu: fica fora
 *   13/10/2026 DEBITO FATURA- CARTAO VISA (...) - R$ 1.585,23
 *
 * O leitor genérico entendia o primeiro número como o lançamento (o normal é o saldo vir por
 * último): a mensalidade de R$ 226 entrava como R$ 7.067, e o mês de 7 dias somava R$ 35 mil de
 * saídas. O débito agendado do "Lançamentos futuros" também entrava.
 */

const DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.*)$/;
const FECHA_RE = /^(.*?)\s*R\$\s*-?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s+(-\s?)?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const FIM_RE = /^(Saldo no final do per[íi]odo|Lan[çc]amentos futuros|-\s?R\$.*Lan[çc]amentos futuros)/i;

export function isUnicredStatement(texto: string): boolean {
  return /^Lan[çc]amentos\s+Saldo \(R\$\)\s+Data\s+Valor \(R\$\)/im.test(texto) && /\bCoop:\s*\d+\s*-\s*AG:/i.test(texto);
}

export function parseUnicredStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let atual: { date: string; partes: string[] } | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (FIM_RE.test(linha)) break;
    const inicio = linha.match(DATA_RE);
    let resto = linha;
    if (inicio) {
      atual = { date: `${inicio[3]}-${inicio[2]}-${inicio[1]}`, partes: [] };
      resto = inicio[4];
    }
    if (!atual) continue;
    const fecha = resto.match(FECHA_RE);
    if (!fecha) {
      atual.partes.push(resto);
      // Descrição que não fecha em poucas linhas não é lançamento (cabeçalho, rodapé).
      if (atual.partes.length > 4) atual = null;
      continue;
    }
    const [, ultimoTrecho, , menos, valor] = fecha;
    const magnitude = parseBrazilianNumber(valor);
    const descricao = [...atual.partes, ultimoTrecho].join(" ").replace(/\s+/g, " ").trim() || "Lançamento";
    if (magnitude > 0) out.push({ date: atual.date, description: descricao, amount: menos ? -magnitude : magnitude });
    atual = null;
  }
  return out;
}
