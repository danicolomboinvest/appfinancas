import { pareceEstorno } from "@/lib/import/estorno";
import { MESES_CURTOS } from "@/lib/metas/projecao";
import { alternativasPara, economiaPara, passosDaRegua, textoDoPrazo } from "./plano-da-meta-regua";
import { grupoDoLancamento, type CobrancasDeAssinatura, type Coisinha, type EntradaDoPlano, type LancamentoDoPlano, type PlanoDaMeta, type TipoDaCoisinha } from "./plano-da-meta";

/**
 * O plano da meta depois do "Usar esse plano" (16/10/2026, aprovado pela Dani para construir).
 *
 * Mora na tabela Decisao (tipo "plano_da_meta", chave = id da meta), sem tabela nova: o plano é um
 * registro da escolha dela, como as outras decisões do app. Guarda cada coisinha escolhida com o
 * TETO por mês (o valor da régua: "iFood até R$ 200"), as cobranças das assinaturas conhecidas
 * na hora (para o aviso não contar a assinatura como lazer) e o caminho escolhido quando não
 * fechava (mais prazo, meta menor ou guardar o que dá).
 *
 * O orçamento por categoria NÃO muda: o teto é da coisinha (marca ou subcategoria), e o aviso a 75%
 * soma os lançamentos do mês com a mesma regra que montou a coisinha (`grupoDoLancamento`).
 *
 * Puro, sem banco. Quem lê e grava é repositories/plano-da-meta.repo.ts.
 */

export const TIPO_DO_PLANO = "plano_da_meta";
/** O aviso sai quando o gasto do mês na coisinha chega a 75% do teto. */
export const AVISO_EM = 0.75;

export type Saida = "nenhuma" | "prazo" | "menor" | "daa";

export type ItemDoPlano = {
  id: string;
  tipo: TipoDaCoisinha;
  nome: string;
  marca: string | null;
  /** Quanto era por mês quando ela fez o plano. */
  hoje: number;
  /** O teto por mês que ela escolheu (0 = cancelar). */
  teto: number;
  economia: number;
  acao: "cancelar" | "reduzir";
  /** Assinatura: a chave do Raio-X (é o que liga o lembrete de cancelar). */
  raiox: string | null;
};

/** O que o plano mexe na meta: valor por mês, prazo ("2027-11" ou null) e alvo. */
export type ValoresDaMeta = { alvo: number; prazo: string | null; porMes: number };

export type PlanoGravado = {
  versao: 1;
  itens: ItemDoPlano[];
  /** As cobranças de assinatura conhecidas na hora (chave do Raio-X -> valores por mês). */
  cobrancas: [string, number[]][];
  /** O que a meta guarda por mês com o plano. */
  porMes: number;
  alvo: number;
  /** "2027-11" ou null. */
  prazo: string | null;
  saida: Saida;
  /** Soma das economias. */
  achado: number;
  em: string;
  /** A meta antes do plano (o "Tirar o plano" volta para isso). Ausente nos planos gravados antes. */
  antes?: ValoresDaMeta;
  /** A meta como o plano deixou (para saber se ela mexeu à mão depois). */
  depois?: ValoresDaMeta;
  /** O que veio das outras metas (o "Tirar o plano" devolve, se ela não mexeu nelas depois). */
  trazidos?: Trazido[];
};

/** O que ela trouxe de outra meta (ou da reserva) para esta: o "por mês" dela antes e depois. */
export type Trazido = { id: string; nome: string; reserva: boolean; valor: number; antes: number; depois: number };

export type Escolhas = { itens: { id: string; valor: number }[]; saida: Saida; trazer?: { id: string; valor: number }[] };

const reais = (v: number) => Math.round(v * 100) / 100;
const chaveDoPrazo = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** O prazo gravado ("2027-11") como data (dia 1, meio-dia), do jeito que a meta grava. */
export function dataDoPrazo(prazo: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(prazo ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1, 12) : null;
}

