import { formatMoney } from "@/lib/money";
import { MESES_CURTOS, TAXA_PADRAO_DAS_METAS, porMesDaNovaMeta } from "@/lib/metas/projecao";
import { prazoQueCabe } from "@/lib/metas/prazo-que-cabe";
import type { Alternativas, Coisinha, EntradaDoPlano, FonteDoAporte, PlanoDaMeta, TipoDaCoisinha } from "./plano-da-meta";

/**
 * A parte do plano da meta que a TELA usa enquanto ela mexe (a régua, a quantidade, as saídas e a
 * frase). Fica separada do motor (plano-da-meta.ts) porque o motor puxa o classificador de
 * lançamentos, que não precisa ir para o celular. Puro, sem banco.
 */

const reais = (v: number) => Math.round(v * 100) / 100;
const baixo10 = (v: number) => Math.floor(v / 10) * 10;

/** A metade, arredondada para cima de R$ 10 em R$ 10. */
export const metadeArredondada = (v: number) => Math.ceil(v / 2 / 10) * 10;

/* ---------------------------------------------------------------- a régua e a quantidade */

/**
 * A régua de cada coisinha (pedido da Dani, 16/10/2026: "tivesse uma coisinha para eu arrastar
 * quanto que eu quero gastar"): do gasto de hoje até R$ 0, de R$ 10 em R$ 10, com o valor de hoje
 * na ponta mesmo quando não é redondo (155: 0, 10, ..., 150, 155). Começa na sugestão (`para`).
 */
export function passosDaRegua(hoje: number): number[] {
  const out: number[] = [];
  for (let v = 0; v < hoje - 1e-9; v += 10) out.push(v);
  out.push(reais(hoje));
  return out;
}

/** Quanto ela economiza por mês gastando `valor` nessa coisinha. */
export const economiaPara = (c: Pick<Coisinha, "hoje">, valor: number) => reais(Math.max(0, c.hoje - valor));

const UNIDADES: Record<Exclude<TipoDaCoisinha, "assinatura">, { um: string; varios: string; feminino: boolean }> = {
  delivery: { um: "pedido", varios: "pedidos", feminino: false },
  corrida: { um: "corrida", varios: "corridas", feminino: true },
  lazer: { um: "vez", varios: "vezes", feminino: true },
  compras: { um: "vez", varios: "vezes", feminino: true },
};
const unidadeDe = (c: Pick<Coisinha, "tipo">) => (c.tipo === "assinatura" ? null : UNIDADES[c.tipo]);

/** Quantos pedidos (corridas, vezes) cabem em `valor` pelo ticket dela; null sem ticket. */
export function quantidadePara(c: Pick<Coisinha, "ticket">, valor: number): number | null {
  if (!c.ticket || !(c.ticket > 0)) return null;
  return Math.max(0, valor) / c.ticket;
}

/**
 * O valor da régua em palavras: "dá uns 4 pedidos por mês", "dá 1 corrida por mês", "menos de 1
 * pedido por mês", "nenhum pedido" e, no valor de hoje, "do jeito que está". Null na assinatura.
 */
export function textoDaQuantidade(c: Pick<Coisinha, "tipo" | "hoje" | "ticket">, valor: number): string | null {
  const u = unidadeDe(c);
  if (!u) return null;
  if (valor >= c.hoje - 1e-9) return "do jeito que está";
  if (valor <= 0) return `${u.feminino ? "nenhuma" : "nenhum"} ${u.um}`;
  const q = quantidadePara(c, valor);
  if (q === null) return null;
  if (q < 1) return `menos de 1 ${u.um} por mês`;
  const n = Math.round(q);
  if (n === 1) return `dá 1 ${u.um} por mês`;
  return `dá ${u.feminino ? "umas" : "uns"} ${n} ${u.varios} por mês`;
}

/** Quantos são hoje: "hoje: 8 pedidos por mês". */
export function textoDeHoje(c: Pick<Coisinha, "tipo" | "vezesPorMes">): string | null {
  const u = unidadeDe(c);
  if (!u) return null;
  const n = Math.max(1, c.vezesPorMes);
  return `hoje: ${n} ${n === 1 ? u.um : u.varios} por mês`;
}

/** O ticket arredondado para falar: até R$ 20 de 1 em 1, até R$ 100 de 5 em 5, depois de 10 em 10. */
export function ticketArredondado(t: number): number {
  return t < 20 ? Math.max(1, Math.round(t)) : t < 100 ? Math.round(t / 5) * 5 : Math.round(t / 10) * 10;
}

/** "o seu custa uns R$ 50" (pedido), "a sua custa uns R$ 17" (corrida), "cada vez custa uns R$ 80". */
export function textoDoTicket(c: Pick<Coisinha, "tipo" | "ticket">): string | null {
  if (!c.ticket || c.tipo === "assinatura") return null;
  const v = dinheiro(ticketArredondado(c.ticket));
  if (c.tipo === "delivery") return `o seu custa uns ${v}`;
  if (c.tipo === "corrida") return `a sua custa uns ${v}`;
  return `cada vez custa uns ${v}`;
}

/* ---------------------------------------------------------------- as alternativas */

