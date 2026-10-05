/**
 * "Posso comprar?" passo a passo (05/10/2026): as regras que a Dani desenhou em cima da conta de
 * `posso-comprar.ts`, que continua sendo a única fonte dos números.
 *
 * - O que a compra É (categoria) muda o conselho: parcelar só se sugere pra bem que dura
 *   (celular, eletrônico, casa, curso), nunca pra roupa, beleza ou viagem. "Tem que tomar
 *   cuidado pra gente não recomendar ela ficar fazendo parcelinha de várias coisas."
 * - Mesmo pra bem durável, as parcelas do mês somadas ficam em até 15% da renda.
 * - O quanto ela precisa muda o tom e a cor: "preciso mesmo" vira "como comprar", não "se
 *   compra"; "impulso" fica um nível mais duro.
 * - O caminho que ela escolhe pra fazer caber decide a sugestão final: juntar vira meta,
 *   o resto vira "vou comprar daquele jeito".
 *
 * Puro, sem banco e sem React.
 */

import { avaliarCompra, saidasDaCompra, type Compra, type CompraBase, type ResultadoCompra, type Veredito } from "./posso-comprar";

export type CategoriaDaCompra = {
  id: string;
  emoji: string;
  nome: string;
  /** Valores comuns da categoria: atalhos embaixo da roleta. */
  atalhos: number[];
  /** Bem que dura anos. Só esses recebem sugestão de parcelar. */
  duravel: boolean;
};

export const CATEGORIAS_DA_COMPRA: CategoriaDaCompra[] = [
  { id: "celular", emoji: "📱", nome: "Celular", atalhos: [1500, 2000, 3000, 5000], duravel: true },
  { id: "viagem", emoji: "✈️", nome: "Viagem", atalhos: [1000, 2500, 4000, 6000], duravel: false },
  { id: "vestuario", emoji: "👗", nome: "Vestuário", atalhos: [200, 500, 1000, 3000], duravel: false },
  { id: "eletronico", emoji: "💻", nome: "Eletrônico", atalhos: [800, 2000, 4000, 7000], duravel: true },
  { id: "beleza", emoji: "✨", nome: "Beleza", atalhos: [100, 300, 600, 1200], duravel: false },
  { id: "casa", emoji: "🏠", nome: "Casa", atalhos: [500, 1500, 3000, 6000], duravel: true },
  { id: "educacao", emoji: "📚", nome: "Educação", atalhos: [300, 1000, 2500, 6000], duravel: true },
];

/** "Outra coisa": a pessoa escreve o nome. Sem saber o que é, não sugere parcela. */
export function categoriaOutra(nome: string): CategoriaDaCompra {
  return { id: "outro", emoji: "🛍️", nome: nome.trim().slice(0, 60) || "Outra coisa", atalhos: [300, 1000, 2000, 5000], duravel: false };
}

/**
 * A roleta do valor começa no zero e acelera: de R$ 1 em R$ 1 até 200, de 10 em 10 até 1.000,
 * de 50 até 5.000, de 250 até 30.000, de mil até 100 mil, de 5 mil até 500 mil e de 25 mil até
 * 1 milhão (moto, carro e casa também passam por aqui).
 */
export const VALORES_DA_ROLETA: number[] = (() => {
  const v: number[] = [];
  const faixa = (de: number, ate: number, passo: number) => {
    for (let x = de; x <= ate; x += passo) v.push(x);
  };
  faixa(0, 200, 1);
  faixa(210, 1000, 10);
  faixa(1050, 5000, 50);
  faixa(5250, 30000, 250);
  faixa(31000, 100000, 1000);
  faixa(105000, 500000, 5000);
  faixa(525000, 1000000, 25000);
  return v;
})();

/** Parcelas: de 1 em 1 até 48x; depois os prazos de financiamento, até 420x (35 anos). */
export const VEZES_DA_ROLETA: number[] = [...Array.from({ length: 47 }, (_, k) => k + 2), 54, 60, 72, 84, 96, 108, 120, 144, 180, 240, 300, 360, 420];

