import type { ParentCategory, ProfileKind } from "@prisma/client";
import { chaveCobre, chaveDoComerciante, chaveUtil } from "./comerciante";
import { DICIONARIO_EMPRESA, DICIONARIO_PESSOAL, type RegraDoDicionario } from "./dicionario";

/**
 * Classificação automática de transações do extrato (item 3). Duas camadas:
 * 1) Regras aprendidas do usuário (merchant → categoria), que têm prioridade, é o "lembrar
 *    para transações parecidas no futuro" do briefing.
 * 2) Regras embutidas por palavra-chave (iFood → Alimentação, Uber → Transporte...).
 * O que nenhuma das duas cobrir volta `null` e cai na fila de revisão.
 *
 * Tudo casa por PALAVRA INTEIRA, nunca por pedaço de texto: com `includes`, "imposto" continha
 * "posto" e virava Combustível, "CAMILA" e "FAMILIA" continham "amil" e viravam Plano de saúde,
 * "PRAIA" continha "raia" e virava Farmácia. E como o que o classificador acerta pula a revisão,
 * o erro ia direto pro total da categoria sem ninguém ver.
 */

/**
 * `customCategoryId`: a categoria que ELA criou ("Pet", "Beleza"). Só vem de regra aprendida, e
 * quando vem ela manda: o `parentCategory` fica como reserva (quem grava usa um ou outro, nunca
 * os dois). Desde 12/10/2026 a regra gravada guarda a personalizada (TransactionCategoryRule.
 * customCategoryId): antes ela escolhia "Dani Invest" pro ManyChat e o app esquecia, porque a
 * regra só sabia guardar as oito categorias fixas.
 */
/**
 * `cuidadoPessoal`: o dicionário reconheceu roupa, calçado ou beleza (Zara, Levi's, salão). Quem
 * grava troca pela categoria "Cuidado pessoal" dela, criando se faltar (cuidado-pessoal.ts); sem
 * isso, fica a reserva Outros › Cuidado pessoal.
 */
export type Classification = { parentCategory: ParentCategory; subcategory?: string; customCategoryId?: string; cuidadoPessoal?: true };
export type LearnedRule = { pattern: string; parentCategory: ParentCategory; subcategory?: string; customCategoryId?: string };

type BuiltinRule = RegraDoDicionario;
const BUILTIN_RULES: BuiltinRule[] = DICIONARIO_PESSOAL;
const EMPRESA_RULES: BuiltinRule[] = DICIONARIO_EMPRESA;