export const textoDoPrazo = (d: Date) => `${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}`;

/**
 * Quando não fecha, guardando `disponivel` por mês: chegar mais tarde, ou uma meta menor no mesmo
 * prazo. Cada uma some quando passa do limite (LIMITES_DAS_ALTERNATIVAS).
 */
export function alternativasPara(meta: EntradaDoPlano["meta"], disponivel: number, hoje: Date): Alternativas {
  const taxa = meta.taxaAnual ?? TAXA_PADRAO_DAS_METAS;
  if (!(disponivel > 0) || !meta.prazo) return { prazo: null, metaMenor: null, oQueDa: null };
  // Decisão da Dani (16/10/2026): "Aumenta o prazo, sempre, se precisar." O prazo que cabe aparece
  // sempre que houver algum valor por mês, mesmo longe (só não existe depois de 2080).
  const p = prazoQueCabe({ alvo: meta.alvo, guardado: meta.guardado, porMes: disponivel, taxaAnual: taxa, hoje });
  const prazo: Alternativas["prazo"] = p ? { ...p, porMes: porMesDaNovaMeta(meta.alvo, new Date(p.ano, p.mes - 1, 1, 12), hoje, taxa, meta.guardado) } : null;
  // Meta menor: o maior alvo, de R$ 100 em R$ 100, que cabe no prazo dela com o disponível.
  const cabe = (alvo: number) => porMesDaNovaMeta(alvo, meta.prazo as Date, hoje, taxa, meta.guardado) <= disponivel;
  let lo = Math.ceil(meta.guardado / 100) * 100;
  let hi = Math.floor(meta.alvo / 100) * 100;
  let melhor: number | null = null;
  while (lo <= hi) {
    const meio = Math.floor((lo + hi) / 200) * 100;
    if (cabe(meio)) {
      melhor = meio;
      lo = meio + 100;
    } else hi = meio - 100;
  }
  const metaMenor: Alternativas["metaMenor"] =
    melhor !== null && melhor < meta.alvo && melhor > meta.guardado && melhor >= LIMITES_DAS_ALTERNATIVAS.metaMenorEmReais
      ? { alvo: melhor, porMes: porMesDaNovaMeta(melhor, meta.prazo, hoje, taxa, meta.guardado) }
      : null;
  // "Guardar o que dá" só quando nem o prazo existe (a meta não chega até 2080 com esse valor).
  const oQueDa = !prazo && baixo10(disponivel) > 0 ? baixo10(disponivel) : null;
  return { prazo, metaMenor, oQueDa };
}

export const LIMITES_DAS_ALTERNATIVAS = {
  /** Meta menor só a partir de R$ 100 (decisão da Dani, 16/10/2026: sem outro limite). */
  metaMenorEmReais: 100,
} as const;

/* ---------------------------------------------------------------- a frase */

/** O dinheiro da frase: o formatador do app (o plano só aparece em real), sem centavo quando é redondo. */
const dinheiro = (v: number) => formatMoney(v, "BRL", { round: Number.isInteger(Math.round(v * 100) / 100) });

/**
 * A frase do topo do plano, sem conta armada (pedido da Dani, 16/10/2026: "R$ 400 menos R$ 0"
 * ficou estranho). Uma frase só, com o número do que falta.
 */
export function fraseDoPlano(p: PlanoDaMeta): string | null {
  if (!p.mostra) return null;
  switch (p.situacao) {
    case "ja_cabe":
      return `O que sobra hoje já paga essa meta até ${p.prazoTexto}.`;
    case "sem_prazo":
      return p.semPrazo?.comSobra ? `Com o que sobra hoje, você chega em ${p.semPrazo.comSobra.texto}.` : "Escolha uma data para ver quanto guardar por mês.";
    case "poucos_dados":
      return `Para chegar até ${p.prazoTexto}, faltam ${dinheiro(p.falta)} por mês.`;
    default:
      return `Para chegar até ${p.prazoTexto}, faltam ${dinheiro(p.falta)} por mês.`;
  }
}


/* ---------------------------------------------------------------- trazer das outras metas */

/** Os passos da régua "Trazer para esta meta": de R$ 0 até o que dá, de R$ 10 em R$ 10. */
export function passosDoTrazer(maximo: number): number[] {
  const out: number[] = [];
  for (let v = 0; v <= maximo + 1e-9; v += 10) out.push(v);
  return out;
}

/**
 * Quando a outra meta chega se ela trouxer `tirar` dela para esta: o mês novo ("mar/2028"),
 * "parada" quando não sobra nada por mês para ela, ou null quando nem chega (depois de 2080).
 */
export function quandoChegaComMenos(f: Pick<FonteDoAporte, "porMes" | "alvo" | "guardado" | "taxaAnual">, tirar: number, hoje: Date): { texto: string } | "parada" | null {
  const porMes = Math.round((f.porMes - tirar) * 100) / 100;
  if (!(porMes > 0)) return "parada";
  const p = prazoQueCabe({ alvo: f.alvo, guardado: f.guardado, porMes, taxaAnual: f.taxaAnual, hoje });
  return p ? { texto: p.texto } : null;
}