/** Juros ao mês, de 0,5% a 15%, de 0,1 em 0,1. */
export const TAXAS_DA_ROLETA: number[] = Array.from({ length: 146 }, (_, k) => Math.round((0.5 + k * 0.1) * 10) / 10);

/** "Não sei" os juros: conta 3% ao mês, o comum em loja. */
export const JUROS_SE_NAO_SABE = 0.03;

export type Sinceridade = "precisa" | "quero" | "impulso";

/** Impulso pesa a partir deste valor; abaixo disso não vale um sermão. */
export const IMPULSO_A_PARTIR_DE = 100;

/**
 * O peso do "Seja sincera" no veredito da conta:
 * - precisa: o vermelho vira amarelo quando dá pra pagar sem mexer no básico (sai do livre, da
 *   sobra ou do que ela guarda). Só fica vermelho quando não fecha nem apertando.
 * - quero: a conta como ela é.
 * - impulso: um nível mais duro, a partir de R$ 100.
 */
export function vereditoComPeso(v: Veredito, sinceridade: Sinceridade, valor: number, pagavel: boolean): Veredito {
  if (sinceridade === "precisa") return v === "nao" && pagavel ? "custo" : v;
  if (sinceridade === "impulso" && valor > IMPULSO_A_PARTIR_DE) return v === "ok" ? "custo" : "nao";
  return v;
}

/** As parcelas do mês somadas (as que já existem + a nova) ficam em até 15% da renda. */
export const LIMITE_PARCELAS_DA_RENDA = 0.15;

export function podeSugerirParcela(cat: Pick<CategoriaDaCompra, "duravel">, parcelasNoMes: number, novaParcela: number, renda: number): boolean {
  return cat.duravel && renda > 0 && parcelasNoMes + novaParcela <= renda * LIMITE_PARCELAS_DA_RENDA + 1e-9;
}

/**
 * "LOJA 03/10", "PARC 03/10", "Parcela 1/12": a parcela que o banco escreve na fatura. Data com
 * ano ("18/09/2026") não conta, e "27/08" também não (27 parcelas de 8 não existe).
 */
