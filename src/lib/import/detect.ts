import { isBanestesStatement } from "./banestes-pdf";
import { isBanrisulInvoice } from "./banrisul-fatura-pdf";
import { isBanrisulStatement } from "./banrisul-pdf";
import { isBancoDoBrasilStatement } from "./bb-pdf";
import { isBradescoCartoesApp } from "./bradesco-cartoes-app-pdf";
import { isBradescoInvoice } from "./bradesco-fatura-pdf";
import { isBradescoStatement } from "./bradesco-pdf";
import { isC6Invoice } from "./c6-fatura-pdf";
import { isCaixaAppStatement } from "./caixa-pdf";
import { isCoraStatement } from "./cora-pdf";
import { isInterInvoice, isInterStatement } from "./inter-pdf";
import { isItauInvoice } from "./itau-fatura-pdf";
import { isMercadoPagoInvoice } from "./mercado-pago-fatura-pdf";
import { isMidwayInvoice } from "./midway-fatura-pdf";
import { isNubankInvoice } from "./nubank-fatura-pdf";
import { isNubankStatement } from "./nubank-pdf";
import { isOurocardInvoice } from "./ourocard-pdf";
import { isPicPayInvoice } from "./picpay-fatura-pdf";
import { isSantanderInvoice } from "./santander-fatura-pdf";
import { isSantanderConsolidatedStatement } from "./santander-pdf";
import { isSicrediInvoice } from "./sicredi-fatura-pdf";
import { isXpContaDigitalStatement } from "./xp-conta-pdf";
import type { ParsedTransaction } from "./statement-parser";

export type DocKind = "extrato" | "fatura" | "unknown";

const OFX_DE_CONTA = "OFX de conta bancária";
const CSV_EXTRATO_NUBANK = "extrato do Nubank (CSV)";
const EXTRATO_SANTANDER = "extrato do Santander";
/**
 * Motivos que vêm da ESTRUTURA do arquivo, não de uma palavra solta: o OFX declara que é conta
 * bancária, o CSV do Nubank tem cabeçalho próprio. Fatura nenhuma sai nesses formatos, então a
 * contagem de sinais não desmente esses motivos.
 */
/**
 * O molde de cada banco que o app sabe ler, no lugar das palavras soltas. Uma linha de
 * lançamento "Pagamento de fatura" no extrato do Nubank vinha antes do rodapé "Extrato gerado
 * dia" (que às vezes só aparece na última página), e o teste de palavras chamava o extrato de
 * FATURA: as saídas viravam compra e as entradas (resgates, Pix recebidos) viravam estorno, tudo
 * num mês só, com o gasto do mês negativo e nenhum aviso. Quem reconheceu o molde sabe o que é.
 */
const MOLDES_DE_EXTRATO: [(t: string) => boolean, string][] = [
  [isNubankStatement, "extrato do Nubank"],
  [isInterStatement, "extrato do Inter"],
  [isCoraStatement, "extrato da Cora"],
  [isBanestesStatement, "extrato do Banestes"],
  [isCaixaAppStatement, "extrato da Caixa"],
  [isBancoDoBrasilStatement, "extrato do Banco do Brasil"],
  [isBradescoStatement, "extrato do Bradesco"],
  [isSantanderConsolidatedStatement, EXTRATO_SANTANDER],
  [isBanrisulStatement, "extrato do Banrisul"],
  [isXpContaDigitalStatement, "extrato da Conta Digital XP"],
];
const MOLDES_DE_FATURA: [(t: string) => boolean, string][] = [
  [isNubankInvoice, "fatura do Nubank"],
  [isInterInvoice, "fatura do Inter"],
  [isC6Invoice, "fatura do C6"],
  [isMidwayInvoice, "fatura Riachuelo"],
  [isItauInvoice, "fatura do Itaú"],
  [isOurocardInvoice, "fatura Ourocard"],
  [isSantanderInvoice, "fatura do Santander"],
  [isBradescoInvoice, "fatura do Bradesco"],
  [isBradescoCartoesApp, "fatura do app Bradesco Cartões"],
  [isPicPayInvoice, "fatura do PicPay"],
  [isSicrediInvoice, "fatura do Sicredi"],
  [isMercadoPagoInvoice, "fatura do Mercado Pago"],
  [isBanrisulInvoice, "fatura do Banrisul"],
];

