import { semAcentoNemPontuacao } from "./comerciante";
import { nomeParecido } from "./parecido-manual";

/**
 * Print da fatura ABERTA (13/10/2026): a lista de compras que o app do banco mostra antes de a
 * fatura fechar, tirada como captura de tela. Sem Open Finance, é o jeito de acompanhar o mês
 * antes do PDF da fatura existir.
 *
 * O OCR (lib/import/ocr-print.ts) devolve PEDAÇOS de texto com a posição de cada um na tela. A
 * posição é o que importa: o app do banco põe o nome à esquerda e o valor à direita, e o OCR lê
 * as duas colunas como blocos separados ("todos os nomes, depois todos os valores"). Aqui os
 * pedaços que se encostam na vertical viram UMA compra (nome, valor, data, "Parcela 2/3" embaixo).
 *
 * Funções puras, sem banco e sem OCR, para testar com qualquer layout.
 */

/** Um pedaço de texto lido no print, com a caixa dele em pixels. */
export type Segmento = { texto: string; x0: number; y0: number; x1: number; y1: number };

/** Uma compra (ou crédito) lida num print. */
export type LinhaDoPrint = {
  /** "AAAA-MM-DD"; null quando a data ficou no print anterior (o cabeçalho rolou para cima). */
  data: string | null;
  nome: string;
  /** Sempre positivo; o sinal lido vai em `sinal`. */
  valor: number;
  /** O sinal escrito na tela ("-R$ 89,90", "+ R$ 20,00"); null quando não tem. */
  sinal: "-" | "+" | null;
  /** O nome diz que é devolução ("Estorno", "Reembolso"). */
  credito: boolean;
  parcela: { atual: number; total: number } | null;
  /**
   * Compra em moeda estrangeira ("- US$ 19,00"). `valor` só é em real quando o print mostra o real
   * ao lado; senão fica 0 e o valor em dólar vai aqui: dólar NUNCA é gravado como se fosse real.
   */
  estrangeira?: { moeda: "USD" | "EUR" | "GBP" | null; valor: number } | null;
};

/** O que entra na leitura da fatura: igual a uma linha de PDF já lida (compra positiva). */
export type CompraDoPrint = { date: string; description: string; amount: number };

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_DA_SEMANA: Record<string, number> = {
  dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, qua: 3, quarta: 3, qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, sabado: 6,
};
const DIA_MS = 86_400_000;