export function parcelaDaDescricao(descricao: string): { atual: number; total: number } | null {
  const achados = [...descricao.matchAll(/(?:^|[^\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g)];
  if (achados.length === 0) return null;
  // "LOJA 03/09 PARCELA 02/10": a que vem depois de "parc" ganha; senão, a última.
  const depoisDeParc = achados.find((m) => /parc/i.test(descricao.slice(0, m.index ?? 0)));
  const m = depoisDeParc ?? achados[achados.length - 1];
  const atual = Number(m[1]);
  const total = Number(m[2]);
  if (!(total >= 2 && total <= 48 && atual >= 1 && atual <= total)) return null;
  return { atual, total };
}

/**
 * Quanto ela já paga de parcelas por mês, pelos gastos de um mês. Do mês passado só contam as
 * que continuam (a 10/10 terminou), pra não zerar no começo do mês, antes da fatura chegar.
 */
export function parcelasPorMes(doMes: { descricao: string; valor: number }[], doMesPassado: { descricao: string; valor: number }[]): number {
  const soma = (lista: { descricao: string; valor: number }[], soContinuam: boolean) =>
    lista.reduce((s, g) => {
      const p = parcelaDaDescricao(g.descricao);
      if (!p || !(g.valor > 0)) return s;
      if (soContinuam && p.atual >= p.total) return s;
      return s + g.valor;
    }, 0);
  return Math.max(soma(doMes, false), soma(doMesPassado, true));
}

type Formatos = Parameters<typeof avaliarCompra>[2];

const veredito = (r: ResultadoCompra): Veredito | null => ("erro" in r ? null : r.veredito);

/**
 * "Quero que você decida": à vista se cabe; senão, se é bem durável, o menor número de vezes sem
 * juros (até 12) que cabe e deixa as parcelas leves; senão, à vista (e o "fazer caber" mostra
 * como juntar). Nunca escolhe parcelinha pra roupa.
 */
export function formaQuePesaMenos(base: CompraBase, valor: number, cat: CategoriaDaCompra, parcelasNoMes: number, fmt: Formatos): Pick<Compra, "modo" | "parcelas" | "juros"> {
  const vista: Pick<Compra, "modo" | "parcelas" | "juros"> = { modo: "vista", parcelas: 1, juros: 0 };
  if (veredito(avaliarCompra(base, { valor, ...vista, desconto: 0 }, fmt)) === "ok") return vista;
  if (cat.duravel) {
    for (let n = 2; n <= 12; n++) {
      if (!podeSugerirParcela(cat, parcelasNoMes, valor / n, base.renda)) continue;
      if (veredito(avaliarCompra(base, { valor, modo: "parcelado", parcelas: n, juros: 0, desconto: 0 }, fmt)) === "ok") return { modo: "parcelado", parcelas: n, juros: 0 };
    }
  }
  return vista;
}

/** Um jeito de fazer caber. A tela escreve as frases pela voz do tema; aqui só o que é. */
export type Caminho =
  | { chave: "parcelar"; tipo: "comprar"; vezes: number; parcela: number; compra: Compra; resultado: Veredito }
  | { chave: "barato"; tipo: "comprar"; teto: number; vezes: number; compra: Compra; resultado: Veredito }
  | { chave: "cortar"; tipo: "comprar"; cortes: { nome: string; valor: number }[]; porMes: boolean; compra: Compra; resultado: Veredito }
  | { chave: "desconto"; tipo: "comprar"; preco: number; parcelado: number; compra: Compra; resultado: Veredito }
  | { chave: "juntarRapido"; tipo: "juntar"; mensal: number; meses: number; alvo: number; corte: { nome: string; valor: number } }
  | { chave: "juntar"; tipo: "juntar"; mensal: number; meses: number; alvo: number };

/** Desconto que loja costuma dar pra quem paga à vista (pedir não custa). */
const DESCONTO_A_VISTA = 0.1;

export function caminhosParaCaber(
  base: CompraBase,
  compra: Compra,
  cat: CategoriaDaCompra,
  sinceridade: Sinceridade,
  parcelasNoMes: number,
  fmt: Formatos,
): Caminho[] {
  const atual = avaliarCompra(base, compra, fmt);
  if ("erro" in atual) return [];
  const caminhos: Caminho[] = [];
  const avalia = (c: Compra) => veredito(avaliarCompra(base, c, fmt));
  const parcelaAtual = atual.quadro?.modo === "parcelado" ? atual.quadro.parcela : 0;

  // Parcelar sem juros (só bem durável, só se as parcelas do mês ficam leves).
  if (cat.duravel) {
    for (let n = 2; n <= 12; n++) {
      const c: Compra = { ...compra, modo: "parcelado", parcelas: n, juros: 0, desconto: 0 };
      if (compra.modo === "parcelado" && compra.juros === 0 && n <= compra.parcelas) continue;
      if (!podeSugerirParcela(cat, parcelasNoMes, compra.valor / n, base.renda)) continue;
      if (avalia(c) === "ok") {
        caminhos.push({ chave: "parcelar", tipo: "comprar", vezes: n, parcela: compra.valor / n, compra: c, resultado: "ok" });
        break;
      }
    }
  }

  // Cortar do orçamento: o que a conta já sabe apertar (lazer, outros…), sem mexer no básico. Se a
  // compra escolhida é parcelinha de algo que não dura, cortar pra manter a parcelinha não serve.
  const s = atual.saidas;
  const manterParcela = compra.modo === "parcelado" && !podeSugerirParcela(cat, parcelasNoMes, parcelaAtual, base.renda);
  if (s && s.cortes.length > 0 && s.cobre >= s.precisa - 0.5 && !manterParcela) {
    caminhos.push({ chave: "cortar", tipo: "comprar", cortes: s.cortes, porMes: s.porMes, compra, resultado: "ok" });
  }

  // Um mais em conta: o maior valor (de 50 em 50) que cabe. Durável em 10x sem juros quando a
  // parcela fica leve; o resto, à vista.
  const modoBarato = (v: number): Compra =>
    cat.duravel && podeSugerirParcela(cat, parcelasNoMes, v / 10, base.renda)
      ? { valor: v, modo: "parcelado", parcelas: 10, juros: 0, desconto: 0, descricao: compra.descricao }
      : { valor: v, modo: "vista", parcelas: 1, juros: 0, desconto: 0, descricao: compra.descricao };
  let lo = 0;
  let hi = Math.floor(compra.valor / 50) - 1;
  let teto = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (mid > 0 && avalia(modoBarato(mid * 50)) === "ok") {
      teto = mid * 50;
      lo = mid + 1;
    } else if (mid === 0) lo = 1;
    else hi = mid - 1;
  }
  if (teto >= 50 && teto >= compra.valor * 0.25) {
    const c = modoBarato(teto);
    caminhos.push({ chave: "barato", tipo: "comprar", teto, vezes: c.modo === "parcelado" ? c.parcelas : 1, compra: c, resultado: "ok" });
  }

  // Precisa e ia parcelar com juros: pedir desconto à vista.
  if (sinceridade === "precisa" && compra.modo === "parcelado" && compra.juros > 0) {
    const preco = Math.round(compra.valor * (1 - DESCONTO_A_VISTA));
    const c: Compra = { ...compra, modo: "vista", parcelas: 1, juros: 0, desconto: DESCONTO_A_VISTA };
    const r = avalia(c);
    if (r) caminhos.push({ chave: "desconto", tipo: "comprar", preco, parcelado: parcelaAtual * compra.parcelas, compra: c, resultado: r });
  }

  // Juntar antes e comprar à vista, sem dívida. Com um corte no lazer (o maior aperto que a conta
  // achar), junta mais rápido. Quem PRECISA não espera dois anos: só se for em até 3 meses.
  const guardar = s?.guardar ?? saidasDaCompra(base, compra, { valor: 1, porMes: false })?.guardar;
  if (guardar) {
    const tetoCortes = saidasDaCompra(base, compra, { valor: 1e9, porMes: true })?.cortes ?? [];
    const corte = tetoCortes[0];
    if (corte && corte.valor >= 10) {
      const meses = Math.max(1, Math.ceil(guardar.alvo / (guardar.alvo / guardar.meses + corte.valor)));
      if (meses < guardar.meses && (sinceridade !== "precisa" || meses <= 3)) {
        caminhos.push({ chave: "juntarRapido", tipo: "juntar", mensal: Math.ceil(guardar.alvo / meses), meses, alvo: guardar.alvo, corte });
      }
    }
    if (sinceridade !== "precisa" || guardar.meses <= 3) caminhos.push({ chave: "juntar", tipo: "juntar", ...guardar });
  }

  if (sinceridade === "precisa") {
    const ordem = ["cortar", "barato", "desconto", "parcelar", "juntarRapido", "juntar"];
    caminhos.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
  }
  return caminhos;
}

export type DecisaoDaCompra = "comprar" | "guardar" | "amanha" | "desistir";

/**
 * A ordem das decisões (a primeira é a sugestão):
 * - escolheu juntar no "fazer caber": guardar primeiro (vira meta); "comprar" sai;
 * - escolheu outro caminho: comprar daquele jeito; "guardar" sai;
 * - sem caminho: pelo "Seja sincera" (e, no "quero muito", pela prioridade que ela deu).
 */
export function ordemDasDecisoes(sinceridade: Sinceridade, prioridade: "compra" | "sonho" | null, caminho: Pick<Caminho, "tipo"> | null): DecisaoDaCompra[] {
  if (caminho?.tipo === "juntar") return ["guardar", "amanha", "desistir"];
  if (caminho) return sinceridade === "precisa" ? ["comprar", "amanha"] : ["comprar", "amanha", "desistir"];
  if (sinceridade === "precisa") return ["comprar", "guardar", "amanha"];
  if (sinceridade === "impulso") return ["amanha", "desistir", "guardar", "comprar"];
  return prioridade === "compra" ? ["comprar", "guardar", "amanha", "desistir"] : ["guardar", "comprar", "amanha", "desistir"];
}
