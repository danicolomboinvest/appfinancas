import type { FocoItem } from "./foco";
import { planoDeCobrir, porDiaComOLivre, quantoPassou, tempoDoMes, type CategoriaParaRemanejo } from "@/lib/planning/remanejo";

/**
 * A pilha do Decidir (rodadas 38, 49 e 53): "uma decisão por vez". Cada aviso do motor do Foco
 * vira um cartão no mesmo formato: o assunto, um número grande, uma linha, uma barra fina, uma
 * pergunta e 2 ou 3 respostas que aplicam a regra. A resposta é um toque, com Desfazer.
 *
 * A pilha mostra os mesmos itens que "Decisões importantes" conta no Resumo (o `atencao` do
 * motor, no máximo 3); o resto aparece em "Mais N podem esperar" e sobe quando um sai.
 *
 * Puro, sem banco e sem React: a página manda os números, a tela só desenha.
 */

export type RespostaId =
  | "tirar"
  | "livre"
  | "deixar"
  | "guardar_mais"
  | "mudar_data"
  | "sobra_reserva"
  | "ver_raiox"
  | "teto"
  | "classificar"
  | "ja_guardei"
  | "guardo_na_semana";

export type RespostaDaPilha = {
  id: RespostaId;
  titulo: string;
  /** O efeito, em cinza do lado ("sobra R$ 883", "fica R$ 127 por dia"). */
  sub?: string;
  /** "é do dia a dia", quando a origem do remanejo é Transporte ou Alimentação. */
  etiqueta?: string;
  /** A resposta sugerida: o botão cheio. */
  principal?: boolean;
  /** A resposta que leva para outra tela (que faz sentido para ela; nunca o Resumo genérico). */
  href?: string;
};

export type TomDoCartao = "passou" | "atrasada" | "info";

export type CartaoDaPilha = {
  /** O id do aviso no motor do Foco ("estouro-SAUDE", "meta-abc", "reserva"). */
  id: string;
  tipo: "estouro" | "ritmo" | "fora" | "aporte" | "meta" | "reserva" | "raiox";
  /** "Saúde", "Viagem Europa 2027", "Reserva" (a pilha do Titânio e da Manifestação). */
  assunto: string;
  /** "Saúde passou do plano", "Europa atrasada", "Reserva curta" (Padrão e Girly). */
  titulo: string;
  /** O nome curto no "Depois: Europa e Reserva". */
  curto: string;
  /** O número grande, já formatado ("R$ 67"). */
  numero: string;
  linha: string;
  /** A barra fina, de 0 a 1. */
  progresso: number;
  tom: TomDoCartao;
  pergunta: string;
  respostas: RespostaDaPilha[];
  /** Para o ícone e para as respostas que mexem numa categoria. */
  categoria?: string;
  metaId?: string;
  /** Meta que pede por mês mais do que cabe: o selo "prazo apertado" leva à sugestão de prazo. */
  prazoApertado?: string;
  /** Os números que as respostas aplicam (a tela não recalcula nada). */
  aplicar?: {
    /** "Tirar de": de onde sai e quanto, somando o valor exato que passou. */
    origens?: { key: string; label: string; valor: number }[];
    /** Meta: o novo "por mês" e o mês da data nova. */
    porMes?: number;
    chega?: { ano: number; mes: number };
    /** Ritmo: o teto até o fim do mês. */
    teto?: number;
    /** Reserva: a sobra do fim do mês que vai para ela. */
    sobra?: number;
  };
};

export type MetaDaPilha = {
  id: string;
  nome: string;
  atual: number;
  alvo: number;
  /** "nov/2027", ou null sem prazo. */
  prazoCurto: string | null;
  /** Quanto precisa por mês para chegar no prazo. */
  porMes: number;
  /** O que ela guarda por mês para ela, de verdade (média dos últimos meses fechados). */
  ritmo: number;
  /** Quando chega no ritmo de hoje: "mai/2032" e o mês em si, ou null quando não chega. */
  chega: { curto: string; ano: number; mes: number } | null;
  vencida: boolean;
  /** Pede por mês mais do que cabe (lib/metas/prazo-que-cabe). */
  apertado?: boolean;
};

