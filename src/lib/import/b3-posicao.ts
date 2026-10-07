import type { AssetClass, FixedIncomeIndex } from "@prisma/client";
import { detectFixedIncomeIndex, guessAssetClass, parseFlexibleNumber, type ParsedHolding } from "./portfolio-parser";

/**
 * Posição baixada da Área do Investidor da B3 (investidor.b3.com.br › Posição), em Excel ou PDF.
 * É o arquivo que a própria Carteira manda a pessoa baixar.
 *
 * Excel: uma aba por tipo, cada uma com o cabeçalho "Produto;Instituição;…". Renda fixa não tem
 * código de negociação (CDB1243C8PO não é ticker) e o valor fica em "Valor Atualizado CURVA". O
 * leitor de planilha procurava ticker na coluna Código e não achava nenhum; o perfil, vendo
 * "Vencimento" em toda linha, chamava o arquivo de FATURA e a Carteira recusava.
 *
 * PDF ("Extrato de Posição"): mesma tabela, com o nome do produto e da instituição quebrados em
 * várias linhas e cada seção fechando em "Total R$ 71.609,12" — que serve de conferência.
 */

export function isB3Position(texto: string): boolean {
  if (/^Produto;Institui[çc][ãa]o;/m.test(texto) && /Valor Atualizado/i.test(texto)) return true;
  return /Extrato de Posi[çc][ãa]o/i.test(texto) && /investidor\.b3\.com\.br/i.test(texto) && /^Produto\s/m.test(texto);
}

export function parseB3Position(texto: string): ParsedHolding[] {
  const daPlanilha = lerPlanilha(texto);
  if (daPlanilha.length > 0) return daPlanilha;
  return lerPdf(texto);
}

function indexador(raw: string, nome: string): FixedIncomeIndex | undefined {
  // A B3 escreve só "DI" (o CDI), que o detector geral não reconhece.
  if (/^\s*DI\s*$/i.test(raw)) return "POS_FIXADO";
  return detectFixedIncomeIndex(raw, nome);
}

function classeDoNome(nome: string): AssetClass {
  return /^tesouro\b/i.test(nome) ? "TESOURO_DIRETO" : "RENDA_FIXA";
}

/** Ordem de preferência do valor: o "Valor Atualizado" das abas de ações/tesouro, a curva da renda
 * fixa (é o que o PDF da B3 mostra), e só então mercado/fechamento. */
const COLUNAS_DE_VALOR = [/^valor atualizado$/, /^valor atualizado curva$/, /^valor atualizado mtm$/, /^valor atualizado fechamento$/, /^valor l[íi]quido$/];

function lerPlanilha(texto: string): ParsedHolding[] {
  const out: ParsedHolding[] = [];
  let cab: string[] | null = null;
  for (const linha of texto.split(/\r?\n/)) {
    const cols = linha.split(";").map((c) => c.trim());
    if (/^produto$/i.test(cols[0] ?? "") && /^institui[çc][ãa]o$/i.test(cols[1] ?? "")) {
      cab = cols.map((c) => c.toLowerCase());
      continue;
    }
    if (!cab || !cols[0]) continue; // linha de "Total" e linhas vazias não têm produto
    const col = (re: RegExp) => cab!.findIndex((h) => re.test(h));
    const qtd = parseFlexibleNumber(cols[col(/^quantidade$/)] ?? "");
    let valor = NaN;
    for (const re of COLUNAS_DE_VALOR) {
      const i = col(re);
      const v = i === -1 ? NaN : parseFlexibleNumber(cols[i] ?? "");
      if (Number.isFinite(v) && v > 0) {
        valor = v;
        break;
      }
    }
    if (!(valor > 0)) continue;
    const nome = cols[0];
    const codigo = (cols[col(/^c[óo]digo de negocia[çc][ãa]o$/)] ?? "").toUpperCase();
    const quantity = Number.isFinite(qtd) ? qtd : 0;
    if (/^[A-Z]{4}\d{1,2}$/.test(codigo)) {
      out.push({ ticker: codigo, quantity, value: valor, assetClass: guessAssetClass(codigo) });
      continue;
    }
    const aplicado = parseFlexibleNumber(cols[col(/^valor aplicado$/)] ?? "");
    out.push({
      ticker: nome,
      quantity,
      value: valor,
      assetClass: classeDoNome(nome),
      fixedIncomeIndex: indexador(cols[col(/^indexador$/)] ?? "", nome),
      ...(aplicado > 0 ? { investedValue: aplicado } : {}),
    });
  }
  return out;
}