const MOTIVOS_ESTRUTURAIS_DE_EXTRATO = new Set([OFX_DE_CONTA, CSV_EXTRATO_NUBANK, ...MOLDES_DE_EXTRATO.map(([, motivo]) => motivo)]);

/** O molde de algum banco conhecido diz o que o arquivo é? Na dúvida (casou dos dois lados), não. */
function tipoPeloMolde(text: string): { kind: DocKind; reason: string } | null {
  const extrato = MOLDES_DE_EXTRATO.find(([reconhece]) => reconhece(text));
  const fatura = MOLDES_DE_FATURA.find(([reconhece]) => reconhece(text));
  if (extrato && !fatura) return { kind: "extrato", reason: extrato[1] };
  if (fatura && !extrato) return { kind: "fatura", reason: fatura[1] };
  return null;
}

/**
 * O pedaço do começo do arquivo em que as PALAVRAS de fatura valem: sem as linhas de lançamento
 * e sem "pagamento de fatura", que é o nome de uma saída comum no extrato de quem paga o cartão
 * pela conta (o caso mais comum), não o cabeçalho de uma fatura.
 */
function cabecalhoSemLancamentos(headLower: string): string {
  return headLower
    .split(/\r?\n/)
    .filter((l) => !(/\d,\d{2}/.test(l) && /^\s*\d{1,2}(?:\/|\s+[a-zç]{3}\b)/.test(l)))
    .join("\n")
    .replace(/\b(?:pagamento|pagto|pgto|pag)\.?\s+(?:d[ae]\s+|da\s+sua\s+)?fatura\b/g, " ");
}

/**
 * O que o arquivo É, pelo nome e pelo conteúdo. O erro mais caro da importação, nos dados
 * reais, era fatura de cartão subida como extrato: toda compra virava renda. Quando dá pra
 * saber, o app avisa antes de gravar.
 */
export function detectDocKind(text: string, fileName?: string | null): { kind: DocKind; reason: string } {
  const name = (fileName ?? "").toLowerCase();
  const head = text.slice(0, 4000);
  const headLower = head.toLowerCase();

  // OFX declara o tipo de conta.
  if (/<creditcardmsgsrsv1>|<ccstmtrs>|<ccacctfrom>/i.test(head)) return { kind: "fatura", reason: "OFX de cartão de crédito" };
  if (/<bankmsgsrsv1>|<stmtrs>|<bankacctfrom>/i.test(head)) return { kind: "extrato", reason: OFX_DE_CONTA };

  // Cabeçalhos conhecidos.
  const firstLine = head.split(/\r?\n/).find((l) => l.trim())?.toLowerCase() ?? "";
  if (/^date\s*,\s*title\s*,\s*amount/.test(firstLine)) return { kind: "fatura", reason: "fatura do Nubank (CSV)" };
  if (/identificador/.test(firstLine) && /descri/.test(firstLine)) return { kind: "extrato", reason: CSV_EXTRATO_NUBANK };
  if (/final do cart[aã]o|nome no cart[aã]o|parcela/.test(firstLine)) return { kind: "fatura", reason: "fatura de cartão (CSV)" };
  if (/saldo/.test(firstLine)) return { kind: "extrato", reason: "extrato com coluna de saldo" };

  // PDF de banco que o app conhece: o molde decide, não as palavras. (Inclui o Santander, que
  // quebra as palavras no meio, "EXT R ATO", e só é reconhecido sem os espaços.)
  const molde = tipoPeloMolde(text);
  if (molde) return molde;

  // Texto (PDF/planilha): palavras que só uma fatura tem. "vencimento" como palavra inteira
  // (não "vencimentos" de um CDB) e "fatura" fora das linhas de lançamento.
  const cabeca = cabecalhoSemLancamentos(headLower);
  if (/fatura|\bvencimento\b|limite dispon[ií]vel|pagamento m[ií]nimo/.test(cabeca) && !/extrato/.test(headLower)) return { kind: "fatura", reason: "cabeçalho de fatura" };
  if (/extrato|saldo (anterior|do dia|final)|conta corrente/.test(headLower)) return { kind: "extrato", reason: "cabeçalho de extrato" };

  if (/fatura|invoice/.test(name) || /^nubank_\d{4}-\d{2}-\d{2}\.csv$/.test(name)) return { kind: "fatura", reason: "nome do arquivo" };
  if (/extrato|statement|^nu_\d+_/.test(name)) return { kind: "extrato", reason: "nome do arquivo" };
  return { kind: "unknown", reason: "" };
}

