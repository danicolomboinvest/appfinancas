import { parseQuantityInput } from "@/lib/portfolio/asset-form-values";
import { textoDoRendimento, type Rendimento } from "@/lib/portfolio/estimativa-renda-fixa";

/**
 * A parte sem tela do Novo ativo (NovoAtivo.tsx): a busca local (Tesouro e renda fixa), a leitura
 * das cotas e o formulário que vai para o createAssetAction. Fica separada para ser testada.
 */

export type TituloParaBusca = { nome: string; tipo: string; preco: number; taxa: number | null; fonte: string; quando: string; velho: boolean };

export type Achado =
  | { k: "tesouro"; nome: string; sub: string; titulo: TituloParaBusca | null }
  | { k: "rf"; nome: string; sub: string }
  | { k: "bolsa"; nome: string; sub: string; ticker: string; classe: "ACAO" | "FII" | "INTERNACIONAL" }
  | { k: "ext"; nome: string; sub: string; ticker: string }
  | { k: "fundo"; nome: string; sub: string };

const PRODUTOS = ["CDB", "LCI", "LCA", "Caixinha", "RDB", "Poupança"];
const BANCOS = ["Nubank", "Banco Inter", "Itaú", "Banco do Brasil", "Caixa", "Bradesco", "Santander", "C6 Bank", "Mercado Pago", "PicPay", "XP", "BTG Pactual", "PagBank", "Sicredi", "Sicoob", "EQI"];
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Os tipos de título do Tesouro, sem preço nem taxa: entram na busca quando a lista do dia (lida
 * do site do Tesouro) não está gravada ou não achou nada. Sem isso, quem tocava em "Tesouro
 * Direto" com a fonte fora do ar só via ETFs e não tinha como cadastrar o título (14/10/2026).
 */
const TIPOS_DO_TESOURO = ["Tesouro Selic", "Tesouro IPCA+", "Tesouro IPCA+ com juros", "Tesouro Prefixado", "Tesouro Prefixado com juros", "Tesouro Renda+", "Tesouro Educa+"];

export function taxaDoTitulo(t: TituloParaBusca): string {
  if (t.taxa === null) return "";
  const n = t.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (/Selic/.test(t.tipo)) return `Selic + ${n}%`;
  if (/IPCA|Renda\+|Educa\+/.test(t.tipo)) return `IPCA + ${n}%`;
  return `${n}% ao ano`;
}

/** O que a busca acha sem ir ao servidor: títulos do Tesouro, CDB/caixinha de banco e fundo. */
export function buscarLocal(q: string, titulos: TituloParaBusca[]): Achado[] {
  const t = semAcento(q.trim());
  if (!t) return [];
  const palavras = t.split(/\s+/);
  const r: Achado[] = [];
  for (const ti of titulos) {
    const alvo = semAcento(`tesouro direto ${ti.nome} ${ti.tipo}`);
    if (palavras.every((w) => alvo.includes(w)) || (t === "pre" && /prefixado/i.test(ti.tipo))) {
      r.push({ k: "tesouro", nome: ti.nome, sub: ti.taxa !== null ? `${taxaDoTitulo(ti)} hoje` : "Tesouro Direto", titulo: ti });
    }
  }
  if (r.length === 0) {
    for (const tipo of TIPOS_DO_TESOURO) {
      const alvo = semAcento(`tesouro direto ${tipo}`);
      if (palavras.every((w) => alvo.includes(w)) || (t === "pre" && /prefixado/i.test(tipo))) r.push({ k: "tesouro", nome: tipo, sub: "Tesouro Direto", titulo: null });
    }
  }
  const produtos = PRODUTOS.filter((p) => palavras.some((w) => semAcento(p).startsWith(w)));
  const bancos = BANCOS.filter((b) => palavras.some((w) => w.length >= 2 && semAcento(b).split(" ").some((x) => x.startsWith(w) && !["banco", "do", "bank"].includes(x))));
  const combos = (produtos.length ? produtos : bancos.length ? ["CDB", "Caixinha"] : []).flatMap((p) => (bancos.length ? bancos.slice(0, 3).map((b) => `${p} ${b}`) : [p]));
  for (const c of combos) r.push({ k: "rf", nome: c, sub: "Renda fixa" });
  if (/fundo|fic|fia|multi/.test(t)) r.push({ k: "fundo", nome: nomeDoFundo(q), sub: "Fundo de investimento" });
  return r;
}

/** "fundo verde" vira "Fundo verde": é o nome que fica na carteira dela. */
export function nomeDoFundo(q: string): string {
  return q.trim().replace(/^\p{L}/u, (x) => x.toUpperCase());
}

/**
 * Cotas digitadas: o mesmo leitor do formulário de sempre (parseQuantityInput). "1.000" são mil
 * cotas; antes o Novo ativo lia 1 e salvava a posição mil vezes menor, sem erro nenhum.
 */