/** Sem acento, minúsculo, pontuação vira espaço (mas mantém / , . - + $ dos valores e datas). */
function simples(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dataDe(envio: string, dia: number, mes: number, ano?: number): string | null {
  if (!(dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)) return null;
  const hoje = new Date(`${envio}T12:00:00Z`);
  let y = ano ?? hoje.getUTCFullYear();
  if (ano !== undefined && ano < 100) y = 2000 + ano;
  let d = new Date(Date.UTC(y, mes - 1, dia, 12));
  if (d.getUTCMonth() !== mes - 1) return null;
  // Sem ano: compra ainda não feita não existe; "14/Nov" lido em outubro é de novembro passado
  // (parcela de uma compra antiga), nunca do mês que vem.
  if (ano === undefined && d.getTime() - hoje.getTime() > DIA_MS) {
    d = new Date(Date.UTC(y - 1, mes - 1, dia, 12));
    if (d.getUTCMonth() !== mes - 1) return null;
  }
  return iso(d);
}

/** A data está onde uma fatura aberta pode estar: até ~2 meses antes do envio e no máximo amanhã. */
function plausivel(data: string, envio: string): boolean {
  const dias = (Date.parse(`${envio}T12:00:00Z`) - Date.parse(`${data}T12:00:00Z`)) / DIA_MS;
  return dias >= -1 && dias <= 75;
}

/** Abreviação de mês lida com um erro do OCR ("our", "0UT", "ouT"): só quando dá um mês só. */
function mesDoNome(nome: string): number {
  const n = nome.replace(/0/g, "o").replace(/1/g, "l").replace(/\.$/, "");
  const longo = MESES_LONGOS.indexOf(n);
  if (longo >= 0) return longo + 1;
  const curto = MESES_CURTOS.indexOf(n.slice(0, 3));
  if (curto >= 0 && (n.length === 3 || MESES_LONGOS[curto].startsWith(n))) return curto + 1;
  if (n.length !== 3) return 0;
  const perto = MESES_CURTOS.flatMap((m, i) => ([...m].filter((c, k) => c !== n[k]).length === 1 ? [i + 1] : []));
  return perto.length === 1 ? perto[0] : 0;
}

/**
 * Lê uma data escrita do jeito dos apps: "Hoje", "Ontem", "Sábado", "SEX, 09 OUT", "12 OUT",
 * "12 de outubro", "12/10", "12/10/2026". `inteira`: o texto TODO tem que ser a data (cabeçalho);
 * senão vale a data no começo do texto (coluna de data à esquerda do nome). `resto` é o que
 * sobra depois da data, com as letras do jeito que vieram.
 */
export function lerData(texto: string, envio: string, inteira = true): { data: string; resto: string } | null {
  const original = texto.normalize("NFC").replace(/[|]/g, " ");
  // Mesmo tamanho do original (sem acento, minúsculo): o que casar aqui corta o original no mesmo ponto.
  // O "0" lido como letra ("O6 out", "o5"): volta a ser número, sem mudar o tamanho.
  const t = original
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(^|[\s,/])o(?=\d)/g, "$10");
  const hoje = new Date(`${envio}T12:00:00Z`);
  const fim = inteira ? "[\\s.,;:]*$" : "(?=[\\s.,;:]|$)[.,;:]?";
  const resto = (n: number) => original.slice(n).replace(/^[\s.,;:—–-]+/, "").trim();
  const ini = t.match(/^\s*/)![0].length;
  const relativa = t.slice(ini).match(new RegExp(`^(hoje|ontem|anteontem)\\b${fim}`));
  // "Hoje 13/Out", "Ontem, 12 out": quando a data vem escrita, ela manda.
  const relativaComData = relativa ? null : t.slice(ini).match(/^(?:hoje|ontem|anteontem)\b[\s,.-]*(?=\d)/);
  if (relativa) {
    const atras = relativa[1] === "hoje" ? 0 : relativa[1] === "ontem" ? 1 : 2;
    return { data: iso(new Date(hoje.getTime() - atras * DIA_MS)), resto: resto(ini + relativa[0].length) };
  }
  // Dia da semana, sozinho ou na frente da data ("sex, 09 out", "sexta-feira, 9 de outubro").
  const semana = t.slice(ini).match(/^(dom(?:ingo)?|seg(?:unda)?|ter(?:ca)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|sab(?:ado)?)(?:[- ]?feira)?\b[,.]?\s*/);
  let pos = ini + (relativaComData ? relativaComData[0].length : 0);
  if (semana) {
    pos = ini + semana[0].length;
    const depois = t.slice(pos);
    if (/^[\s.,]*$/.test(depois) || (!inteira && !/^\d/.test(depois))) {
      const alvo = DIAS_DA_SEMANA[semana[1]];
      const atras = (hoje.getUTCDay() - alvo + 7) % 7;
      return { data: iso(new Date(hoje.getTime() - atras * DIA_MS)), resto: resto(pos) };
    }
  }
  const corpo = t.slice(pos);
  const porExtenso = corpo.match(new RegExp(`^(\\d{1,2})\\s*(?:de\\s+|/\\s*)?([a-z01]{3,9})\\.?(?:\\s*(?:de\\s+)?(\\d{4}))?${fim}`));
  if (porExtenso) {
    const mes = mesDoNome(porExtenso[2]);
    const data = mes ? dataDe(envio, Number(porExtenso[1]), mes, porExtenso[3] ? Number(porExtenso[3]) : undefined) : null;
    if (data) return { data, resto: resto(pos + porExtenso[0].length) };
  }
  // "12/10", "12/10/2026"; o OCR às vezes lê a barra dobrada ("13//10") ou como "1" ("11110").
  const numerica = corpo.match(new RegExp(`^(\\d{1,2})\\s*(?:/{1,2}|\\\\)\\s*(\\d{1,2})(?:/(\\d{2,4}))?${fim}`)) ?? (inteira ? corpo.match(/^(\d{2})[1l|](\d{2})()[\s.,]*$/) : null);
  if (numerica) {
    const data = dataDe(envio, Number(numerica[1]), Number(numerica[2]), numerica[3] ? Number(numerica[3]) : undefined);
    if (data && plausivel(data, envio)) return { data, resto: resto(pos + numerica[0].length) };
  }
  return null;
}

/** Só o dia sobrou na coluna de data ("o5" de "05 OUT"): o mês é o da compra de cima. */
function soODia(texto: string, deCima: string | null): string | null {
  // "o5", "05.", e "050" (o "O" de "OUT" grudado, o resto do mês perdido).
  const m = simples(texto).replace(/o/g, "0").match(/^(\d{1,2})(?:[.,]|(?<=^\d\d)0)?$/);
  if (!m || !deCima) return null;
  const dia = Number(m[1]);
  const [y, mes, diaDeCima] = deCima.split("-").map(Number);
  // A lista desce no tempo: dia maior que o de cima é do mês anterior.
  const d = new Date(Date.UTC(y, mes - 1 - (dia > diaDeCima ? 1 : 0), dia, 12));
  return d.getUTCDate() === dia ? iso(d) : null;
}

/** Cara de coluna de data mesmo quando o OCR estragou ("13//0", "1110", "13 our"): sai do nome. */
function pareceData(texto: string): boolean {
  const t = simples(texto);
  return /^[\d/|\\.lo ]{3,7}$/.test(t) && /\d/.test(t) || /^\d{1,2}\s?[a-z01]{3}\.?$/.test(t);
}