export type DadosDaPilha = {
  money: (v: number) => string;
  remanejo: { categorias: CategoriaParaRemanejo[]; essenciais: string[]; livre: number | null; diasRestantes: number; diasNoMes?: number };
  metas: MetaDaPilha[];
  /** A reserva de emergência: quanto tem, a meta e quanto sobra no fim do mês se seguir assim. */
  reserva: { atual: number; alvo: number; fimDoMes: number | null } | null;
  /** A tela de Transações do mês, onde ela escolhe a categoria dos gastos fora do plano. */
  hrefMes: string;
};

const fracao = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(1, a / b)) : 0);
const DEIXAR: RespostaDaPilha = { id: "deixar", titulo: "Deixar assim por agora" };

/** O cartão de um aviso. Aviso que a pilha não sabe desenhar volta null (não aparece quebrado). */
export function cartaoDaPilha(item: FocoItem, d: DadosDaPilha): CartaoDaPilha | null {
  const m = d.money;
  const det = item.detalhe;
  if (!det) return null;

  if (det.tipo === "estouro") {
    const essenciais = new Set(d.remanejo.essenciais);
    const categorias = d.remanejo.categorias.map((c) => ({ ...c, essencial: c.essencial || essenciais.has(c.key) }));
    const passou = categorias.find((c) => c.key === det.categoria) ?? { key: det.categoria, label: det.label, planejado: det.planejado, gasto: det.gasto };
    const valor = quantoPassou(passou);
    // O dia a dia só dá o que passa do ritmo dela até o fim do mês (remanejo.ts).
    const plano = planoDeCobrir(passou, categorias, tempoDoMes(d.remanejo.diasRestantes, d.remanejo.diasNoMes));
    const tirar: RespostaDaPilha | null =
      plano.origens.length === 0
        ? null
        : plano.origens.length === 1
          ? { id: "tirar", titulo: `Tirar de ${plano.origens[0].label}`, sub: `sobra ${m(plano.origens[0].sobraDepois)}` }
          : { id: "tirar", titulo: plano.origens.map((o) => `${m(o.valor)} de ${o.label}`).join(" + ") };
    if (tirar && plano.nivel === 2) tirar.etiqueta = "é do dia a dia";
    const livre: RespostaDaPilha = {
      id: "livre",
      titulo: "Usar o livre do mês",
      ...(d.remanejo.livre !== null ? { sub: `fica ${m(porDiaComOLivre(d.remanejo.livre, valor, d.remanejo.diasRestantes))} por dia` } : {}),
    };
    const ordem = plano.principal === "tirar" && tirar ? [tirar, livre] : tirar ? [livre, tirar] : [livre];
    ordem[0] = { ...ordem[0], principal: true };
    return {
      id: item.id,
      tipo: "estouro",
      assunto: det.label,
      titulo: `${det.label} passou do plano`,
      curto: det.label,
      numero: m(valor),
      linha: `a mais que os ${m(det.planejado)} do mês`,
      progresso: fracao(det.gasto, det.planejado),
      tom: "passou",
      pergunta: "De onde sai?",
      respostas: [...ordem, DEIXAR],
      categoria: det.categoria,
      aplicar: { origens: plano.origens.map((o) => ({ key: o.key, label: o.label, valor: o.valor })) },
    };
  }

  if (det.tipo === "meta") {
    const meta = d.metas.find((x) => x.id === det.metaId);
    if (!meta) return null;
    const nome = meta.nome.trim();
    const respostas: RespostaDaPilha[] = [];
    const mais = Math.max(0, Math.ceil(meta.porMes - meta.ritmo));
    // Prazo vencido: "guardar mais por mês" não existe (o que falta já é o total); só a data nova.
    if (!meta.vencida && mais >= 1) respostas.push({ id: "guardar_mais", titulo: `Guardar mais ${m(mais)} por mês`, ...(meta.prazoCurto ? { sub: `chega em ${meta.prazoCurto}` } : {}) });
    if (meta.chega) respostas.push({ id: "mudar_data", titulo: "Mudar a data", sub: `para ${meta.chega.curto}` });
    if (respostas.length) respostas[0] = { ...respostas[0], principal: true };
    return {
      id: item.id,
      tipo: "meta",
      assunto: nome,
      titulo: `${nome} atrasada`,
      curto: nome,
      numero: m(meta.atual),
      linha: `guardados de ${m(meta.alvo)}${meta.prazoCurto ? ` · prazo ${meta.prazoCurto}` : ""}`,
      progresso: fracao(meta.atual, meta.alvo),
      tom: "atrasada",
      pergunta: "Como recuperar?",
      respostas: [...respostas, DEIXAR],
      metaId: meta.id,
      ...(meta.apertado ? { prazoApertado: `/planejamento/metas?prazo=${meta.id}` } : {}),
      aplicar: { porMes: Math.ceil(meta.porMes), ...(meta.chega ? { chega: { ano: meta.chega.ano, mes: meta.chega.mes } } : {}) },
    };
  }

  if (det.tipo === "reserva") {
    const r = d.reserva;
    const meses = det.meses < 1 ? "menos de 1 mês" : `${det.meses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${det.meses === 1 ? "mês" : "meses"}`;
    const respostas: RespostaDaPilha[] = [];
    // A sobra que o fim do mês projeta (a mesma do Resumo). Sem projeção, ou sem sobra, não há o que mandar.
    if (r && r.fimDoMes !== null && r.fimDoMes >= 1) respostas.push({ id: "sobra_reserva", titulo: "Mandar a sobra do mês", sub: `+${m(r.fimDoMes)} na reserva`, principal: true });
    return {
      id: item.id,
      tipo: "reserva",
      assunto: "Reserva",
      titulo: "Reserva curta",
      curto: "Reserva",
      numero: r ? m(r.atual) : meses,
      linha: r ? `na reserva · ${meses}` : `de ${det.minimo} meses de custo de vida`,
      progresso: r ? fracao(r.atual, r.alvo) : fracao(det.meses, det.minimo),
      tom: "info",
      pergunta: "Como reforçar?",
      respostas: [...respostas, DEIXAR],
      ...(r && r.fimDoMes !== null && r.fimDoMes >= 1 ? { aplicar: { sobra: r.fimDoMes } } : {}),
    };
  }

  if (det.tipo === "raiox") {
    return {
      id: item.id,
      tipo: "raiox",
      assunto: "O que se repete",
      titulo: "O que se repete todo mês",
      curto: "assinaturas",
      numero: m(det.anual),
      linha: `por ano, em ${det.n} ${det.n === 1 ? "gasto que se repete" : "gastos que se repetem"}`,
      progresso: 1,
      tom: "info",
      pergunta: "Vale manter?",
      respostas: [{ id: "ver_raiox", titulo: "Ver um por um", sub: "Cancelar ou manter", principal: true, href: "/decidir/raio-x" }, DEIXAR],
    };
  }

  if (det.tipo === "ritmo") {
    return {
      id: item.id,
      tipo: "ritmo",
      assunto: det.label,
      titulo: `${det.label} correndo rápido`,
      curto: det.label,
      numero: m(det.sobra),
      linha: `sobram em ${det.label} para ${det.dias} ${det.dias === 1 ? "dia" : "dias"}`,
      progresso: fracao(det.gasto, det.planejado),
      tom: "atrasada",
      pergunta: "Como segurar?",
      respostas: [{ id: "teto", titulo: `Segurar em ${m(det.sobra)}`, sub: "até o fim do mês", principal: true }, DEIXAR],
      categoria: det.categoria,
      aplicar: { teto: det.sobra },
    };
  }

  if (det.tipo === "fora") {
    return {
      id: item.id,
      tipo: "fora",
      assunto: "Fora do plano",
      titulo: "Gastos fora do plano",
      curto: "gastos fora do plano",
      numero: m(det.valor),
      linha: "em gastos sem categoria no plano do mês",
      progresso: 1,
      tom: "passou",
      pergunta: "Onde encaixar?",
      respostas: [{ id: "classificar", titulo: "Escolher a categoria", sub: "um por um", principal: true, href: d.hrefMes }, DEIXAR],
    };
  }

  if (det.tipo === "aporte") {
    return {
      id: item.id,
      tipo: "aporte",
      assunto: "Guardar do mês",
      titulo: "Falta guardar",
      curto: "guardar do mês",
      numero: m(det.falta),
      linha: `faltam dos ${m(det.planejado)} que o plano guarda`,
      progresso: fracao(det.guardado, det.planejado),
      tom: "atrasada",
      pergunta: "Já guardou?",
      respostas: [
        { id: "ja_guardei", titulo: "Já guardei", sub: `+${m(det.falta)} guardados`, principal: true },
        { id: "guardo_na_semana", titulo: "Guardo esta semana" },
      ],
    };
  }

  return null;
}

