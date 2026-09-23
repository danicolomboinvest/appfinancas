import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato salvo pelo APLICATIVO da Caixa ("Extrato por Período").
 *
 * Ao contrário de todo o resto, aqui o lançamento vem de trás pra frente: primeiro a descrição
 * (quebrada em até três linhas), depois o valor, e só então o dia.
 *
 *   Deb Pix Chave          ← descrição
 *   Danielle de Almeida
 *   Bicudo
 *   -R$ 400,91             ← valor, com o sinal explícito
 *   21SET                  ← o dia fecha o lançamento
 *   Saldo do dia 	R$ 0,00 ← fotografia do saldo, não é movimento
 *
 * O leitor genérico procura a data no COMEÇO do lançamento e por isso não achava nenhum: uma
 * cliente subiu o extrato do mês inteiro (18 linhas com valor) e viu zero lançamentos.
 *
 * O ano não aparece junto do dia ("21SET"), mas o topo do arquivo lista as datas por extenso
 * ("21 de Setembro de 2026") — é de lá que o ano sai, sem chute.
 */
const MESES_CURTOS: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

const MESES_POR_EXTENSO: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

const TITULO_RE = /^\s*Extrato por Per[ií]odo\s*$/m;
const DIA_RE = /^(\d{2})(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/;
const DIA_POR_EXTENSO_RE = /^(\d{1,2}) de ([A-Za-zç]+) de (\d{4})\b/;
const VALOR_SOZINHO_RE = /^(-?)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
/** Saldo do dia / Saldo Anterior: fotografia do saldo, não movimento. */
const SALDO_RE = /^Saldo\b/i;
/** Botões e rodapé que o app da Caixa imprime junto. */
const RUIDO_RE = [/^Ordenar$/i, /^Compartilhar$/i, /^Voltar$/i, /^Extrato por Per[ií]odo$/i, /^-- \d+ of \d+ --$/];

export function isCaixaAppStatement(texto: string): boolean {
  return TITULO_RE.test(texto) && texto.split(/\r?\n/).some((l) => DIA_RE.test(l.trim()));
}

/**
 * "21SET" → "2026-09-21", usando as datas por extenso do topo do arquivo. Quando o dia não está
 * listado lá (arquivo cortado), cai no ano de referência.
 */
function mapaDeDatas(linhas: string[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const linha of linhas) {
    const m = linha.match(DIA_POR_EXTENSO_RE);
    if (!m) continue;
    const mes = MESES_POR_EXTENSO[m[2].toLowerCase()];
    if (!mes) continue;
    const dia = m[1].padStart(2, "0");
    const sigla = Object.keys(MESES_CURTOS).find((s) => MESES_CURTOS[s] === mes);
    if (sigla) mapa.set(`${dia}${sigla}`, `${m[3]}-${mes}-${dia}`);
  }
  return mapa;
}

export function parseCaixaAppStatement(
  texto: string,
  refYear: number = new Date().getFullYear(),
): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const datas = mapaDeDatas(linhas);

  const out: ParsedTransaction[] = [];
  let descricao: string[] = [];
  let valor: number | null = null;

  for (const linha of linhas) {
    if (!linha) continue;
    if (RUIDO_RE.some((re) => re.test(linha)) || DIA_POR_EXTENSO_RE.test(linha)) continue;
    // Saldo zera o que estava aberto: o que vinha antes dele já foi fechado ou era lixo.
    if (SALDO_RE.test(linha)) {
      descricao = [];
      valor = null;
      continue;
    }

    const dia = linha.match(DIA_RE);
    if (dia) {
      if (valor !== null && descricao.length > 0) {
        const chave = `${dia[1]}${dia[2]}`;
        out.push({
          date: datas.get(chave) ?? `${refYear}-${MESES_CURTOS[dia[2]]}-${dia[1]}`,
          description: descricao.join(" ").replace(/\s+/g, " ").trim() || "Lançamento",
          amount: valor,
        });
      }
      descricao = [];
      valor = null;
      continue;
    }

    const dinheiro = linha.match(VALOR_SOZINHO_RE);
    if (dinheiro) {
      const magnitude = Math.abs(parseBrazilianNumber(dinheiro[2]));
      valor = Number.isNaN(magnitude) || magnitude === 0 ? null : (dinheiro[1] === "-" ? -magnitude : magnitude);
      continue;
    }

    // Descrição: no máximo três linhas, como o app quebra o nome de quem recebeu/enviou.
    if (descricao.length < 3) descricao.push(linha);
  }

  return out;
}