/** Valor em real: "R$ 1.249,00", "R$150,00", "- R$ 89,90", "R$ -89,90", "+R$ 20,00", "45,90". */
const VALOR_RE = /([-+−–]\s*)?(?:r\s?[$s5]\s*)?([-+−–]\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+),(\d{2})(?!\d)/i;

/** "R$ 2350": o OCR comeu a vírgula. Com o "R$" na frente, os dois últimos dígitos são os centavos. */
const SEM_VIRGULA_RE = /([-+−–]\s*)?r\s?\$\s*([-+−–]\s*)?(\d{1,3}(?:\.\d{3})*\d{2}|\d{3,7})(?![\d,])/i;

/** "US$", "USD", "EUR", "€", "£" logo antes do número (o OCR às vezes lê o "$" como "S" ou "5"). */
const MOEDA_RE = /(?:^|[^\p{L}\p{N}])([-+−–])?\s*(u\s?s\s?[$s5]|usd|eur|€|£|gbp)\s*([-+−–])?\s*$/iu;

function lerValor(texto: string): { valor: number; sinal: "-" | "+" | null; inicio: number; fim: number; moeda: "USD" | "EUR" | "GBP" | null } | null {
  let m = texto.match(VALOR_RE);
  if (!m) {
    const s = texto.match(SEM_VIRGULA_RE);
    if (s) {
      const digitos = s[3].replace(/\./g, "");
      m = Object.assign([s[0], s[1], s[2], digitos.slice(0, -2), digitos.slice(-2)], { index: s.index, input: texto }) as unknown as RegExpMatchArray;
    }
  }
  if (!m || m.index === undefined) return null;
  const inteiro = m[3].replace(/[.\s]/g, "");
  const valor = Number(`${inteiro}.${m[4]}`);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  let s = (m[1] ?? m[2] ?? "").trim();
  let inicio = m.index;
  // Moeda estrangeira escrita antes do número: o sinal pode estar de cada lado dela ("- US$ 19,00").
  let moeda: "USD" | "EUR" | "GBP" | null = null;
  const mo = texto.slice(0, m.index).match(MOEDA_RE);
  if (mo) {
    const c = mo[2].toLowerCase().replace(/\s/g, "");
    moeda = c === "eur" || c === "€" ? "EUR" : c === "gbp" || c === "£" ? "GBP" : "USD";
    s = s || (mo[1] ?? mo[3] ?? "").trim();
    inicio = m.index - mo[0].length;
  }
  const sinal = s === "+" ? "+" : s ? "-" : null;
  return { valor, sinal, inicio, fim: m.index + m[0].length, moeda };
}

/** "Parcela 2/3", "Parcela 2 de 3", "PARC 02/03", "2/3" sozinho, "02/03" no fim do nome. */
function lerParcela(texto: string, sozinho: boolean): { atual: number; total: number; inicio: number; fim: number } | null {
  const t = texto.trimEnd();
  const comPalavra = t.match(/\b(?:parcela|parc)\.?:?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
  // "Airbnb (4/6)": a parcela entre parênteses no fim do nome (Itaú, C6, Inter).
  const entreParenteses = t.match(/\s*\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)$/);
  const solto = sozinho ? t.match(/^\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})$/i) : t.match(/\s(\d{1,2})\/(\d{1,2})$/);
  const m = comPalavra ?? entreParenteses ?? solto;
  if (!m || m.index === undefined) return null;
  const atual = Number(m[1]);
  const total = Number(m[2]);
  if (!(atual >= 1 && total >= 2 && atual <= total && total <= 48)) return null;
  return { atual, total, inicio: m.index, fim: m.index + m[0].length };
}

/**
 * O que não é compra: o topo da tela (total, limite, vencimento, botões) e o pagamento da fatura
 * anterior. Basta UMA linha do bloco dizer isso.
 */
const TOPO_RE =
  /\b(fatura (atual|aberta|em aberto|fechada|anterior)|total|limite|disponivel|saldo|vencimento|vence em|vence|fecha em|fechamento|melhor dia|pagar fatura|parcelar fatura|antecipar|resumo|lancamentos futuros)\b/;
const PAGAMENTO_RE = /^(pagamento|pagto|pgto)\b|\bpagamento (recebido|efetuado|da fatura|de fatura)\b/;
const CREDITO_RE = /\b(estorno|estornado|reembolso|devolucao|cancelamento|cancelada|credito de|ajuste a credito|cashback)\b/;
/** Linhas de baixo que dizem o tipo, não o nome: "Compra", "Crédito", "Cartão final 4321", "14:32". */
const SUBLINHA_RE = /^(compra|compras|credito|debito|estorno|cartao( virtual)?( final)?\s*\d*|final \d+|\d{1,2}:\d{2}|aprovada|pendente|processando|online|internacional|nacional|presencial|•|·)$/;

type Linha = { segs: Segmento[]; y0: number; y1: number };