/** Quantos cartões a pilha mostra de uma vez (o resto "pode esperar"); o mesmo do motor do Foco. */
export const MAX_NA_PILHA = 3;

/**
 * O aviso vira cartão? A mesma condição em que `cartaoDaPilha` não volta null, sem precisar dos
 * números: o Resumo usa para contar, o Decidir para desenhar.
 */
export function cabeNaPilha(item: FocoItem, metaIds: ReadonlySet<string>): boolean {
  const det = item.detalhe;
  if (!det) return false;
  if (det.tipo === "meta") return metaIds.has(det.metaId);
  return ["estouro", "ritmo", "fora", "aporte", "reserva", "raiox"].includes(det.tipo);
}

/**
 * A lista ÚNICA do Decidir (15/10/2026): o que vai para a pilha "Para decidir hoje" e o que "pode
 * esperar". O Resumo conta o "Mais N no Decidir" desta lista e o Decidir desenha esta lista. Antes o
 * Resumo contava o `atencao` cru do motor e o Decidir jogava fora o que não sabia desenhar: o
 * Resumo dizia "1 decisão no Decidir" e o Decidir, "Tudo resolvido".
 *
 * O que já foi respondido (lib/avisos) o motor do Foco já tirou. O Raio-X sempre espera.
 */
export function listaDoDecidir(foco: { atencao: FocoItem[]; depois: FocoItem[] }, metaIds: Iterable<string>): { pilha: FocoItem[]; depois: FocoItem[] } {
  const ids = new Set(metaIds);
  const todos = [...foco.atencao, ...foco.depois].filter((i) => cabeNaPilha(i, ids));
  const urgentes = todos.filter((i) => i.detalhe?.tipo !== "raiox");
  const esperam = todos.filter((i) => i.detalhe?.tipo === "raiox");
  return { pilha: urgentes.slice(0, MAX_NA_PILHA), depois: [...urgentes.slice(MAX_NA_PILHA), ...esperam] };
}

