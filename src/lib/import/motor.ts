import type { ParentCategory } from "@prisma/client";
import { categoriaDoBancoParaOApp } from "./categoria-do-banco";
import { classifyDictionaryOnly, classifyLearnedOnly, textoDoDicionario, type Classification, type LearnedRule } from "./classify";
import { categoriaNaFrenteDaDescricao } from "./comerciante";
import { classificarPelaComunidade, perfilDaBase } from "./comunidade";
import { pareceComida } from "./parece-comida";
import { chaveDeIguais } from "./revisao-em-grupo";

/**
 * A ordem do motor de categorias da importação (12/10/2026), num lugar só:
 *
 * 1. A regra que ELA ensinou (inclusive a categoria que ela criou, como "Dani Invest").
 * 2. A base comunitária, só com alta confiança (70%+ dos votos e 3+ pessoas, ver comunidade.ts).
 * 3. O ramo que o banco escreveu no arquivo, na pessoa física: a linha "alimentação SAO PAULO" da
 *    fatura do Itaú, a coluna "Categoria"/"MCC" do CSV (C6, Inter, Nubank) e o "22h21 Alimentação"
 *    do extrato do BTG. Quando o dicionário concorda, a subcategoria dele vem junto.
 * 4. O dicionário do app (dicionario.ts).
 * 5. O nome com cara de comida ("Sabor da Terra", "Cozinha da Vó"), na pessoa física: confiança
 *    média, entra separado com o porquê (parece-comida.ts).
 * 6. Nada: vira pergunta, agrupada por comerciante na tela.
 *
 * A personalizada da regra só vale se ainda existe no perfil (`personalizadas`): apagada, a regra
 * cai para a categoria-mãe de reserva.
 */
export type OrigemDaCategoria = "dela" | "comunidade" | "banco" | "dicionario" | "parece_comida";

export function categorizarLinha(entrada: {
  descricao: string;
  regras: LearnedRule[];
  profileKind?: string | null;
  categoriaDoBanco?: string | null;
  /** Saída de dinheiro: a comunidade só fala de gasto (o estorno usa as outras camadas). */
  gasto: boolean;
  personalizadas?: Set<string>;
}): { classificacao: Classification; origem: OrigemDaCategoria } | null {
  const { descricao, regras, profileKind, gasto } = entrada;
  const dela = classifyLearnedOnly(descricao, regras);
  if (dela) {
    if (dela.customCategoryId && entrada.personalizadas && !entrada.personalizadas.has(dela.customCategoryId)) delete dela.customCategoryId;
    return { classificacao: dela, origem: "dela" };
  }
  const daComunidade: ParentCategory | null = gasto ? classificarPelaComunidade(descricao, perfilDaBase(profileKind)) : null;
  if (daComunidade) {
    // A subcategoria do dicionário entra junto quando ele concorda com a comunidade.
    const doDicionario = classifyDictionaryOnly(descricao, profileKind);
    // Concordando, o dicionário afina: a subcategoria e, na Natura (a comunidade diz Outros), o
    // "Cuidado pessoal" dela.
    if (doDicionario?.parentCategory === daComunidade) return { classificacao: doDicionario, origem: "comunidade" };
    return { classificacao: { parentCategory: daComunidade }, origem: "comunidade" };
  }
  const pessoal = profileKind !== "EMPRESA";
  const doDicionario = classifyDictionaryOnly(descricao, profileKind);
  const ramo = entrada.categoriaDoBanco || categoriaNaFrenteDaDescricao(descricao);
  const doBanco = pessoal ? categoriaDoBancoParaOApp(ramo) : null;
  if (doBanco) {
    // Concordando, o dicionário afina (subcategoria), como na comunidade.
    if (doDicionario?.parentCategory === doBanco) return { classificacao: doDicionario, origem: "banco" };
    return { classificacao: { parentCategory: doBanco }, origem: "banco" };
  }
  if (doDicionario) return { classificacao: doDicionario, origem: "dicionario" };
  // Na Empresa, Alimentação é "Mercadorias e insumos": o palpite pelo nome não vale lá.
  const comida = pessoal && gasto ? pareceComida(textoDoDicionario(descricao)) : null;
  return comida ? { classificacao: comida, origem: "parece_comida" } : null;
}

