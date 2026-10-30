import type { Prisma } from "@prisma/client";
import { chaveDoComerciante } from "@/lib/import/comerciante";

/**
 * Casal simples (aprovado pela dona em 13/10/2026, casal-simples-proposta.html).
 *
 * O app fica igual. Cada pessoa entra com o próprio login, no próprio Pessoal, e vê também o que
 * o par deixou visível. Não existe perfil novo nem dado copiado: os lançamentos de cada um
 * continuam com o userId e o profileId de quem gastou. O que junta os dois é a LEITURA, e ela
 * mora toda aqui, num lugar só, com teste.
 *
 * As oito regras da proposta, no que o código faz:
 * 1. Cada pessoa entra com o próprio login, no app de sempre.
 * 2. O gasto é de quem passou o cartão: o dono do registro (userId) vira a bolinha.
 * 3. Ao ligar, tudo aparece para os dois (soMeu = false e ocultoDoPar = false são o padrão).
 * 4. Esconder uma conta: ImportBatch.ocultoDoPar, em Contas e cartões.
 * 5. Esconder um gasto: MonthlyEntry.soMeu, no lançamento aberto.
 * 6. O que é escondido some do app do outro e dos totais dele: `doOutroVisivel` tira os dois. A
 *    renda (entrada) da titular também some para o par: ele só vê a proporção, no acerto.
 * 7. Um orçamento só, o da casa (o da titular). Só quem gastou edita ou apaga: toda escrita
 *    continua filtrando por userId + profileId de quem está logado (doDono), então o lançamento
 *    do outro nunca casa com um update ou delete.
 * 8. Se alguém sair, cada um fica com os próprios gastos: nada foi copiado, então nada precisa
 *    ser devolvido.
 */

export type Letra = "A" | "B";

export type PessoaDaCasa = {
  userId: string;
  /** O Pessoal desta pessoa que faz parte da casa. */
  profileId: string;
  /** A letra no acerto (a mesma de MonthlyEntry.pessoa no Nós dois de antes). */
  letra: Letra;
  /** O primeiro nome que aparece no filtro e na bolinha. */
  nome: string;
  /** A cor: quem paga o Casal fica com o destaque do tema; o par, com o azul acinzentado. */
  papel: "titular" | "par";
};

/** A casa de quem está logado, do ponto de vista dele. */
export type CasaNaSessao = {
  membroId: string;
  /** O perfil Casal antigo da titular: guarda os nomes, o jeito de dividir e os meses acertados. */
  casalProfileId: string;
  eu: PessoaDaCasa;
  outro: PessoaDaCasa;
  /** Quem está logado já viu o "Como funciona o casal" (lib/casa/tutorial.ts). */
  tutorialVisto?: boolean;
  /** A casa veio do Nós dois antigo (MembroCasal.migradoEm preenchido). */
  migrada?: boolean;
  /** Quem está logado já viu o "O casal ficou mais simples" (lib/casa/aviso-migracao.ts). */
  avisoMigracaoVisto?: boolean;
};

/** O que as telas de cliente sabem da casa: só nomes e cores, nunca ids. */
export type CasaNaTela = { eu: { nome: string; papel: "titular" | "par" }; outro: { nome: string; papel: "titular" | "par" } };

export function casaNaTela(c: CasaNaSessao | null | undefined): CasaNaTela | null {
  if (!c) return null;
  return { eu: { nome: c.eu.nome, papel: c.eu.papel }, outro: { nome: c.outro.nome, papel: c.outro.papel } };
}

/** O pedaço do AuthContext que a leitura precisa. */
export type QuemLe = { userId: string; profileId: string; casa?: CasaNaSessao | null };

/**
 * A casa vale na tela de agora? Só no Pessoal que faz parte dela: se a titular troca para a
 * Empresa, a Empresa continua só dela.
 */
export function casaAtiva(q: QuemLe): CasaNaSessao | null {
  const c = q.casa;
  if (!c) return null;
  if (c.eu.userId !== q.userId || c.eu.profileId !== q.profileId) return null;
  if (c.outro.userId === q.userId) return null;
  return c;
}

/** A conta (lote de importação) visível para o par: sem lote (lançado à mão) ou com a conta ligada. */
const contaVisivel: Prisma.MonthlyEntryWhereInput = {
  OR: [{ importBatchId: null }, { importBatch: { is: { ocultoDoPar: false } } }],
};

/**
 * O que o OUTRO deixou visível para mim: o Pessoal dele, sem o "Só meu" e sem as contas que ele
 * desligou. Nunca o resto dos perfis dele (a Empresa dele não passa por aqui).
 */