/** "nov/2027" do prazo gravado. */
export function textoDoPrazoGravado(prazo: string | null): string | null {
  const d = dataDoPrazo(prazo);
  return d ? `${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}` : null;
}

export type ResultadoDasEscolhas =
  | { ok: true; plano: PlanoGravado; meta: { alvo: number; prazo: Date | null; porMes: number }; trazidos: Trazido[] }
  | { ok: false; erro: string };

/**
 * Confere as escolhas que vieram da tela contra o plano recalculado no servidor e monta o que é
 * gravado. Nada da tela vale sem passar por aqui: a coisinha tem de existir, o valor tem de ser um
 * passo da régua dela, e o caminho escolhido tem de existir para o total achado.
 */
export function aplicarEscolhas(p: PlanoDaMeta, meta: EntradaDoPlano["meta"], e: Escolhas, hoje: Date, cobrancas: CobrancasDeAssinatura = new Map()): ResultadoDasEscolhas {
  if (!p.mostra) return { ok: false, erro: "O plano não vale para esta meta." };
  if (p.situacao !== "fecha" && p.situacao !== "nao_fecha" && p.situacao !== "sem_coisinhas") return { ok: false, erro: "Esta meta não precisa de plano agora." };
  if (!meta.prazo || p.pede === null) return { ok: false, erro: "Escolha uma data para a meta." };

  const vistos = new Set<string>();
  const itens: ItemDoPlano[] = [];
  for (const x of e.itens) {
    if (vistos.has(x.id)) return { ok: false, erro: "Coisinha repetida." };
    vistos.add(x.id);
    const c: Coisinha | undefined = p.coisinhas.find((k) => k.id === x.id);
    if (!c) return { ok: false, erro: "Uma coisinha mudou. Abra o plano de novo." };
    let teto = 0;
    if (c.acao === "reduzir") {
      teto = reais(x.valor);
      if (!passosDaRegua(c.hoje).some((v) => Math.abs(v - teto) < 0.005)) return { ok: false, erro: "Valor fora da régua." };
    }
    const economia = c.acao === "cancelar" ? c.hoje : economiaPara(c, teto);
    if (economia <= 0) continue; // do jeito que está: não entra no plano
    const raiox = c.acao === "cancelar" ? (c.raiox ?? null) : null;
    itens.push({ id: c.id, tipo: c.tipo, nome: c.nome, marca: c.marca, hoje: c.hoje, teto, economia, acao: c.acao, raiox });
  }
  // Trazer das outras metas: só de quem está na lista, de R$ 10 em R$ 10, até o que cada uma pode ceder.
  const trazidos: Trazido[] = [];
  const vistasT = new Set<string>();
  for (const t of e.trazer ?? []) {
    if (vistasT.has(t.id)) return { ok: false, erro: "Meta repetida." };
    vistasT.add(t.id);
    if (!(t.valor > 0)) continue;
    const f = p.jaGuarda.fontes.find((x) => x.id === t.id);
    if (!f) return { ok: false, erro: "Uma meta mudou. Abra o plano de novo." };
    if (t.valor > f.podeTrazer + 1e-9 || Math.abs(t.valor / 10 - Math.round(t.valor / 10)) > 1e-9) return { ok: false, erro: f.travada === "reserva_curta" ? "A Reserva fica: ela ainda está com menos de 3 meses." : "Valor fora da régua." };
    trazidos.push({ id: f.id, nome: f.nome, reserva: f.reserva, valor: t.valor, antes: f.porMes, depois: reais(f.porMes - t.valor) });
  }
  const trazido = reais(trazidos.reduce((s, t) => s + t.valor, 0));
  const achado = reais(itens.reduce((s, i) => s + i.economia, 0));
  const disponivel = reais(p.sobra + trazido + achado);
  const base = { versao: 1 as const, itens, cobrancas: [...cobrancas.entries()].map(([k, v]) => [k, [...v]] as [string, number[]]), achado, em: hoje.toISOString(), ...(trazidos.length > 0 ? { trazidos } : {}) };

  if (disponivel >= p.pede - 1e-9) {
    if (itens.length === 0 && trazidos.length === 0) return { ok: false, erro: "Escolha pelo menos uma coisinha." };
    return { ok: true, plano: { ...base, porMes: p.pede, alvo: meta.alvo, prazo: chaveDoPrazo(meta.prazo), saida: "nenhuma" }, meta: { alvo: meta.alvo, prazo: meta.prazo, porMes: p.pede }, trazidos };
  }
  const a = alternativasPara(meta, disponivel, hoje);
  if (e.saida === "prazo" && a.prazo) {
    const d = new Date(a.prazo.ano, a.prazo.mes - 1, 1, 12);
    return { ok: true, plano: { ...base, porMes: a.prazo.porMes, alvo: meta.alvo, prazo: chaveDoPrazo(d), saida: "prazo" }, meta: { alvo: meta.alvo, prazo: d, porMes: a.prazo.porMes }, trazidos };
  }
  if (e.saida === "menor" && a.metaMenor) {
    return { ok: true, plano: { ...base, porMes: a.metaMenor.porMes, alvo: a.metaMenor.alvo, prazo: chaveDoPrazo(meta.prazo), saida: "menor" }, meta: { alvo: a.metaMenor.alvo, prazo: meta.prazo, porMes: a.metaMenor.porMes }, trazidos };
  }
  if (e.saida === "daa" && a.oQueDa) {
    return { ok: true, plano: { ...base, porMes: a.oQueDa, alvo: meta.alvo, prazo: chaveDoPrazo(meta.prazo), saida: "daa" }, meta: { alvo: meta.alvo, prazo: meta.prazo, porMes: a.oQueDa }, trazidos };
  }
  return { ok: false, erro: "Não fechou: escolha mais prazo ou meta menor." };
}