/**
 * Respiro máximo entre duas linhas do MESMO item. Nos apps em que o item tem 3 ou 4 linhas (rótulo
 * "Compra no crédito", nome, categoria + valor) o espaço entre as linhas é quase o dobro do que a
 * conta de altura da letra diz, e o nome virava um item sem valor (13/10/2026). O que separa os
 * itens é um pulo bem maior que o espaço de dentro: acha o maior pulo entre os espaços e põe a
 * régua no meio dele; sem pulo claro, vale a régua antiga.
 */
function respiroDoMesmoItem(segs: Segmento[], altura: number): number {
  const antigo = altura * 0.55;
  const faixas: [number, number][] = [];
  for (const s of [...segs].sort((a, b) => a.y0 - b.y0)) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && s.y0 <= ultima[1]) ultima[1] = Math.max(ultima[1], s.y1);
    else faixas.push([s.y0, s.y1]);
  }
  const espacos = faixas
    .slice(1)
    .map((f, i) => f[0] - faixas[i][1])
    .filter((e) => e > 0)
    .sort((a, b) => a - b);
  let melhor: { razao: number; meio: number } | null = null;
  for (let i = 0; i + 1 < espacos.length; i++) {
    const pequeno = Math.max(espacos[i], 1);
    // Espaço pequeno demais é de dentro da linha (acento, letra alta), não de item para item.
    if (pequeno < altura * 0.5) continue;
    const razao = espacos[i + 1] / pequeno;
    if (espacos[i + 1] > altura * 0.9 && razao >= 1.7 && (!melhor || razao > melhor.razao)) melhor = { razao, meio: Math.sqrt(pequeno * espacos[i + 1]) };
  }
  return melhor ? Math.max(antigo, melhor.meio) : antigo;
}

/**
 * Junta os pedaços de um mesmo item da lista: os que se encostam na vertical (o valor centrado
 * entre o nome e a linha de baixo) e a linha de baixo colada no nome ("Parcela 2/3", "Compra").
 * Entre um item e outro o app deixa um respiro bem maior que isso.
 */
function agrupar(segmentos: Segmento[]): Segmento[][] {
  const todos = segmentos.filter((s) => /[\p{L}\p{N}]/u.test(s.texto)).sort((a, b) => a.y0 - b.y0);
  if (todos.length === 0) return [];
  const mediana = todos.map((s) => s.y1 - s.y0).sort((a, b) => a - b)[Math.floor(todos.length / 2)];
  // A letrinha dentro do logo da loja ("O", "&") é muito mais alta que o texto e não é texto.
  const segs = todos.filter((s) => !(s.y1 - s.y0 > mediana * 2.2 && s.texto.trim().length <= 3));
  if (segs.length === 0) return [];
  const altura = mediana;
  const colado = respiroDoMesmoItem(segs, altura);
  const grupos: { segs: Segmento[]; y0: number; y1: number }[] = [];
  for (const s of segs) {
    const g = grupos.find((x) => s.y0 < x.y1 + colado && s.y1 > x.y0 - colado);
    if (g) {
      g.segs.push(s);
      g.y0 = Math.min(g.y0, s.y0);
      g.y1 = Math.max(g.y1, s.y1);
    } else grupos.push({ segs: [s], y0: s.y0, y1: s.y1 });
  }
  // Um pedaço pode ter ligado dois grupos que já existiam: junta de novo até estabilizar.
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < grupos.length && !mudou; i++) {
      for (let j = i + 1; j < grupos.length; j++) {
        if (grupos[i].y0 < grupos[j].y1 + colado && grupos[i].y1 > grupos[j].y0 - colado) {
          grupos[i].segs.push(...grupos[j].segs);
          grupos[i].y0 = Math.min(grupos[i].y0, grupos[j].y0);
          grupos[i].y1 = Math.max(grupos[i].y1, grupos[j].y1);
          grupos.splice(j, 1);
          mudou = true;
          break;
        }
      }
    }
  }
  // Item que começa com o rótulo ("Compra no crédito") e cujo nome ficou num grupo à parte: junta
  // até chegar no valor. Vale para o print de UMA compra só, em que não há espaço entre itens
  // para comparar (respiroDoMesmoItem não acha pulo).
  const ordenados = grupos.sort((a, b) => a.y0 - b.y0);
  const juntos: typeof grupos = [];
  for (const g of ordenados) {
    const ant = juntos[juntos.length - 1];
    const abertoComRotulo = ant && !ant.segs.some((x) => lerValor(x.texto)) && ant.segs.some((x) => ROTULO_RE.test(`${simples(x.texto)} `));
    if (ant && abertoComRotulo && g.y0 - ant.y1 <= altura * 1.6) {
      ant.segs.push(...g.segs);
      ant.y1 = Math.max(ant.y1, g.y1);
    } else juntos.push(g);
  }
  return juntos.map((g) => g.segs);
}