/** O "Mais N no Decidir" do Resumo: os cartões da pilha, nem um a mais nem um a menos. */
export function quantosNoDecidir(foco: { atencao: FocoItem[]; depois: FocoItem[] }, metaIds: Iterable<string>): number {
  return listaDoDecidir(foco, metaIds).pilha.length;
}

/**
 * A ordem da pilha: a do motor, e quem foi pulado ("Pular este", ou deslizar) vai para o fim.
 * Pular duas vezes não volta para a frente.
 */
export function ordenarPilha<T extends { id: string }>(cartoes: T[], pulos: Record<string, number>): T[] {
  return cartoes
    .map((c, i) => ({ c, peso: i + (pulos[c.id] ?? 0) * 100 }))
    .sort((a, b) => a.peso - b.peso)
    .map((x) => x.c);
}

/** "Europa e Reserva", "Saúde, Europa e Reserva". */
export function juntarComE(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

/**
 * "1 de 3": quantos já saíram desde que ela abriu a tela, mais o da frente. O total não encolhe
 * enquanto ela resolve (3 de 3 no último), e cresce se um novo chegar.
 */
export function contadorDaPilha(vistos: number, naPilha: number): { atual: number; total: number } {
  const total = Math.max(naPilha, vistos);
  return { atual: total - naPilha + 1, total };
}