const centavos = (v: number) => Math.round(v * 100);
/** A meta está igual a estes valores (no centavo e no mês)? */
export function mesmosValores(a: ValoresDaMeta, b: ValoresDaMeta): boolean {
  return centavos(a.alvo) === centavos(b.alvo) && centavos(a.porMes) === centavos(b.porMes) && (a.prazo ?? null) === (b.prazo ?? null);
}

/** Os valores da meta como o plano compara ("2027-11" no prazo). */
export function valoresDaMeta(m: { alvo: number; prazo: Date | null; porMes: number }): ValoresDaMeta {
  return { alvo: m.alvo, prazo: m.prazo ? chaveDoPrazo(m.prazo) : null, porMes: m.porMes };
}

/**
 * O "antes" de um plano novo: se já havia plano e a meta continua como ele deixou, o antes é o
 * do plano antigo ("Mudar o plano" não perde a meta de antes de tudo); senão, a meta de agora.
 */
export function antesDoPlanoNovo(anterior: PlanoGravado | null, agora: ValoresDaMeta): ValoresDaMeta {
  if (anterior?.antes && anterior.depois && mesmosValores(anterior.depois, agora)) return anterior.antes;
  return agora;
}

/**
 * O que o "Tirar o plano" faz com a meta (pedido de 16/10/2026):
 * - "voltar": o plano mudou a meta e ela não mexeu depois: volta aos valores de antes;
 * - "mexida": ela mudou a meta à mão depois do plano: a meta fica como está agora (a tela avisa);
 * - "nada": o plano não mudou a meta (ou é um plano antigo, sem o antes guardado).
 */
export function oQueTirarFaz(p: PlanoGravado, agora: ValoresDaMeta): { acao: "voltar"; valores: ValoresDaMeta } | { acao: "mexida" | "nada" } {
  if (!p.antes || !p.depois) return { acao: "nada" };
  if (!mesmosValores(p.depois, agora)) return { acao: "mexida" };
  if (mesmosValores(p.antes, agora)) return { acao: "nada" };
  return { acao: "voltar", valores: p.antes };
}

