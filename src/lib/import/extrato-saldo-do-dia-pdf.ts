import type { ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta em PDF que agrupa os lançamentos por dia, com o saldo no fim de cada dia:
 *
 *   Ontem Saldo do dia: R$ 169,68
 *   Movimentação Descritivo Número do documento Valor
 *   Transferência enviada via Pix LOJA X E0185877420261028 - R$10,00
 *   Transferência recebida via FULANO E6070119020261028 + R$100,00
 *   27/10/2026 Saldo do dia: R$ 192,48
 *
 * O dia mais novo vem primeiro e pode vir escrito "Hoje" ou "Ontem" (a data é a do "Solicitado em").
 * Uma cliente subiu o extrato de 53 linhas com valor e viu zero lançamentos. Como o saldo do dia
 * está impresso, a leitura só vale se cada dia fechar no centavo: saldo do dia = saldo do dia
 * anterior (o de baixo na lista) mais os lançamentos dele. O dia mais antigo não tem o de baixo
 * pra comparar e entra como está.
 */

const CABECALHO_RE = /^(\d{2}\/\d{2}\/\d{4}|Hoje|Ontem)\s+Saldo do dia:\s*R\$\s*(-?[\d.]+,\d{2})\s*$/i;
const LINHA_RE = /^(.+?)\s+([+-])\s*R\$\s*([\d.]+,\d{2})\s*$/;
const SOLICITADO_RE = /Solicitado em:\s*(\d{2})\/(\d{2})\/(\d{4})/i;

export function isExtratoSaldoDoDia(texto: string): boolean {
  return /Saldo do dia:\s*R\$/i.test(texto) && /Movimenta[çc][ãa]o\s+Descritivo/i.test(texto) && SOLICITADO_RE.test(texto);
}

function numero(bruto: string): number {
  return Number(bruto.replace(/\./g, "").replace(",", "."));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseExtratoSaldoDoDia(texto: string): ParsedTransaction[] {
  const sol = texto.match(SOLICITADO_RE);
  if (!sol) return [];
  const hoje = new Date(Date.UTC(Number(sol[3]), Number(sol[2]) - 1, Number(sol[1])));
  const ontem = new Date(hoje.getTime() - 86400000);

  type Dia = { data: string; saldo: number; linhas: ParsedTransaction[] };
  const dias: Dia[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    const cab = linha.match(CABECALHO_RE);
    if (cab) {
      const rotulo = cab[1].toLowerCase();
      const data =
        rotulo === "hoje" ? iso(hoje) : rotulo === "ontem" ? iso(ontem) : cab[1].split("/").reverse().join("-");
      const ultimo = dias[dias.length - 1];
      // Cabeçalho repetido na quebra de página: é o mesmo dia.
      if (ultimo && ultimo.data === data && ultimo.saldo === numero(cab[2])) continue;
      dias.push({ data, saldo: numero(cab[2]), linhas: [] });
      continue;
    }
    const dia = dias[dias.length - 1];
    if (!dia) continue;
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const valor = numero(m[3]);
    if (!(valor > 0)) continue;
    // Tira o número do documento (código sem espaço, com letra e número) do fim da descrição.
    const descricao = m[1].replace(/\s+\S*\d\S*$/, "").trim() || m[1].trim();
    dia.linhas.push({ date: dia.data, description: descricao, amount: m[2] === "-" ? -valor : valor });
  }

  for (let i = 0; i < dias.length - 1; i++) {
    const soma = dias[i].linhas.reduce((s, t) => s + t.amount, 0);
    const esperado = Math.round((dias[i + 1].saldo + soma) * 100) / 100;
    if (esperado !== dias[i].saldo) return [];
  }
  return dias.flatMap((d) => d.linhas);
}