const VALOR = String.raw`R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})`;
/** "… 08/01/2027 5 R$ 1.491,28 R$ 7.456,40" (renda fixa: preço unitário e valor) ou
 * "… 01/03/2027 0,32 R$ 4.985,22 R$ 6.408,42" (tesouro: aplicado e valor). */
const LINHA_PDF = new RegExp(String.raw`^(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+${VALOR}\s+${VALOR}\s*`);

function lerPdf(texto: string): ParsedHolding[] {
  const out: ParsedHolding[] = [];
  const instituicoes = new Set<string>();
  let tesouro = false;
  let buffer = "";
  let dentro = false;
  let instituicao: string | null = null;
  const fechar = () => {
    let resto = buffer.replace(/\s+/g, " ").trim();
    buffer = "";
    for (let m = resto.match(LINHA_PDF); m; m = resto.match(LINHA_PDF)) {
      resto = resto.slice(m[0].length);
      const antes = m[1];
      const qtd = parseFlexibleNumber(m[3]);
      const a = parseFlexibleNumber(m[4]);
      const valor = parseFlexibleNumber(m[5]);
      if (!(valor > 0)) continue;
      const nome = nomeDoProduto(antes, instituicoes);
      out.push({
        ticker: nome,
        quantity: Number.isFinite(qtd) ? qtd : 0,
        value: valor,
        assetClass: classeDoNome(nome),
        fixedIncomeIndex: detectFixedIncomeIndex("", nome),
        ...(tesouro && a > 0 ? { investedValue: a } : {}),
      });
    }
  };
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (/^Produto\s/.test(linha)) {
      fechar();
      dentro = true;
      tesouro = /valor aplicado/i.test(linha);
      continue;
    }
    if (!dentro) continue;
    if (/^Total$/i.test(linha) || /^Extrato de Posi[çc][ãa]o$/i.test(linha)) {
      fechar();
      dentro = false;
      continue;
    }
    // Restos do cabeçalho quebrado ("Preço", "unitário", "atualizado", "Valor").
    if (/^(pre[çc]o|unit[áa]rio|atualizado|valor)$/i.test(linha)) continue;
    // "Produto \tInstituição \t…": o que vem depois do 1º tab é a instituição, às vezes quebrada
    // nas linhas seguintes até o vencimento ("XP" / "INVESTIMENTOS" / "CCTVM S/A"). Guarda o nome
    // inteiro pra separar das linhas em que o PDF não pôs tab nenhum.
    const partes = linha.split("\t").map((p) => p.trim());
    if (/^\d{2}\/\d{2}\/\d{4}\b/.test(linha)) {
      if (instituicao) instituicoes.add(instituicao);
      instituicao = null;
    } else if (instituicao !== null) {
      instituicao += ` ${linha}`;
    } else if (partes.length >= 2 && /^[A-Za-zÀ-ú]/.test(partes[1])) {
      if (partes.length === 2) instituicao = partes[1];
      else instituicoes.add(partes[1]);
    }
    buffer += ` ${linha.replace(/\t/g, " ")}`;
  }
  fechar();
  return out;
}

/** O texto antes do vencimento é "produto + instituição". Tira a instituição do fim: a que o
 * próprio arquivo mostrou separada por tab, ou a repetição ("CDB - BANCO C6 S.A. BANCO C6 S.A."). */
function nomeDoProduto(antes: string, instituicoes: Set<string>): string {
  const t = antes.replace(/\s+/g, " ").trim();
  const conhecidas = [...instituicoes].map((i) => i.replace(/\s+/g, " ")).sort((a, b) => b.length - a.length);
  for (const inst of conhecidas) {
    const variantes = [inst, inst.replace(/\.$/, "")];
    for (const v of variantes) {
      // A instituição pode ter vindo quebrada em linhas ("XP" / "INVESTIMENTOS" / "CCTVM S/A").
      if (t.endsWith(` ${v}`) && t.length > v.length + 3) return t.slice(0, -v.length).trim();
    }
  }
  const palavras = t.split(" ");
  for (let n = Math.floor(palavras.length / 2); n >= 1; n--) {
    if (palavras.slice(-n).join(" ") === palavras.slice(-2 * n, -n).join(" ")) return palavras.slice(0, -n).join(" ");
  }
  return t;
}