/**
 * O contrato com a tela de revisão (12/10/2026): para cada linha, a categoria, o MOTIVO e a
 * confiança. Confiança alta entra separada sozinha (com "Revisar"); baixa vira pergunta,
 * agrupada por comerciante (revisao-em-grupo.ts: filaPorComerciante).
 *
 * Motivos:
 * - "regra_sua": ela já respondeu esse comerciante antes (regra aprendida, inclusive personalizada).
 * - "comunidade": a base comunitária (3+ pessoas, 70%+ de acordo).
 * - "ramo_do_banco": o ramo da loja que o banco escreveu no arquivo (coluna Categoria/MCC, linha de
 *   categoria do Itaú, "22h21 Alimentação" do BTG).
 * - "dicionario": o dicionário do app (nome de loja, rede ou tipo de lugar).
 * - "parece_comida": o nome tem cara de comida e nada diz o contrário. Confiança MÉDIA: entra
 *   separado, com o porquê à vista para ela trocar se não for.
 * - "mesmo_nome": ela respondeu outra linha do MESMO comerciante nesta importação (ver respostaParaOGrupo).
 * - "investimento": dinheiro indo pra aplicação/caixinha (vira guardado, não gasto).
 * - "devolucao": estorno; desconta da categoria da compra (sem categoria reconhecida, Outros).
 * - "pergunta": o motor não sabe; a tela pergunta.
 */
export type MotivoDaCategoria =
  | "regra_sua"
  | "comunidade"
  | "ramo_do_banco"
  | "dicionario"
  | "parece_comida"
  | "mesmo_nome"
  | "investimento"
  | "devolucao"
  | "pergunta";
export type ConfiancaDaCategoria = "alta" | "media" | "baixa";
export type CategoriaDaLinha = { categoria: Classification | null; motivo: MotivoDaCategoria; confianca: ConfiancaDaCategoria };

const MOTIVO_DA_ORIGEM: Record<OrigemDaCategoria, MotivoDaCategoria> = {
  dela: "regra_sua",
  comunidade: "comunidade",
  banco: "ramo_do_banco",
  dicionario: "dicionario",
  parece_comida: "parece_comida",
};

export function categoriaDaLinha(entrada: {
  descricao: string;
  regras: LearnedRule[];
  profileKind?: string | null;
  categoriaDoBanco?: string | null;
  /** Saída de dinheiro que é gasto (na fatura, a compra; no extrato, o débito). */
  gasto: boolean;
  /** Crédito que devolve uma compra (estorno). */
  estorno?: boolean;
  /** Saída que é aplicação (pareceAplicacao, em dinheiro-proprio.ts). */
  investimento?: boolean;
  personalizadas?: Set<string>;
}): CategoriaDaLinha {
  if (entrada.investimento) return { categoria: null, motivo: "investimento", confianca: "alta" };
  const achada = entrada.gasto || entrada.estorno ? categorizarLinha({ ...entrada, gasto: entrada.gasto }) : null;
  if (entrada.estorno) return { categoria: achada?.classificacao ?? { parentCategory: "OUTROS" }, motivo: "devolucao", confianca: "alta" };
  if (!achada) return { categoria: null, motivo: "pergunta", confianca: "baixa" };
  return { categoria: achada.classificacao, motivo: MOTIVO_DA_ORIGEM[achada.origem], confianca: achada.origem === "parece_comida" ? "media" : "alta" };
}

/**
 * Ela respondeu uma linha: as outras do MESMO comerciante nesta importação (de qualquer arquivo
 * do lote) que ainda eram pergunta, ou que o motor tinha separado sozinho, recebem a mesma
 * categoria com motivo "mesmo_nome". Nunca mexe na que ela mesma respondeu.
 */
export function respostaParaOGrupo<T extends { descricao: string; resultado: CategoriaDaLinha }>(
  linhas: T[],
  respondida: number,
  categoria: Classification,
  chave: (descricao: string) => string | null = chaveDeIguais,
): T[] {
  const alvo = chave(linhas[respondida]?.descricao ?? "");
  return linhas.map((l, i) => {
    if (i === respondida) return { ...l, resultado: { categoria, motivo: "regra_sua", confianca: "alta" } };
    if (!alvo || chave(l.descricao) !== alvo || l.resultado.motivo === "regra_sua" || l.resultado.motivo === "mesmo_nome") return l;
    if (l.resultado.motivo === "investimento" || l.resultado.motivo === "devolucao") return l;
    return { ...l, resultado: { categoria, motivo: "mesmo_nome", confianca: "alta" } };
  });
}