/** Dentro de um grupo: as linhas de texto, de cima para baixo, cada uma da esquerda para a direita. */
function linhasDoGrupo(segs: Segmento[]): Linha[] {
  const linhas: Linha[] = [];
  for (const s of [...segs].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)) {
    const meio = (s.y0 + s.y1) / 2;
    const h = s.y1 - s.y0;
    const l = linhas.find((x) => Math.abs((x.y0 + x.y1) / 2 - meio) < Math.min(h, x.y1 - x.y0) * 0.45);
    if (l) {
      l.segs.push(s);
      l.y0 = Math.min(l.y0, s.y0);
      l.y1 = Math.max(l.y1, s.y1);
    } else linhas.push({ segs: [s], y0: s.y0, y1: s.y1 });
  }
  for (const l of linhas) l.segs.sort((a, b) => a.x0 - b.x0);
  return linhas.sort((a, b) => a.y0 - b.y0);
}

function limparNome(nome: string): string {
  return nome
    .replace(/[|•·]/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}).]+$/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * O rótulo que alguns apps põem NA FRENTE do nome ("Compra no crédito", "Compra no crédito
 * parcelada", "Compra no crédito no cartão adicional de ..."): item de 3 linhas, rótulo / nome /
 * categoria + valor. O que está na linha do valor, à esquerda, é a categoria, não o nome.
 */
const ROTULO_RE = /^compras? (no|na|em|com|de|a) /;
/** Categorias que o app do banco escreve embaixo do nome ("Saúde", "Compras - US", "Outra Categoria"). */
const CATEGORIA_DO_BANCO_RE =
  /^(compras?|saude|viagens?|alimentacao|transporte|cuidados pessoais|cuidado pessoal|outras? categorias?|outros|lazer|educacao|moradia|servicos|assinaturas|restaurantes|mercado|supermercado|casa|pets?|presentes|beleza|vestuario|impostos|investimentos|contas|entretenimento|farmacia)( [-/] [a-z ]{1,12})?$/;

/** Uma compra a partir de um grupo; null quando o grupo não é compra. `dataAtual`: o último cabeçalho (ou a data do item de cima). */
function itemDoGrupo(segs: Segmento[], envio: string, dataAtual: string | null): LinhaDoPrint | "pular" | null {
  const linhas = linhasDoGrupo(segs);
  const textos = linhas.map((l) => simples(l.segs.map((s) => s.texto).join(" ")));
  if (textos.some((t) => TOPO_RE.test(t))) return "pular";

  // Os valores do item. O da compra fica na coluna da direita; o que vem com "US$"/"EUR" é moeda
  // estrangeira: só vira real se o print mostrar o real também (na mesma coluna).
  type Achado = { seg: Segmento; v: NonNullable<ReturnType<typeof lerValor>>; linha: number };
  const achados: Achado[] = [];
  linhas.forEach((l, linha) => {
    for (const seg of l.segs) {
      const v = lerValor(seg.texto);
      if (v) achados.push({ seg, v, linha });
    }
  });
  if (achados.length === 0) return null;
  const maisADireita = (xs: Achado[]) => xs.reduce((a, b) => (b.seg.x1 > a.seg.x1 ? b : a));
  const emReal = achados.filter((x) => !x.v.moeda);
  const emMoeda = achados.filter((x) => x.v.moeda);
  const escolhido = maisADireita(emReal.length > 0 ? emReal : achados);
  const internacional = textos.some((t) => ROTULO_RE.test(t) && /\binternacional\b/.test(t));
  let estrangeira: LinhaDoPrint["estrangeira"] = null;
  if (emMoeda.length > 0) {
    const e = maisADireita(emMoeda);
    estrangeira = { moeda: e.v.moeda, valor: e.v.valor };
  } else if (internacional && !/r\s?[$s5]/i.test(escolhido.seg.texto)) {
    // "Compra no crédito internacional" com número sem "R$": é de fora, só não sabemos a moeda.
    estrangeira = { moeda: null, valor: escolhido.v.valor };
  }
  const valorEmReal = estrangeira && (emReal.length === 0 || estrangeira.valor === escolhido.v.valor) ? 0 : escolhido.v.valor;
  const valor = { ...escolhido.v, valor: valorEmReal };
  const segDoValor = escolhido.seg;

  // Pedaço que é só o valor (sem nome junto) sai do texto do nome.
  const usados = new Set<Segmento>();
  for (const x of achados) {
    const resto = `${x.seg.texto.slice(0, x.v.inicio)} ${x.seg.texto.slice(x.v.fim)}`;
    if (!/\p{L}{2}/u.test(resto)) usados.add(x.seg);
  }

  // Coluna de data à esquerda do nome ("12 OUT", "12/10"): o pedaço mais à esquerda do grupo,
  // quando há texto à direita dele. Estragado pelo OCR, sai do nome e a data vem do item de cima.
  let data: string | null = null;
  const naEsquerda = [...segs].sort((a, b) => a.x0 - b.x0)[0];
  if (naEsquerda !== segDoValor && !usados.has(naEsquerda) && segs.some((s) => s !== naEsquerda && s !== segDoValor && s.x0 > naEsquerda.x1)) {
    const d = lerData(naEsquerda.texto, envio, true);
    data = d ? d.data : soODia(naEsquerda.texto, dataAtual);
    if (d || data || pareceData(naEsquerda.texto)) usados.add(naEsquerda);
  }

  const textoDaLinha = (l: Linha) =>
    l.segs
      .filter((s) => !usados.has(s))
      .map((s) => s.texto)
      .join("  ")
      .trim();

  let parcela: LinhaDoPrint["parcela"] = null;
  let nome = "";
  const iRotulo = textos.findIndex((t) => ROTULO_RE.test(t));
  if (iRotulo >= 0) {
    // Rótulo / nome / categoria + valor: o nome é a linha de cima mais perto do valor, na mesma
    // coluna do rótulo (a letrinha do logo, à esquerda, fica de fora).
    const coluna = linhas[iRotulo].segs[0].x0;
    const candidata = (i: number): string | null => {
      const l = linhas[i];
      if (l.segs[0].x0 < coluna - (l.y1 - l.y0) * 1.5) return null;
      let texto = textoDaLinha(l);
      const p = lerParcela(texto, false);
      if (p) texto = `${texto.slice(0, p.inicio)} ${texto.slice(p.fim)}`.trim();
      const n = limparNome(texto);
      const s = simples(n);
      if ((n.match(/\p{L}/gu) ?? []).length < 2 || SUBLINHA_RE.test(s) || CATEGORIA_DO_BANCO_RE.test(s) || ROTULO_RE.test(s)) return null;
      if (p && !parcela) parcela = { atual: p.atual, total: p.total };
      return n;
    };
    for (let i = escolhido.linha - 1; i > iRotulo && !nome; i--) nome = candidata(i) ?? "";
    // Sem linha de cima: o nome veio junto do valor ("Padaria   - R$ 12,00"), se não for categoria.
    if (!nome && escolhido.linha > iRotulo) nome = candidata(escolhido.linha) ?? "";
  } else {
    for (const l of linhas) {
      let texto = textoDaLinha(l);
      // O valor sai do texto (veio num pedaço só dele ou grudado no nome: "Padaria R$ 23,50").
      const v = lerValor(texto);
      if (v && v.valor === escolhido.v.valor) texto = `${texto.slice(0, v.inicio)} ${texto.slice(v.fim)}`.trim();
      if (!texto) continue;
      // Data no começo da linha ("12/10 PADARIA") quando a coluna não veio separada.
      if (!nome) {
        const d = lerData(texto, envio, false);
        if (d && /\p{L}/u.test(d.resto)) {
          data ??= d.data;
          texto = d.resto;
        } else {
          const lixo = texto.match(/^(\S+)\s+(?=\p{L})/u);
          if (lixo && pareceData(lixo[1])) texto = texto.slice(lixo[0].length);
        }
      }
      // "2/3" sozinho só vale numa linha de baixo (a de cima é o nome).
      const p = lerParcela(texto, nome !== "");
      if (p && !parcela) {
        parcela = { atual: p.atual, total: p.total };
        texto = `${texto.slice(0, p.inicio)} ${texto.slice(p.fim)}`.trim();
      }
      if (!nome) {
        const n = limparNome(texto);
        // A linha de cima pode ser só uma data solta ou ruído: o nome é a primeira com letras.
        if ((n.match(/\p{L}/gu) ?? []).length >= 2 && !SUBLINHA_RE.test(simples(n))) nome = n;
      }
    }
  }
  // "Parcela 2/3" numa linha de baixo, quando o nome não a trouxe.
  if (nome && !parcela && iRotulo >= 0) {
    for (const l of linhas) {
      const p = lerParcela(textoDaLinha(l), true);
      if (p) {
        parcela = { atual: p.atual, total: p.total };
        break;
      }
    }
  }
  if (!nome) return null;
  if (PAGAMENTO_RE.test(simples(nome))) return "pular";
  return {
    data: data ?? dataAtual,
    nome,
    valor: valor.valor,
    sinal: valor.sinal,
    credito: CREDITO_RE.test(textos.join(" ")),
    parcela,
    ...(estrangeira ? { estrangeira } : {}),
  };
}

/** O que um print deu: as compras e o cabeçalho de data que ficou no pé, sem compra embaixo. */
export type PrintLido = {
  linhas: LinhaDoPrint[];
  cabecalhoNoFim: string | null;
  /** O "Compras e despesas, Total R$ 6.179,58" que o resumo da fatura mostra no topo, quando está no print. */
  totalDaFatura?: number | null;
};

/** O total de compras que o resumo da fatura imprime ("Compras e despesas / Total R$ 6.179,58"). */
function totalDoResumo(grupo: Segmento[]): number | null {
  const linhas = linhasDoGrupo(grupo).map((l) => l.segs.map((s) => s.texto).join(" "));
  const i = linhas.findIndex((t) => /\bcompras e despesas\b/.test(simples(t)));
  if (i < 0) return null;
  // O valor vem na mesma linha ("Compras e despesas Total R$ ...") ou na de baixo ("Total R$ ...").
  for (const t of [linhas[i], linhas[i + 1]]) {
    if (!t || !/\btotal\b/.test(simples(t))) continue;
    const v = lerValor(t);
    if (v && !v.moeda) return v.valor;
  }
  return null;
}

/**
 * Lê as compras de UM print. `envio`: o dia em que a pessoa mandou ("AAAA-MM-DD", no fuso dela),
 * que resolve "Hoje", "Ontem" e o dia da semana.
 */
export function lerPrint(segmentos: Segmento[], envio: string): PrintLido {
  const linhas: LinhaDoPrint[] = [];
  let cabecalho: string | null = null;
  let cabecalhoNoFim: string | null = null;
  let totalDaFatura: number | null = null;
  for (const grupo of agrupar(segmentos)) {
    totalDaFatura ??= totalDoResumo(grupo);
    const texto = linhasDoGrupo(grupo)
      .map((l) => l.segs.map((s) => s.texto).join(" "))
      .join(" ");
    // Cabeçalho de data ("Hoje", "SEX, 09 OUT", "12/10/2026"): sem valor, só a data.
    if (!lerValor(texto)) {
      const d = lerData(texto, envio, true);
      if (d) cabecalho = cabecalhoNoFim = d.data;
      continue;
    }
    // Sem cabeçalho, a data que falhou na leitura vem da compra de cima (a lista é por data).
    const deCima = cabecalho ?? linhas[linhas.length - 1]?.data ?? null;
    const item = itemDoGrupo(grupo, envio, deCima);
    if (item === "pular") continue;
    if (item) {
      linhas.push(item);
      cabecalhoNoFim = null;
    }
  }
  return { linhas, cabecalhoNoFim, totalDaFatura };
}

/** Dois itens de prints vizinhos são a MESMA linha da tela? Valor igual, nome parecido, data compatível. */
function mesmaLinha(a: LinhaDoPrint, b: LinhaDoPrint): boolean {
  if (Math.abs(a.valor - b.valor) > 0.001) return false;
  if ((a.estrangeira?.valor ?? 0) !== (b.estrangeira?.valor ?? 0)) return false;
  if (a.data && b.data && a.data !== b.data) return false;
  const na = semAcentoNemPontuacao(a.nome).replace(/\s/g, "");
  const nb = semAcentoNemPontuacao(b.nome).replace(/\s/g, "");
  return na === nb || nomeParecido(a.nome, b.nome) || semelhanca(na, nb) >= 0.7;
}

/** 0 a 1: quanto dois textos se parecem (o OCR troca uma letra aqui e ali entre um print e outro). */
export function semelhanca(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    anterior = atual;
  }
  return 1 - anterior[n] / Math.max(m, n);
}