/** Minúsculo, sem acento, letra e número separados, só letras/números/espaço simples. */
function paraPalavras(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "DROGASIL1234" e "99APP" chegam grudados: separar deixa a palavra inteira casar.
    .replace(/([a-z])(?=\d)/g, "$1 ")
    .replace(/(\d)(?=[a-z])/g, "$1 ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * O pedaço da descrição que diz com QUEM foi. O CSV do Nubank traz o banco do outro lado
 * ("Transferência enviada pelo Pix - CAMILA - •••.123.456-•• - PAGSEGURO INTERNET IP (0290)
 * Agência: 1 Conta: 2"), e "INTERNET" virava conta de casa, "MERCADO PAGO" virava supermercado.
 * Corta no CPF/CNPJ e no "Agência:", igual ao cleanDescription do PDF do Nubank.
 */
function textoParaRegras(description: string): string {
  const cpf = description.search(/\s+-\s+([•*]{3}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
  const base = (cpf > -1 ? description.slice(0, cpf) : description)
    .replace(/\s+-\s+[^-]*\(\d{3,4}\)\s*Ag[eê]ncia.*$/i, "")
    .replace(/\s+Ag[eê]ncia:.*$/i, "");
  // Instituição de pagamento não é loja: "mercado pago"/"mercado livre" viram uma palavra só
  // (senão "mercado" casa), e o "internet" da razão social do PagSeguro some.
  // "C&A" viraria "c a", que casa com iniciais de nome: vira "cea", como a fatura também escreve.
  return paraPalavras(base.replace(/\bc\s*&\s*a\b/gi, "cea"))
    .replace(/\bmercado (pago|livre)\b/g, "mercado$1")
    .replace(/\bpag ?seguro internet\b/g, "pagseguro");
}

/** Palavra (ou sequência de palavras) inteira, aceitando o plural ("postos", "farmacias"). */
function palavraInteira(keyword: string): RegExp {
  return new RegExp(`(?:^| )${paraPalavras(keyword)}(?:e?s)?(?= |$)`);
}

type RegraCompilada = { res: RegExp[]; rule: BuiltinRule };
const compilar = (rules: BuiltinRule[]): RegraCompilada[] => rules.map((rule) => ({ res: rule.keywords.map(palavraInteira), rule }));
const PESSOAL = compilar(BUILTIN_RULES);
const EMPRESA = compilar(EMPRESA_RULES);

/**
 * Reduz uma descrição de extrato a uma "chave de comerciante" estável para aprendizado:
 * minúsculo, sem acentos, sem números/datas/pontuação e sem ruído de meio de pagamento.
 * Ex.: "IFOOD *IFD1234 12/05 SAO PAULO" → "ifood".
 */
export function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(compra|pagamento|debito|credito|cartao|pix|ted|doc|parcela|\d+\/\d+)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras que dizem COMO o dinheiro saiu, não pra quem. Uma regra feita só delas ("Compra no
 * débito" vira "no", "PIX ENVIADO" vira "enviado") pegava todo Pix e toda compra no débito
 * dali pra frente, inclusive o iFood e o supermercado.
 */
const PALAVRAS_GENERICAS = new Set([
  "no", "na", "de", "da", "do", "das", "dos", "em", "com", "para", "pra", "pelo", "pela", "via",
  "enviado", "enviada", "enviados", "recebido", "recebida", "transferencia", "transf", "boleto", "efetuado", "efetuada",
  "compra", "pagamento", "pagto", "pgto", "debito", "deb", "credito", "cartao", "pix", "ted", "doc", "saque", "estorno",
  "mc", "visa", "electron", "elo", "master", "mastercard", "maestro", "nupay", "rshop",
  "nu", "pagamentos", "ip", "agencia", "conta", "ltda", "sa", "me", "eireli",
  // Tipo de lugar, não nome: "BAR" aprendido virava a categoria de todo bar.
  "bar", "loja", "posto", "lanche",
]);

/**
 * Se a chave de comerciante serve pra aprender: precisa de ao menos uma palavra que não seja
 * genérica, com 4 letras ou mais no total. "bar", "no" e "enviado" ficam de fora; quem cuida
 * delas é a revisão (ou a regra embutida). Vale na hora de gravar E na hora de aplicar: as
 * regras ruins que já estão no banco param de contaminar sem precisar apagar nada.
 */
export function padraoAprendivel(pattern: string): boolean {
  const proprias = pattern.split(" ").filter((p) => p.length > 1 && !PALAVRAS_GENERICAS.has(p));
  // 3 letras já é nome de verdade (KFC, GOL, ANA): com 4, a correção dela nunca era aprendida.
  return proprias.join("").length >= 3;
}

/** Um lançamento como estava ANTES de ela trocar a categoria na tela do mês. */
export type LinhaCorrigida = {
  description: string | null;
  category: string;
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  /** Veio de extrato/fatura importado ou do Open Finance (importBatchId ou externalId). */
  importada: boolean;
};

/** Teto de regras gravadas numa troca em lote: 200 linhas selecionadas não viram 200 escritas. */
const MAX_PADROES_POR_CORRECAO = 30;

/**
 * Quais padrões a troca de categoria na tela do mês deve ensinar. Antes só a revisão da
 * importação ensinava: consertar depois (no mês, em lote) não mudava nada e a próxima
 * importação repetia o erro. Só aprende de gasto que VEIO de importação ou do Open Finance (o
 * lançado à mão não volta em extrato nenhum) e só quando a categoria mudou de fato: salvar o
 * formulário pra corrigir o valor não pode transformar o palpite do app em regra dela.
 */
export function padroesDaCorrecao(linhas: LinhaCorrigida[], nova: ParentCategory): string[] {
  const padroes = new Set<string>();
  for (const l of linhas) {
    if (!l.importada || l.category !== "EXPENSE" || !l.description) continue;
    if (l.parentCategory === nova && !l.customCategoryId) continue;
    // A chave do comerciante (ver comerciante.ts): vale para o mesmo lugar em qualquer extrato.
    const padrao = chaveDoComerciante(l.description);
    if (chaveUtil(padrao)) padroes.add(padrao);
    if (padroes.size >= MAX_PADROES_POR_CORRECAO) break;
  }
  return [...padroes];
}

/**
 * Entre as regras que casam, vence a mais ESPECÍFICA (o padrão mais comprido), não a primeira
 * da lista. A lista vem do banco sem ordem garantida (e pelo índice único sai em ordem
 * alfabética, onde "uber" vem antes de "uber eats"): a correção dela pra "UBER EATS" virava uma
 * regra nova que perdia pra "uber" genérica, e a categoria corrigida voltava errada na próxima
 * importação. Empate de tamanho fica com a primeira da lista (o repositório manda a mais
 * recente primeiro, ou seja, a última correção dela).
 */
function matchLearned(normalized: string, userRules: LearnedRule[], chave = ""): Classification | null {
  // Palavra inteira: a regra "maria" não pega "MARIANA", "bar" não pega "BARBEARIA".
  // Duas formas de regra convivem: a nova, gravada pela chave do comerciante ("manychat"), que
  // vale quando é o começo da chave da linha; e a antiga (normalizeMerchant, a descrição quase
  // inteira), que vale quando aparece dentro da descrição normalizada.
  const texto = ` ${normalized} `;
  let melhor: LearnedRule | null = null;
  for (const rule of userRules) {
    if (!rule.pattern) continue;
    const pelaChave = chaveUtil(rule.pattern) && chaveCobre(rule.pattern, chave);
    const peloTexto = padraoAprendivel(rule.pattern) && texto.includes(` ${rule.pattern} `);
    if (!pelaChave && !peloTexto) continue;
    if (!melhor || rule.pattern.length > melhor.pattern.length) melhor = rule;
  }
  if (!melhor) return null;
  const achada: Classification = { parentCategory: melhor.parentCategory, subcategory: melhor.subcategory };
  if (melhor.customCategoryId) achada.customCategoryId = melhor.customCategoryId;
  return achada;
}

/** Pix ou transferência: o nome que vem depois é de quem recebeu, muitas vezes uma pessoa. */
const PIX_OU_TRANSFERENCIA = /(?:^| )(?:pix|transferencia|transf|ted)(?= |$)/;

function matchBuiltin(description: string, empresa: boolean): Classification | null {
  const texto = textoParaRegras(description);
  const ehPix = PIX_OU_TRANSFERENCIA.test(paraPalavras(description));
  for (const { res, rule } of empresa ? EMPRESA : PESSOAL) {
    if ("naoEmPix" in rule && rule.naoEmPix && ehPix) continue;
    if (res.some((re) => re.test(texto))) {
      if ("revisar" in rule) return null;
      const achada: Classification = { parentCategory: rule.parentCategory, subcategory: rule.subcategory };
      if (rule.cuidadoPessoal) achada.cuidadoPessoal = true;
      return achada;
    }
  }
  return null;
}

/**
 * Só as regras que ELA ensinou (correções dela), sem as embutidas do app. A importação usa para
 * pôr a correção dela acima da categoria que o banco escreveu, e a do banco acima do palpite
 * embutido do app (ver categoria-do-banco.ts).
 */
export function classifyLearnedOnly(description: string, userRules: LearnedRule[] = []): Classification | null {
  return matchLearned(normalizeMerchant(description), userRules, chaveDoComerciante(description));
}

/** Só o dicionário do app (sem regra dela nem da comunidade). `null` = o dicionário não sabe. */
export function classifyDictionaryOnly(description: string, profileKind?: ProfileKind | string | null): Classification | null {
  return matchBuiltin(description, profileKind === "EMPRESA");
}

/**
 * Classifica uma descrição. Regras aprendidas do usuário vêm primeiro. `null` = revisar.
 * `profileKind` escolhe o jogo de regras embutidas: Empresa não usa o da pessoa física.
 */
export function classify(
  description: string,
  userRules: LearnedRule[] = [],
  profileKind?: ProfileKind | string | null,
): Classification | null {
  return classifyLearnedOnly(description, userRules) ?? matchBuiltin(description, profileKind === "EMPRESA");
}