export function lerCotas(texto: string): number {
  const n = parseQuantityInput(texto);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Números soltos (taxa, quantidade de títulos): "6,5" e "6.5" são seis e meio. */
export function lerNumero(s: string): number {
  const limpo = s.replace(/[^\d,.]/g, "");
  const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(n) ? n : 0;
}

export const CLASSES_DE_FUNDO = [
  ["rf", "Fundo de renda fixa", "pos", "brasil"],
  ["acoes", "Fundo de ações", "acoes", "brasil"],
  ["mm", "Fundo multimercado", "multimercado", "brasil"],
  ["ext", "Fundo de investimento no exterior", "acoes", "exterior"],
  ["fii", "Fundo imobiliário", "fiis", "brasil"],
] as const;

const c2 = (v: number) => Math.round(v * 100) / 100;

/**
 * O formulário que o Novo ativo manda para o createAssetAction. Os valores em dinheiro já chegam
 * em reais (1234.56), do CampoDeDinheiro; a quantidade vai com vírgula decimal, que é como o
 * servidor lê (parseQuantityInput: "1.000" seria mil).
 */
export function formularioDoNovoAtivo(e: {
  x: Achado;
  investido: number;
  valorHoje: number;
  qtd: number;
  precoMedio: number;
  /** Cotação de hoje, na moeda do ativo; null se a fonte não respondeu. */
  cotacao: number | null;
  rendimento: Rendimento | null;
  naoSei: boolean;
  fundo: string | null;
  meta: string | null;
  qtdTitulos: number;
  modoHoje: "valor" | "titulos";
  taxaTxt: string;
  taxaNaoSei: boolean;
  quando: { ano: number; mes: number } | null;
}): FormData {
  const { x, rendimento } = e;
  const fd = new FormData();
  const ehBolsa = x.k === "bolsa" || x.k === "ext";
  fd.set("name", ehBolsa ? x.ticker : x.k === "rf" && rendimento && !e.naoSei ? `${x.nome} ${textoDoRendimento(rendimento)}` : x.nome);
  if (ehBolsa) fd.set("ticker", x.ticker);
  fd.set("assetClass", x.k === "tesouro" ? "TESOURO_DIRETO" : x.k === "rf" ? "RENDA_FIXA" : x.k === "bolsa" ? x.classe : x.k === "ext" ? "INTERNACIONAL" : "FUNDO");
  if (x.k === "tesouro") fd.set("fixedIncomeIndex", /IPCA|Renda\+|Educa\+/.test(x.titulo?.tipo ?? x.nome) ? "IPCA" : /Prefixado/i.test(x.titulo?.tipo ?? x.nome) ? "PREFIXADO" : "POS_FIXADO");
  if (x.k === "rf" && rendimento) fd.set("fixedIncomeIndex", rendimento.indexador === "ipca" ? "IPCA" : rendimento.indexador === "pre" ? "PREFIXADO" : "POS_FIXADO");
  if (x.k === "fundo" && e.fundo) {
    const c = CLASSES_DE_FUNDO.find((f) => f[0] === e.fundo);
    if (c) {
      fd.set("tipoEscolhido", c[2]);
      fd.set("ondeEscolhido", c[3]);
    }
  }
  if (e.meta?.startsWith("meta:")) {
    fd.set("objective", "META");
    fd.set("goalId", e.meta.slice(5));
  } else fd.set("objective", e.meta === "reserva" ? "RESERVA_EMERGENCIA" : e.meta === "liberdade" ? "LIBERDADE_FINANCEIRA" : "OUTRO");
  if (ehBolsa) {
    if (x.k === "ext") fd.set("assetCurrency", "USD");
    fd.set("quantity", String(e.qtd).replace(".", ","));
    fd.set("investedValue", String(c2(e.qtd * e.precoMedio)));
    if (x.k === "ext") {
      if (e.cotacao) fd.set("currentValue", String(c2(e.qtd * e.cotacao)));
    } else fd.set("currentValue", String(c2(e.valorHoje)));
  } else {
    fd.set("investedValue", String(c2(e.investido)));
    fd.set("currentValue", String(c2(e.valorHoje > 0 ? e.valorHoje : e.investido)));
    if (x.k === "tesouro" && e.modoHoje === "titulos" && e.qtdTitulos > 0) fd.set("quantity", String(e.qtdTitulos).replace(".", ","));
  }
  // A taxa em que ela comprou (Asset.taxaCompra): no CDB, a da pergunta "Quanto rende?"; no
  // Tesouro, a da pergunta "Qual taxa você comprou?". "Não sei" não grava nada.
  if (x.k === "rf" && rendimento && !e.naoSei) fd.set("taxaCompra", String(rendimento.indexador === "cdi" ? rendimento.percentual : rendimento.taxa).replace(".", ","));
  if (x.k === "tesouro" && !e.taxaNaoSei && lerNumero(e.taxaTxt) > 0) fd.set("taxaCompra", e.taxaTxt);
  if (e.quando) fd.set("acquisitionDate", `${e.quando.ano}-${String(e.quando.mes).padStart(2, "0")}-01`);
  return fd;
}