/** O registro (coluna `dados` da Decisao) de volta para plano; null se não for um plano válido. */
export function planoDoRegistro(dados: unknown): PlanoGravado | null {
  const d = (dados && typeof dados === "object" ? dados : null) as Partial<PlanoGravado> | null;
  if (!d || d.versao !== 1 || !Array.isArray(d.itens) || typeof d.porMes !== "number" || typeof d.alvo !== "number") return null;
  const itens = d.itens.filter((i): i is ItemDoPlano => !!i && typeof i.id === "string" && typeof i.nome === "string" && typeof i.teto === "number" && typeof i.hoje === "number");
  const cobrancas = Array.isArray(d.cobrancas) ? d.cobrancas.filter((c): c is [string, number[]] => Array.isArray(c) && typeof c[0] === "string" && Array.isArray(c[1])) : [];
  const saida: Saida = d.saida === "prazo" || d.saida === "menor" || d.saida === "daa" ? d.saida : "nenhuma";
  const valores = (v: unknown): ValoresDaMeta | undefined => {
    const x = (v && typeof v === "object" ? v : null) as Partial<ValoresDaMeta> | null;
    return x && typeof x.alvo === "number" && typeof x.porMes === "number" ? { alvo: x.alvo, porMes: x.porMes, prazo: typeof x.prazo === "string" ? x.prazo : null } : undefined;
  };
  const trazidos = Array.isArray(d.trazidos)
    ? d.trazidos.filter((t): t is Trazido => !!t && typeof t.id === "string" && typeof t.valor === "number" && typeof t.antes === "number" && typeof t.depois === "number").map((t) => ({ id: t.id, nome: typeof t.nome === "string" ? t.nome : "", reserva: t.reserva === true, valor: t.valor, antes: t.antes, depois: t.depois }))
    : [];
  const antes = valores(d.antes);
  const depois = valores(d.depois);
  return {
    versao: 1,
    itens,
    cobrancas,
    porMes: d.porMes,
    alvo: d.alvo,
    prazo: typeof d.prazo === "string" ? d.prazo : null,
    saida,
    achado: typeof d.achado === "number" ? d.achado : 0,
    em: typeof d.em === "string" ? d.em : "",
    ...(antes ? { antes } : {}),
    ...(depois ? { depois } : {}),
    ...(trazidos.length > 0 ? { trazidos } : {}),
  };
}

/** O resumo do selo da meta: "3 coisinhas, R$ 380 por mês". */
export function resumoDoPlano(p: PlanoGravado): { coisinhas: number; achado: number } {
  return { coisinhas: p.itens.length, achado: p.achado };
}

/* ---------------------------------------------------------------- o aviso a 75% */

/**
 * Quanto ela já gastou no mês numa coisinha do plano, com a mesma regra que montou a coisinha
 * (estorno abate, assinatura conhecida fica de fora).
 */
export function gastoDoItem(item: Pick<ItemDoPlano, "id">, lancamentos: readonly LancamentoDoPlano[], cobrancas: CobrancasDeAssinatura): number {
  let s = 0;
  for (const l of lancamentos) {
    const g = grupoDoLancamento(l, cobrancas);
    if (!g || g.id !== item.id) continue;
    s += l.valor > 0 && pareceEstorno(l.descricao) ? -l.valor : l.valor;
  }
  return reais(Math.max(0, s));
}

export type AvisoDoTeto = { item: ItemDoPlano; gasto: number; pct: number };