/**
 * Quantas linhas do começo de `novo` repetem o fim de `lista` (a parte que aparece nos dois
 * prints). A maior sobreposição ganha. Tolera UM tropeço do OCR no meio de uma sobreposição de 3
 * ou mais: uma linha que um dos prints não leu, ou leu errado.
 */
function sobreposicao(lista: LinhaDoPrint[], novo: LinhaDoPrint[]): number {
  for (let j = Math.max(0, lista.length - 15); j < lista.length; j++) {
    const n = lista.length - j;
    if (!mesmaLinha(lista[j], novo[0])) continue;
    let i = j;
    let k = 0;
    let tropecos = 0;
    while (i < lista.length && k < novo.length && tropecos <= 1) {
      if (mesmaLinha(lista[i], novo[k])) {
        i++;
        k++;
      } else if (i + 1 < lista.length && mesmaLinha(lista[i + 1], novo[k])) {
        i++; // o print novo não leu esta linha
        tropecos++;
      } else if (k + 1 < novo.length && mesmaLinha(lista[i], novo[k + 1])) {
        k++; // o print novo leu uma linha a mais (ruído)
        tropecos++;
      } else {
        i++;
        k++;
        tropecos++;
      }
    }
    if (i === lista.length && tropecos <= (n >= 3 ? 1 : 0) && mesmaLinha(lista[i - 1], novo[k - 1])) return k;
  }
  return 0;
}

