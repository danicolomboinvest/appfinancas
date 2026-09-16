import type { SheetType } from "@prisma/client";

/**
 * O checklist de TRÊS TOQUES: o que só a pessoa consegue responder sobre um ativo.
 *
 * Sócios, polêmicas, Reclame Aqui, Glassdoor — nenhum scraper responde isso. A ficha antiga
 * pedia, pra cada um, "Observação + Nota 0–10 + Comentário"; era ali que a aluna desistia.
 * Aqui cada pergunta tem três respostas possíveis e diz onde olhar. A resposta vai pro mesmo
 * AnalysisResponse.value de sempre, então nada do que já foi salvo se perde.
 */

export const CHECKLIST_ANSWERS = [
  { value: "tranquilo", label: "Tranquila", tone: "success" },
  { value: "nao_sei", label: "Não sei", tone: "neutral" },
  { value: "vi_algo", label: "Vi algo", tone: "danger" },
] as const;

export type ChecklistAnswer = (typeof CHECKLIST_ANSWERS)[number]["value"];

export function isChecklistAnswer(value: string | null | undefined): value is ChecklistAnswer {
  return CHECKLIST_ANSWERS.some((a) => a.value === value);
}

/** Quais categorias do catálogo são "de gente" (sem régua automática), por tipo de ficha. */
export const HUMAN_CATEGORIES: Record<SheetType, string[]> = {
  STOCK: ["Qualitativo"],
  STOCK_INTL: ["Qualitativo"],
  ETF: ["Qualitativo"],
  FII: ["COMUM", "TIJOLO", "PAPEL"],
};

/**
 * A pergunta em português pra cada critério, com o "onde olhar". Quem não está aqui usa o
 * rótulo do catálogo como pergunta e o helpText como pista — nada fica sem pergunta.
 */
export const QUESTION_BY_KEY: Record<string, { question: string; where: string }> = {
  // Ações (BR e exterior)
  socios_majoritarios: { question: "Quem manda na empresa te deixa tranquila?", where: "Página de RI, seção 'composição acionária'" },
  historico_polemicas: { question: "Achou polêmica recente?", where: "Busque o nome + 'investigação' ou 'processo'" },
  satisfacao_funcionarios: { question: "Quem trabalha lá fala bem?", where: "Glassdoor" },
  satisfacao_clientes: { question: "Quem compra dela fala bem?", where: "Reclame Aqui" },
  qualidade_ri: { question: "A empresa explica bem o que faz?", where: "Site de RI: tem release trimestral claro?" },
  perenidade: { question: "Daqui a 10 anos ela ainda vai existir?", where: "Pense: o produto dela pode sumir?" },
  riscos: { question: "Depende de algo que pode virar (governo, dólar, uma lei)?", where: "Seção 'fatores de risco' do release" },
  vantagens_competitivas: { question: "Tem algo que a concorrência não copia fácil?", where: "Marca, escala, patente, custo de troca" },
  momento_empresa: { question: "Está crescendo, madura ou em dificuldade?", where: "Últimos releases trimestrais" },
  tag_along: { question: "Se venderem a empresa, o minoritário recebe igual? (tag along 100%)", where: "B3 › empresa › estatuto" },
  free_float: { question: "Tem ação suficiente circulando no mercado?", where: "B3 ou site de RI (free float)" },
  liquidez: { question: "Dá pra vender rápido se precisar?", where: "Volume médio diário" },
  exposicao_cambial: { question: "Você aceita que o dólar mexa no seu retorno?", where: "Ativo no exterior: o retorno em reais varia com o câmbio" },

  // FIIs
  mandato: { question: "Você entendeu o que o fundo faz com o dinheiro?", where: "Regulamento ou relatório gerencial, 1ª página" },
  segmento: { question: "O segmento dele faz sentido pra você?", where: "Lajes, galpões, shoppings, recebíveis…" },
  tipo_gestao: { question: "Gestão ativa ou passiva — e você sabe a diferença?", where: "Relatório gerencial" },
  administrador_gestor: { question: "Quem administra tem histórico limpo?", where: "Busque o nome da gestora + 'CVM'" },
  historico_proventos: { question: "Os rendimentos são constantes ou dão sustos?", where: "Funds Explorer, últimos 12 meses" },
  qualidade_imoveis: { question: "Os imóveis são bons e bem localizados?", where: "Relatório gerencial, fotos e endereços" },
  qualidade_inquilinos: { question: "Os inquilinos são empresas sólidas?", where: "Relatório gerencial, principais locatários" },
  diversificacao_inquilinos: { question: "Depende de poucos inquilinos?", where: "Relatório gerencial, % de receita por locatário" },
  tipologia_contratos: { question: "Os contratos são longos e difíceis de quebrar?", where: "Típico × atípico, no relatório" },
  vencimento_contratos: { question: "Muitos contratos vencem em breve?", where: "Relatório gerencial, cronograma de vencimentos" },
  alavancagem: { question: "O fundo tem dívida grande?", where: "Relatório gerencial, 'alavancagem' ou 'CRI emitido'" },
  nivel_risco_operacoes: { question: "Os papéis têm boa nota de crédito?", where: "Relatório gerencial, rating dos CRIs" },
  diversificacao_operacoes: { question: "Depende de poucos devedores?", where: "Relatório gerencial, concentração por devedor" },
  estrutura_garantias: { question: "Se um devedor falhar, tem garantia?", where: "Relatório gerencial, garantias" },
  subordinacao: { question: "O fundo está na parte protegida da estrutura?", where: "Cotas sênior × subordinadas, no relatório" },

  // ETFs
  indice_referencia: { question: "Você sabe que índice ele copia?", where: "Página do ETF na B3 ou do gestor" },
  metodo_replicacao: { question: "Ele compra os ativos de verdade ou usa derivativos?", where: "Regulamento: réplica física × sintética" },
  gestora: { question: "Quem administra é conhecido?", where: "BlackRock, Itaú, XP…" },
  setor_geografia: { question: "Está concentrado num setor ou país só?", where: "Composição da carteira" },
  data_inicio: { question: "Existe há tempo suficiente pra ter histórico?", where: "Data de início do fundo" },
  concentracao_carteira: { question: "Poucos ativos pesam demais na carteira?", where: "Top 10 posições" },
};

export function questionFor(key: string, label: string, helpText: string | null): { question: string; where: string | null } {
  const q = QUESTION_BY_KEY[key];
  if (q) return q;
  return { question: label, where: helpText };
}