export function doOutroVisivel(casa: CasaNaSessao): Prisma.MonthlyEntryWhereInput {
  const base: Prisma.MonthlyEntryWhereInput = { userId: casa.outro.userId, profileId: casa.outro.profileId, soMeu: false, AND: [contaVisivel] };
  // Regra da dona: a renda da titular o par NÃO vê, só a proporção (o acerto calcula no servidor,
  // por `lancamentosDoAcertoDaCasa`). Fica de fora de toda lista e de todo total do par, sem
  // depender de a titular marcar "Só meu" (leva de 14/10/2026).
  return casa.outro.papel === "titular" ? { ...base, category: { not: "INCOME" } } : base;
}

/**
 * Os lançamentos que quem olha VÊ: os dele (todos, inclusive o que ele escondeu, que aparece com
 * cadeado) e os do outro que estão visíveis. Sem casa, exatamente o filtro de sempre.
 */
export function lancamentosParaVer(q: QuemLe): Prisma.MonthlyEntryWhereInput {
  const casa = casaAtiva(q);
  const meus = { userId: q.userId, profileId: q.profileId };
  if (!casa) return meus;
  return { OR: [meus, doOutroVisivel(casa)] };
}

/**
 * Os lançamentos dos TOTAIS do Resumo e do Orçamento, para quem olha: os dele inteiros (o "Só
 * meu" dele é dinheiro dele, conta para ele) e os do outro visíveis. O "Só meu" do outro nunca
 * entra, nem somado.
 */
export const lancamentosDosTotais = lancamentosParaVer;

/**
 * O que entra no ACERTO do mês: só o que os dois enxergam. O "Só meu" e as contas escondidas de
 * QUALQUER um dos dois ficam de fora, para os dois verem o mesmo número.
 */
export function lancamentosDoAcertoDaCasa(casa: CasaNaSessao): Prisma.MonthlyEntryWhereInput {
  const visivel = (p: PessoaDaCasa): Prisma.MonthlyEntryWhereInput => ({ userId: p.userId, profileId: p.profileId, soMeu: false, AND: [contaVisivel] });
  return { OR: [visivel(casa.eu), visivel(casa.outro)] };
}

/**
 * Junta o filtro de quem olha com o resto da consulta sem um apagar o outro: os dois podem ter
 * OR (os meses, por exemplo), e espalhar um objeto por cima do outro perderia um deles.
 */
export function comFiltro(base: Prisma.MonthlyEntryWhereInput, resto: Prisma.MonthlyEntryWhereInput): Prisma.MonthlyEntryWhereInput {
  // Sem casa a base é só { userId, profileId }: a consulta sai idêntica à de antes.
  const conflita = Object.keys(base).some((k) => k === "OR" || k === "AND" || k === "NOT" || k in resto);
  return conflita ? { AND: [base, resto] } : { ...base, ...resto };
}

/**
 * Os Pessoais cujos lançamentos entram nos totais de quem olha: só o dele, ou os dois da casa.
 * Serve para dar NOME às categorias que ele criou e às do outro que aparecem nos totais (o gasto
 * do par numa categoria dele vinha como "Outro" no ranking de quem olha). Só nomes: o filtro dos
 * lançamentos continua sendo `lancamentosDosTotais`.
 */
export function perfisDosTotais(q: QuemLe): { userId: string; profileId: string }[] {
  const casa = casaAtiva(q);
  const eu = { userId: q.userId, profileId: q.profileId };
  if (!casa) return [eu];
  return [eu, { userId: casa.outro.userId, profileId: casa.outro.profileId }];
}

/** De quem é o orçamento que vale: o da casa (o Pessoal da titular) ou, sem casa, o de quem olha. */
export function donoDoOrcamento(q: QuemLe): { userId: string; profileId: string } {
  const casa = casaAtiva(q);
  if (!casa) return { userId: q.userId, profileId: q.profileId };
  const titular = casa.eu.papel === "titular" ? casa.eu : casa.outro;
  return { userId: titular.userId, profileId: titular.profileId };
}

/**
 * De quem são as respostas aos avisos do orçamento da casa (14/10/2026, lib/avisos): o orçamento é
 * um só, então "cobri Lazer" de um tira o "Lazer passou" do outro. Só os dois Pessoais da casa;
 * quem lê guarda do outro apenas as respostas sobre categoria do orçamento (nunca meta, reserva,
 * Dinheiro perdido ou o que é dele). Sem casa, só quem olha.
 */
export function donosDasRespostasDoOrcamento(q: QuemLe): { userId: string; profileId: string }[] {
  const casa = casaAtiva(q);
  const eu = { userId: q.userId, profileId: q.profileId };
  if (!casa) return [eu];
  return [eu, { userId: casa.outro.userId, profileId: casa.outro.profileId }];
}