/**
 * Junta vários prints da MESMA fatura numa lista só, na ordem em que foram tirados (rolando para
 * baixo). O pedaço que aparece no fim de um print e no começo do próximo entra uma vez só; duas
 * compras iguais de verdade (dois cafés no mesmo dia) continuam duas, porque só sai a sobreposição
 * contínua entre o fim de um e o começo do outro, não "toda linha repetida".
 */
export function juntarPrints(prints: PrintLido[]): LinhaDoPrint[] {
  let lista: LinhaDoPrint[] = [];
  let noFim: string | null = null;
  for (const print of ordenarPelaSobreposicao(prints)) {
    const novo = print.linhas;
    if (novo.length === 0) {
      noFim = print.cabecalhoNoFim ?? noFim;
      continue;
    }
    const corte = sobreposicao(lista, novo);
    // O começo do print sem cabeçalho de data: a data do cabeçalho que ficou no pé do anterior,
    // ou a da última compra dele.
    let herdada = noFim ?? lista[lista.length - 1]?.data ?? null;
    const resto = novo.slice(corte).map((l) => {
      if (l.data) {
        herdada = l.data;
        return l;
      }
      return { ...l, data: herdada };
    });
    lista = [...lista, ...resto];
    noFim = print.cabecalhoNoFim;
  }
  return lista;
}

