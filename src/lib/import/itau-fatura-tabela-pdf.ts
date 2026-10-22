import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Itaú no formato de TABELA (22/10/2026), o PDF do cartão emitido pelo
 * Banco Itaú S.A. com "Lançamentos / Data Descrição Valor":
 *
 *   Cartão final 1234 | Data de emissão: 13/10/2026 | Número da fatura:   ← cabeçalho, NÃO é compra
 *   Lançamentos
 *   Data 	Descrição 	Valor
 *   Saldo Anterior 	R$ 400,00                                            ← resumo
 *   15/09/2026 	Pagamento Fatura 	R$ -400,00                          ← pagamento da anterior
 *   Subtotal R$ 0,00
 *   Cartão Virtual - Final 1234 (FULANA - Titular)
 *   13/12/2025 	LOJA EXEMPLO DE ROUPA.10/10 	R$ 45,90                    ← parcela desta fatura
 *   Subtotal R$ 300,00
 *   Encargos e Tarifas
 *   Cobranca OverLimit 	R$ 50,00                                        ← cobrança SEM data
 *   Tarifa de anuidade diferenciada 09/12 	R$ 29,90
 *   Subtotal R$ 120,00
 *   Total R$ 420,00
 *
 * O leitor genérico pegava a data do cabeçalho e um valor solto do resumo como uma "compra" e
 * deixava de fora os encargos e tarifas, que não têm data: a fatura de uma cliente ficou em
 * "li R$ 974, o arquivo diz R$ 522" e entrou assim mesmo. Os encargos entram na data de emissão.
 * Compra sai POSITIVA; pagamento e estorno NEGATIVOS (o pagamento sai como linha de resumo).
 */

const VALOR = String.raw`R\$\s*(-?\s?\d{1,3}(?:\.\d{3})*,\d{2})`;
const COM_DATA_RE = new RegExp(String.raw`^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+${VALOR}$`);
const SEM_DATA_RE = new RegExp(String.raw`^([A-Za-zÀ-ÿ].*?)\s+${VALOR}$`);
const EMISSAO_RE = /Data de emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i;
const NAO_E_LINHA_RE = /^(Saldo Anterior|Subtotal|Total)\b/i;

export function isItauTabelaInvoice(texto: string): boolean {
  return /Banco Ita[uú] S\.A\./i.test(texto) && /^Lan[çc]amentos\s*$/im.test(texto) && /^Data\s+Descri[çc][ãa]o\s+Valor\s*$/im.test(texto) && /^Encargos e Tarifas\s*$/im.test(texto);
}

export function parseItauTabelaInvoice(texto: string): ParsedTransaction[] {
  const linhas = texto.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const inicio = linhas.findIndex((l) => /^Lan[çc]amentos$/i.test(l));
  if (inicio < 0) return [];
  const emissao = texto.match(EMISSAO_RE);
  const dataDaEmissao = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : null;
  const out: ParsedTransaction[] = [];
  let nosEncargos = false;
  for (const l of linhas.slice(inicio + 1)) {
    if (/^Total R\$/i.test(l)) break;
    if (/^Encargos e Tarifas$/i.test(l)) {
      nosEncargos = true;
      continue;
    }
    if (NAO_E_LINHA_RE.test(l)) continue;
    const comData = l.match(COM_DATA_RE);
    if (comData) {
      const valor = parseBrazilianNumber(comData[5].replace(/\s/g, ""));
      if (valor !== 0) out.push({ date: `${comData[3]}-${comData[2]}-${comData[1]}`, description: comData[4].trim(), amount: valor });
      continue;
    }
    const semData = nosEncargos && dataDaEmissao ? l.match(SEM_DATA_RE) : null;
    if (semData) {
      const valor = parseBrazilianNumber(semData[2].replace(/\s/g, ""));
      if (valor !== 0) out.push({ date: dataDaEmissao!, description: semData[1].trim(), amount: valor });
    }
  }
  return out;
}