/**
 * Segunda opinião, pelos números: extrato bancário tem entradas e saídas; fatura de cartão é
 * quase toda de um lado só. Só vale com uma amostra razoável.
 */
export function looksLikeCardInvoice(txns: ParsedTransaction[]): boolean {
  if (txns.length < 8) return false;
  const positive = txns.filter((t) => t.amount > 0).length;
  const ratio = positive / txns.length;
  return ratio >= 0.9 || ratio <= 0.1;
}

/** Motivo mostrado quando quem decidiu foram os sinais, e não o cabeçalho do arquivo. */
export const MOTIVO_SINAIS_FATURA = "quase todos os lançamentos vão pro mesmo lado";

/**
 * O perfil disse "extrato"; os sinais desmentem? Só no caso CARO: quase tudo entrando como
 * dinheiro que chegou. É a fatura com "extrato" escrito no cabeçalho, que lançou compras como
 * renda. O contrário — quase tudo saída — é o extrato normal de quem recebe um salário e paga
 * doze contas no mês; tratar isso como fatura transformava o salário em estorno e a renda sumia.
 * E quando o motivo do perfil é a estrutura do arquivo (OFX, CSV do Nubank), ele vence sempre.
 */
export function sinaisDesmentemExtrato(txns: ParsedTransaction[], reason: string): boolean {
  if (MOTIVOS_ESTRUTURAIS_DE_EXTRATO.has(reason) || !looksLikeCardInvoice(txns)) return false;
  return txns.filter((t) => t.amount > 0).length / txns.length >= 0.9;
}

/** "Total da fatura R$ 2.345,67" / "Total a pagar" / "Valor total": pra conferir se a leitura fechou.
 * "Total da sua fatura" é o do Inter: sem ele valia o "Total a pagar" da simulação do pagamento
 * mínimo (com juros), mais abaixo, e a conferência dizia que a leitura não fechou quando fechou. */
export function detectInvoiceTotal(text: string): number | null {
  const m = text.match(/(?:total\s+(?:da\s+(?:sua\s+)?fatura|desta\s+fatura|a\s+pagar|geral)|valor\s+total(?:\s+da\s+fatura)?)\s*[:\-]?\s*(?:R\$\s?)?(-?\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Linhas do arquivo que têm cara de valor em dinheiro: base do "achei X linhas mas só li Y". */
export function countMoneyLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => /-?\d{1,3}(?:\.\d{3})*,\d{2}\b|-?\d+\.\d{2}\b/.test(l)).length;
}

/**
 * O arquivo é de um período em que nada aconteceu: o PDF do Nubank escreve "Nenhuma movimentação
 * realizada", o CSV vem só com o cabeçalho e o OFX vem sem nenhum <STMTTRN>. Sem isto a tela dizia
 * "esse formato eu ainda não conheço, manda pro suporte" — e a cliente tentou PDF, CSV e OFX
 * (8 vezes) de um extrato de um dia só, sem saber que o problema era o período.
 */
export function periodoSemMovimento(text: string): boolean {
  if (/nenhuma movimenta[çc][ãa]o/i.test(text)) return true;
  if (/<OFX>/i.test(text)) return !/<STMTTRN>/i.test(text);
  const linhas = text.split(/\r?\n/).filter((l) => l.trim());
  return linhas.length === 1 && /[;,\t]/.test(linhas[0]) && !/\d{1,3},\d{2}/.test(linhas[0]);
}
