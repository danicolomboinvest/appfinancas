import { dataArgentinaNoInicio, pareceDaArgentina } from "./argentina";
import { isArgentinaTarjeta } from "./argentina-tarjeta-pdf";
import { parseTextLines, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta da Argentina, o "resumen de cuenta" / "movimientos" (caja de ahorro e cuenta
 * corriente): uma linha por movimento, com a data, o concepto, o débito ou o crédito e o saldo.
 *
 *   FECHA     CONCEPTO                         DEBITO        CREDITO        SALDO
 *   01/10/26  SALDO ANTERIOR                                                 150.000,00
 *   02/10/26  COMPRA DEBITO COTO SUC 45        12.345,67                    137.654,33
 *   03/10/26  TRANSFERENCIA RECIBIDA                         80.000,00      217.654,33
 *   03/10/26  IMP. LEY 25413 DEB                    74,07                  217.580,26
 *
 * O jeito de ler é o mesmo do extrato brasileiro que o app já lê: o saldo depois de cada linha diz
 * se o dinheiro entrou ou saiu. O que muda é a superfície, e é isso que se traduz antes: a data
 * com o ano de dois dígitos ou o mês em espanhol ("02/10/26", "02-Oct-26" → "02/10/2026"), o "$"
 * colado no número e o menos depois dele ("74,07-" → "-74,07").
 *
 * Os bancos de lá não publicam o layout do extrato (a pesquisa de 14/10/2026 não achou nenhum em
 * fonte pública), então o leitor é genérico de propósito: não depende da ordem das colunas.
 */

const MARCAS_DE_CUENTA_RE =
  /\b(?:caja\s+de\s+ahorros?|cuenta\s+corriente|resumen\s+de\s+cuenta|movimientos|saldo\s+(?:anterior|inicial|final|al\s)|cbu|cvu)\b/i;

export function isArgentinaCuenta(texto: string): boolean {
  return pareceDaArgentina(texto) && MARCAS_DE_CUENTA_RE.test(texto.slice(0, 12000)) && !isArgentinaTarjeta(texto);
}

/** O texto do extrato argentino com a superfície do brasileiro (ver o comentário do arquivo). */
export function textoArgentinoNoJeitoBrasileiro(texto: string, anoRef: number): string {
  return texto
    .replace(/[−–—]/g, "-")
    .split(/\r?\n/)
    .map((bruta) => {
      const linha = bruta.trim();
      const data = dataArgentinaNoInicio(linha, anoRef);
      let resto = data ? linha.slice(data.tamanho) : linha;
      resto = resto
        // "$ 1.234,56" e "$-1.234,56": o "$" sai; o "R$" do Brasil fica onde estava.
        .replace(/(?<!R)\$\s?(?=-?\d)/g, "")
        // "1.234,56-" (débito com o menos depois) vira "-1.234,56".
        .replace(/(?<![\d.,])((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})-(?!\d)/g, "-$1");
      if (!data) return resto;
      const [a, m, d] = data.iso.split("-");
      return `${d}/${m}/${a} ${resto.trim()}`;
    })
    .join("\n");
}

export function parseArgentinaCuenta(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  return parseTextLines(textoArgentinoNoJeitoBrasileiro(texto, refYear), refYear);
}