/** Quem gastou, pelo dono do registro: "eu", "outro", ou nulo fora de uma casa. */
export function quemGastou(q: QuemLe, linha: { userId: string }): "eu" | "outro" | null {
  const casa = casaAtiva(q);
  if (!casa) return null;
  if (linha.userId === casa.eu.userId) return "eu";
  if (linha.userId === casa.outro.userId) return "outro";
  return null;
}

/** A letra de quem gastou, para o acerto (no simples, o dono do registro decide, não a coluna pessoa). */
export function letraDoDono(casa: CasaNaSessao, userId: string): Letra | null {
  if (userId === casa.eu.userId) return casa.eu.letra;
  if (userId === casa.outro.userId) return casa.outro.letra;
  return null;
}

/** "nubank-outubro.pdf" vira "nubank outubro": o nome do arquivo é o que ela reconhece. */
export function nomeDoArquivo(f: string | null, padrao: string): string {
  return f ? f.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || padrao : padrao;
}

/**
 * A conta de um lote: o tipo (extrato ou cartão) e a primeira palavra do arquivo ("nubank"). É
 * o mesmo agrupamento que a tela Contas e cartões já fazia. O SPI não tem cadastro de conta: o
 * que ela reconhece é o banco do arquivo que trouxe. O Open Finance entra como "conta" pelo nome
 * da conexão ("Nubank · 12/10/2026").
 */
export function chaveDaConta(docType: string, fileName: string | null): string {
  const tipo = docType === "fatura" ? "cartao" : "conta";
  const primeira = nomeDoArquivo(fileName, tipo === "cartao" ? "fatura" : "extrato")
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return `${tipo}:${primeira || "sem-nome"}`;
}

export function outraLetra(l: Letra): Letra {
  return l === "A" ? "B" : "A";
}

// ---------------------------------------------------------------------------------------------
// "Da casa" (decisão da dona em 13/10/2026): só o que é da casa entra no acerto.
// ---------------------------------------------------------------------------------------------

/**
 * O lançamento como a casa enxerga. A escolha mora em MonthlyEntry.doCasal, que já existia no Nós
 * dois, com o mesmo sentido de "visibilidade":
 * - soMeu = true          → so_meu: escondido do par (nem aparece para ele);
 * - doCasal = true        → casal: da casa, entra no acerto;
 * - doCasal = false       → pessoal_visivel: meu, o par vê mas não entra no acerto;
 * - doCasal = nulo        → ainda sem escolha: a regra aprendida do comerciante ou o automático.
 * - doPar = true          → do par de quem lançou ("Do Lucas"): fora da casa (ver lib/casa/escolhas.ts).
 */
export type LinhaDaCasa = {
  category: string;
  parentCategory: string | null;
  subcategory: string | null;
  description: string | null;
  doCasal: boolean | null;
  soMeu: boolean;
  /** "Do par" (15/10/2026): o gasto é do outro, nunca da casa. */
  doPar?: boolean;
};

/** Supermercado pelo nome, para o que veio do extrato sem subcategoria. */
const MERCADO = /\b(super ?mercado|mercado|mercadinho|hortifruti|sacolao|atacadao|assai|carrefour|pao de acucar|extra|dia supermercado|guanabara|zaffari|savegnago|bh supermercados|st marche|oba hortifruti)\b/;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Da casa automático: Moradia inteira (aluguel, condomínio, IPTU, luz, água, gás, internet) e
 * Alimentação › Supermercado (pela subcategoria ou pelo nome do mercado).
 */
export function daCasaAutomatico(l: Pick<LinhaDaCasa, "parentCategory" | "subcategory" | "description">): boolean {
  if (l.parentCategory === "MORADIA") return true;
  if (l.parentCategory !== "ALIMENTACAO") return false;
  if (l.subcategory && semAcento(l.subcategory).includes("supermercado")) return true;
  return MERCADO.test(semAcento(l.description ?? ""));
}

/** A chave do comerciante para aprender (a mesma da regra de categoria). */
export function chaveDaRegraDaCasa(descricao: string | null | undefined): string {
  return chaveDoComerciante(descricao).slice(0, 80);
}

/**
 * É da casa? Só gasto e nunca o "Só meu". A escolha feita no lançamento manda; sem ela, o que o
 * app aprendeu com o comerciante; sem isso, o automático.
 */
export function ehDaCasa(l: LinhaDaCasa, aprendidas: ReadonlyMap<string, boolean> = new Map()): boolean {
  if (l.category !== "EXPENSE" || l.soMeu || l.doPar) return false;
  if (l.doCasal === true) return true;
  if (l.doCasal === false) return false;
  const chave = chaveDaRegraDaCasa(l.description);
  if (chave && aprendidas.has(chave)) return aprendidas.get(chave)!;
  return daCasaAutomatico(l);
}