/** As coisinhas (com teto) que passaram de 75% no mês. A de cancelar (teto 0) não entra. */
export function tetosAlcancados(p: PlanoGravado, lancamentosDoMes: readonly LancamentoDoPlano[]): AvisoDoTeto[] {
  const cobrancas = new Map(p.cobrancas);
  const out: AvisoDoTeto[] = [];
  for (const item of p.itens) {
    if (item.acao !== "reduzir" || !(item.teto > 0)) continue;
    const gasto = gastoDoItem(item, lancamentosDoMes, cobrancas);
    if (gasto >= item.teto * AVISO_EM) out.push({ item, gasto, pct: Math.round((gasto / item.teto) * 100) });
  }
  return out;
}

/**
 * A chave do aviso: uma por coisinha e mês, mesmo que ela esteja em mais de um plano (duas metas
 * com o iFood mandavam dois avisos iguais). O NotificationLog impede repetir.
 */
export function chaveDoAvisoDoTeto(itemId: string, ano: number, mes: number): string {
  return `plano:${itemId}:${ano}-${String(mes).padStart(2, "0")}:75`.slice(0, 190);
}

/**
 * Com mais de um plano, cada coisinha avisa uma vez: vale o teto mais apertado (o de maior
 * porcentagem já usada), com o nome da meta desse plano.
 */
export function avisosPorCoisinha<T extends { meta: string }>(avisos: readonly (AvisoDoTeto & T)[]): (AvisoDoTeto & T)[] {
  const melhor = new Map<string, AvisoDoTeto & T>();
  for (const a of avisos) {
    const atual = melhor.get(a.item.id);
    if (!atual || a.pct > atual.pct) melhor.set(a.item.id, a);
  }
  return [...melhor.values()];
}

/** O texto do aviso. */
export function textoDoAvisoDoTeto(a: AvisoDoTeto, nomeDaMeta: string, money: (v: number) => string): { titulo: string; corpo: string } {
  const falta = Math.max(0, reais(a.item.teto - a.gasto));
  return {
    // Começa com "Faltam", não com a marca: o assunto do e-mail ganha maiúscula na primeira letra
    // (lib/email/blocos.ts) e "iFood" virava "IFood".
    titulo: falta > 0 ? `Faltam ${money(falta)} no combinado de ${a.item.nome}` : `Chegou no combinado de ${a.item.nome}`,
    corpo: `Você já usou ${money(a.gasto)} de ${money(a.item.teto)} este mês. É o plano da meta ${nomeDaMeta}.`,
  };
}

export { textoDoPrazo };

/** Tirar o plano devolve o que veio de cada outra meta, se ela não mexeu no "por mês" dela depois. */
export function devolucoes(p: PlanoGravado, porMesAgora: ReadonlyMap<string, number>): { id: string; reserva: boolean; porMes: number }[] {
  return (p.trazidos ?? []).filter((t) => porMesAgora.has(t.id) && Math.round((porMesAgora.get(t.id) as number) * 100) === Math.round(t.depois * 100)).map((t) => ({ id: t.id, reserva: t.reserva, porMes: t.antes }));
}

/**
 * "Mudar o plano" depois de já ter trazido de outra meta: o que veio antes continua registrado
 * (para o "Tirar o plano" devolver tudo). Mesma meta nas duas vezes: soma, com o "antes" de antes
 * de tudo. Meta que ela mexeu à mão depois (o "por mês" não é o que o plano deixou) sai do registro.
 */
export function juntarTrazidos(anteriores: readonly Trazido[], novos: readonly Trazido[], porMesAgora: ReadonlyMap<string, number>): Trazido[] {
  const out = new Map<string, Trazido>();
  for (const a of anteriores) {
    const agora = porMesAgora.get(a.id);
    if (agora !== undefined && Math.round(agora * 100) === Math.round(a.depois * 100)) out.set(a.id, { ...a });
  }
  for (const n of novos) {
    const a = out.get(n.id);
    out.set(n.id, a ? { ...n, antes: a.antes, valor: Math.round((a.valor + n.valor) * 100) / 100 } : { ...n });
  }
  return [...out.values()];
}