/**
 * Os prints nem sempre chegam na ordem da tela (a seleção da galeria vem do mais novo para o mais
 * velho, ou embaralhada): um que continua o outro por cima ou por baixo vai para o lado certo,
 * senão a parte repetida entre eles contava duas vezes. Quem não se encosta em nenhum fica onde
 * a pessoa mandou.
 */
function ordenarPelaSobreposicao(prints: PrintLido[]): PrintLido[] {
  const cadeia: PrintLido[] = [];
  for (const p of prints) {
    if (p.linhas.length === 0 || cadeia.length === 0) {
      cadeia.push(p);
      continue;
    }
    // Melhor encaixe: o de mais linhas repetidas. Depois de `k` (p continua k) ou antes de `k` (k continua p).
    let posicao = -1;
    let repetidas = 0;
    let jaEstaInteiro = false;
    cadeia.forEach((c, k) => {
      if (c.linhas.length === 0) return;
      const depois = sobreposicao(c.linhas, p.linhas);
      if (depois > repetidas) [posicao, repetidas] = [k + 1, depois];
      const antes = sobreposicao(p.linhas, c.linhas);
      if (antes > repetidas) [posicao, repetidas] = [k, antes];
      // O mesmo print mandado duas vezes (ou um pedaço que já está inteiro em outro).
      if (p.linhas.length >= 2 && (depois === p.linhas.length || antes === p.linhas.length)) jaEstaInteiro = true;
    });
    if (jaEstaInteiro) continue;
    cadeia.splice(posicao >= 0 ? posicao : cadeia.length, 0, p);
  }
  return cadeia;
}

/**
 * As linhas juntas viram compras da fatura: compra positiva, estorno negativo, parcela escrita
 * do jeito que o resto do app entende ("Loja - Parcela 2/3"). O sinal da tela só diz o que é
 * crédito quando é a minoria: tem app que escreve TODA compra com "-".
 */
export function comprasDosPrints(linhas: LinhaDoPrint[], envio: string): CompraDoPrint[] {
  const comMenos = linhas.filter((l) => l.sinal === "-").length;
  const menosEhCompra = comMenos > linhas.length / 2;
  return linhas.flatMap((l) => {
    // Dólar sem o real na tela: nunca vira "R$ 19,00". Fica fora e a tela pede o valor (semValorEmReal).
    if (l.valor <= 0) return [];
    const credito = l.credito || l.sinal === "+" || (l.sinal === "-" && !menosEhCompra);
    const description = l.parcela ? `${l.nome} - Parcela ${l.parcela.atual}/${l.parcela.total}` : l.nome;
    return [{ date: l.data ?? envio, description, amount: credito ? -l.valor : l.valor }];
  });
}

/** Compra em moeda estrangeira que o print não mostra em real: avisada, não gravada. */
export type CompraSemValorEmReal = { nome: string; data: string; texto: string };

export function semValorEmReal(linhas: LinhaDoPrint[], envio: string): CompraSemValorEmReal[] {
  return linhas.flatMap((l) => {
    if (!l.estrangeira || l.valor > 0) return [];
    const { moeda, valor } = l.estrangeira;
    const numero = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const simbolo = moeda === "USD" ? "US$" : moeda === "EUR" ? "€" : moeda === "GBP" ? "£" : "";
    return [{ nome: l.parcela ? `${l.nome} - Parcela ${l.parcela.atual}/${l.parcela.total}` : l.nome, data: l.data ?? envio, texto: `${simbolo} ${numero}`.trim() }];
  });
}

/** O banco, quando o print escreve o nome dele (raro: a lista quase nunca diz). */
export function bancoDoPrint(textos: string[]): string | null {
  const t = simples(textos.join(" "));
  const bancos: [RegExp, string][] = [
    [/\bnubank\b|\bnu pagamentos\b/, "Nubank"],
    [/\bitau\b|\bitaucard\b/, "Itaú"],
    [/\binter\b/, "Inter"],
    [/\bc6\b/, "C6"],
    [/\bbtg\b/, "BTG"],
    [/\bsantander\b/, "Santander"],
    [/\bbradesco\b/, "Bradesco"],
    [/\bxp\b/, "XP"],
  ];
  return bancos.find(([re]) => re.test(t))?.[1] ?? null;
}

/** Para conferir a leitura: o texto de cada grupo, linha a linha (" | " separa os pedaços). */
export function gruposDoPrint(segmentos: Segmento[]): string[] {
  return agrupar(segmentos).map((g) =>
    linhasDoGrupo(g)
      .map((l) => l.segs.map((s) => s.texto).join(" | "))
      .join(" / "),
  );
}
