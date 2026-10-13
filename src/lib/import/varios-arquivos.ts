import { chaveDeIguais } from "./revisao-em-grupo";

/**
 * Vários arquivos de uma vez (caminho B da entrada da importação, 12/10/2026): o resumo de cada
 * arquivo na lista, as respostas que passam de um arquivo para o próximo e a faixa dos meses (C).
 * Funções puras, para dar para testar sem tela.
 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1] ?? ym;

/** "junho e julho", "junho, julho e agosto", "março a agosto". */
export function listaDeMesesCurta(meses: string[]): string {
  const m = [...new Set(meses)].sort();
  if (m.length === 0) return "";
  if (m.length === 1) return nomeDoMes(m[0]);
  if (m.length <= 3) return `${m.slice(0, -1).map(nomeDoMes).join(", ")} e ${nomeDoMes(m[m.length - 1])}`;
  return `${nomeDoMes(m[0])} a ${nomeDoMes(m[m.length - 1])}`;
}

type StatsMinimas = { banco?: string | null; vencimento?: string | null; compras?: number; mesesDasCompras?: string[]; faturaAberta?: boolean };
type LinhaMinima = { date: string; category: string; ignorar?: boolean };

/** "Fatura Nubank" + "vence 17/07", "64 compras", "junho e julho". */
export function resumoDoArquivo(docType: "extrato" | "fatura", stats: StatsMinimas | null | undefined, linhas: LinhaMinima[]): { titulo: string; chips: string[] } {
  const tipo = docType === "fatura" ? (stats?.faturaAberta ? "Fatura aberta" : "Fatura") : "Extrato";
  const titulo = stats?.banco ? `${tipo} ${stats.banco}` : tipo;
  const valendo = linhas.filter((l) => !l.ignorar);
  // Prints da fatura aberta: só quantas compras até hoje (ainda não tem vencimento nem fecha o mês).
  if (stats?.faturaAberta) {
    const n = stats.compras ?? valendo.filter((l) => l.category === "EXPENSE").length;
    return { titulo, chips: [`${n} ${n === 1 ? "compra" : "compras"} até hoje`] };
  }
  const chips: string[] = [];
  if (docType === "fatura" && stats?.vencimento) chips.push(`vence ${stats.vencimento.slice(8, 10)}/${stats.vencimento.slice(5, 7)}`);
  const n = docType === "fatura" ? (stats?.compras ?? valendo.filter((l) => l.category === "EXPENSE").length) : valendo.length;
  chips.push(docType === "fatura" ? `${n} ${n === 1 ? "compra" : "compras"}` : `${n} ${n === 1 ? "lançamento" : "lançamentos"}`);
  const meses = docType === "fatura" && stats?.mesesDasCompras?.length ? stats.mesesDasCompras : valendo.map((l) => l.date.slice(0, 7));
  const textoMeses = listaDeMesesCurta(meses);
  if (textoMeses) chips.push(textoMeses);
  return { titulo, chips };
}

type LinhaComCategoria = {
  description: string;
  category: string;
  parentCategory: string | null;
  customCategoryId: string | null;
  autoClassified: boolean;
  estorno?: boolean;
  ignorar?: boolean;
  duvida?: string | null;
};

/**
 * As respostas que ela deu num arquivo valem para os próximos do mesmo envio: a mesma loja (mesma
 * chave de iguais) que ainda está sem categoria ganha a categoria que ela escolheu, como regra dela.
 */
export function levarRespostas<T extends LinhaComCategoria>(respondidas: LinhaComCategoria[], destino: T[]): { linhas: T[]; levadas: number } {
  const escolhas = new Map<string, { parentCategory: string | null; customCategoryId: string | null }>();
  for (const l of respondidas) {
    if (l.autoClassified || l.category !== "EXPENSE" || (!l.parentCategory && !l.customCategoryId)) continue;
    const chave = chaveDeIguais(l.description);
    if (chave) escolhas.set(chave, { parentCategory: l.parentCategory, customCategoryId: l.customCategoryId });
  }
  let levadas = 0;
  const linhas = destino.map((l) => {
    if (l.category !== "EXPENSE" || l.estorno || l.ignorar || l.duvida || l.parentCategory || l.customCategoryId) return l;
    const chave = chaveDeIguais(l.description);
    const e = chave ? escolhas.get(chave) : undefined;
    if (!e) return l;
    levadas++;
    return { ...l, ...e, autoClassified: true, motivo: "regra_sua", confianca: "alta" };
  });
  return { linhas, levadas };
}

/**
 * A faixa dos últimos 12 meses (C): quais já estão no app, quais os arquivos acabaram de trazer, e
 * os buracos entre o primeiro mês com dado e o mês de agora ("Faltam: março e abril").
 */
export function faixaDosMeses(noApp: string[], lidos: string[], agora: Date): { meses: { ym: string; rotulo: string; estado: "tem" | "novo" | "falta" }[]; faltam: string[] } {
  const tem = new Set(noApp);
  const novos = new Set(lidos);
  const meses: { ym: string; rotulo: string; estado: "tem" | "novo" | "falta" }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses.push({ ym, rotulo: nomeDoMes(ym).slice(0, 3), estado: tem.has(ym) ? "tem" : novos.has(ym) ? "novo" : "falta" });
  }
  const primeiro = meses.findIndex((m) => m.estado !== "falta");
  const faltam = primeiro < 0 ? [] : meses.slice(primeiro).filter((m) => m.estado === "falta").map((m) => nomeDoMes(m.ym));
  return { meses, faltam };
}
