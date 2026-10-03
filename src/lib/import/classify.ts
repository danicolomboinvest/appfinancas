import type { ParentCategory, ProfileKind } from "@prisma/client";

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
 * os dois). Hoje a regra gravada no banco ainda não guarda a personalizada — falta o campo em
 * TransactionCategoryRule —, então nenhuma regra chega com ele; o classificador já está pronto
 * pra quando chegar.
 */
export type Classification = { parentCategory: ParentCategory; subcategory?: string; customCategoryId?: string };
export type LearnedRule = { pattern: string; parentCategory: ParentCategory; subcategory?: string; customCategoryId?: string };

/** `revisar`: a palavra é ambígua demais nesse perfil; para aqui e manda pra revisão. */
type BuiltinRule = { keywords: string[]; parentCategory: ParentCategory; subcategory?: string } | { keywords: string[]; revisar: true };

// Palavras que as duas listas usam do mesmo jeito (conta de casa e conta da empresa são as mesmas).
const KW_IMPOSTO = ["imposto", "tributo", "darf", "iptu", "ipva", "dae", "receita federal", "irpf"];
const KW_APLICATIVO = ["uber", "ubertrip", "uberrides", "99app", "99pop", "99 taxi", "99 tecnologia", "cabify", "taxi", "táxi"];
const KW_COMBUSTIVEL = ["posto", "shell", "ipiranga", "petrobras", "combustivel", "combustível", "gasolina", "etanol"];
const KW_ESTACIONAMENTO = ["estacionamento", "estapar", "zona azul"];
const KW_ALUGUEL = ["aluguel", "imobiliaria", "imobiliária"];
const KW_CONDOMINIO = ["condominio", "condomínio"];
// "energia" sozinha não: "BEBIDA ENERGIA", "ENERGIA FITNESS" e loja de energia solar viravam conta
// de luz sem passar pela revisão. No lugar, o nome das distribuidoras e o "conta de luz" do boleto.
const KW_LUZ = [
  "enel", "cpfl", "light", "eletropaulo", "cemig", "copel", "energisa", "neoenergia", "equatorial", "coelba", "celpe",
  "cosern", "celesc", "edp", "conta de luz", "energia eletrica", "energia elétrica",
];
const KW_AGUA = ["sabesp", "sanepar", "copasa", "aegea", "conta de agua", "conta de água"];
// "oi", "tim" e "net" só como palavra solta: como pedaço, "BOI GORDO" virava conta de internet.
const KW_TELEFONIA = ["vivo", "claro", "tim", "oi", "net", "internet", "telefonia"];
const KW_DELIVERY = ["ifood", "rappi", "uber eats", "ubereats", "delivery"];

const BUILTIN_RULES: BuiltinRule[] = [
  // Impostos primeiro: "PAGAMENTO IMPOSTO DE RENDA" não pode ser pego por nenhuma regra de consumo.
  // Cada imposto na sua subcategoria (a lista de Impostos tem IPVA, IPTU, DARF separados): antes
  // tudo virava "Imposto de renda" e o IPVA do carro aparecia como imposto de renda no mês.
  { keywords: ["ipva"], parentCategory: "IMPOSTOS", subcategory: "IPVA" },
  { keywords: ["iptu"], parentCategory: "IMPOSTOS", subcategory: "IPTU" },
  { keywords: ["imposto de renda", "irpf", "receita federal"], parentCategory: "IMPOSTOS", subcategory: "Imposto de renda" },
  { keywords: ["darf"], parentCategory: "IMPOSTOS", subcategory: "DARF" },
  // "IMPOSTO", "TRIBUTO", "DAE" soltos: é imposto, mas qual só ela sabe. Fica sem subcategoria.
  // DAS do MEI: 5 clientes escolheram Impostos pra "Simples Nacional" (out/2026).
  { keywords: ["simples nacional"], parentCategory: "IMPOSTOS", subcategory: "Taxas públicas" },
  { keywords: KW_IMPOSTO, parentCategory: "IMPOSTOS" },
  // Alimentação
  { keywords: KW_DELIVERY, parentCategory: "ALIMENTACAO", subcategory: "Delivery" },
  // "lanche" aqui, antes do Lazer: "SHOW DE BOLA LANCHES" é lanchonete, não Cinema/Shows.
  { keywords: ["restaurante", "lanchonete", "lanche", "bar", "pizzaria", "pizza", "almoco", "almoço", "hamburgueria", "mcdonald", "mc donald", "burger king", "bk", "subway", "outback", "cafe", "café", "cafeteria", "padaria", "confeitaria"], parentCategory: "ALIMENTACAO", subcategory: "Restaurante" },
  // "mercado" sozinho; Mercado Pago e Mercado Livre viram uma palavra só antes (ver textoParaRegras).
  { keywords: ["supermercado", "mercado", "atacadao", "atacadão", "carrefour", "pao de acucar", "pão de açúcar", "assai", "assaí", "hortifruti", "sacolao"], parentCategory: "ALIMENTACAO", subcategory: "Supermercado" },
  // Transporte
  { keywords: KW_APLICATIVO, parentCategory: "TRANSPORTE", subcategory: "Aplicativo" },
  { keywords: KW_COMBUSTIVEL, parentCategory: "TRANSPORTE", subcategory: "Combustível" },
  { keywords: KW_ESTACIONAMENTO, parentCategory: "TRANSPORTE", subcategory: "Estacionamento" },
  // Tag de pedágio: 4 clientes escolheram Transporte pra "Sem Parar" (out/2026).
  { keywords: ["sem parar", "semparar", "conectcar", "veloe", "pedagio", "pedágio"], parentCategory: "TRANSPORTE", subcategory: "Pedágio" },
  { keywords: ["metro", "metrô", "cptm", "bilhete unico", "bilhete único", "sptrans", "onibus", "ônibus", "brt"], parentCategory: "TRANSPORTE", subcategory: "Transporte público" },
  // Saúde. "raia" e "pacheco" sozinhos pegavam PRAIA e qualquer JOAO PACHECO de Pix.
  { keywords: ["farmacia", "farmácia", "drogaria", "drogasil", "droga raia", "drogaraia", "raiadrogasil", "drogariasaopaulo", "drogasaopaulo", "pague menos", "paguemenos"], parentCategory: "SAUDE", subcategory: "Farmácia" },
  { keywords: ["unimed", "amil", "bradesco saude", "sulamerica saude", "plano de saude", "hapvida"], parentCategory: "SAUDE", subcategory: "Plano de saúde" },
  { keywords: ["hospital", "clinica", "clínica", "laboratorio", "laboratório", "consultorio", "consultório", "dentista", "exame"], parentCategory: "SAUDE", subcategory: "Consultas" },
  // Psicóloga e terapia: clientes escolhiam Saúde à mão toda vez (out/2026).
  { keywords: ["psicologa", "psicóloga", "psicologo", "psicólogo", "psicologia", "terapia", "terapeuta"], parentCategory: "SAUDE", subcategory: "Terapia" },
  { keywords: ["academia", "smartfit", "smart fit", "gympass", "wellhub"], parentCategory: "SAUDE", subcategory: "Academia" },
  // Lazer
  { keywords: ["netflix", "spotify", "disney", "disneyplus", "hbo", "hbomax", "max com", "amazon prime", "amazonprime", "prime video", "primevideo", "youtube premium", "youtubepremium", "deezer", "globoplay", "paramount", "apple tv"], parentCategory: "LAZER", subcategory: "Streaming" },
  { keywords: ["cinema", "cinemark", "ingresso", "teatro", "show", "sympla", "ticket"], parentCategory: "LAZER", subcategory: "Cinema/Shows" },
  // "azul" e "gol" sozinhos não: são sobrenome e palavra comum, e o Pix pra "ANA AZUL" virava
  // Viagens sem passar pela revisão. Só o nome da companhia como aparece na fatura.
  { keywords: ["hotel", "airbnb", "booking", "hospedagem", "passagem", "latam", "gol linhas", "gol transportes", "voegol", "azul linhas", "azul viagens", "voeazul", "cvc"], parentCategory: "LAZER", subcategory: "Viagens" },
  // Moradia
  { keywords: KW_ALUGUEL, parentCategory: "MORADIA", subcategory: "Aluguel" },
  { keywords: KW_CONDOMINIO, parentCategory: "MORADIA", subcategory: "Condomínio" },
  { keywords: KW_LUZ, parentCategory: "MORADIA", subcategory: "Luz" },
  { keywords: KW_AGUA, parentCategory: "MORADIA", subcategory: "Água" },
  { keywords: KW_TELEFONIA, parentCategory: "MORADIA", subcategory: "Internet" },
  // Educação
  { keywords: ["escola", "faculdade", "universidade", "curso", "udemy", "alura", "mensalidade", "colegio", "colégio"], parentCategory: "EDUCACAO", subcategory: "Mensalidade" },
  // Hubla é a plataforma onde se vende curso online (inclusive o da Dani): 13 clientes tinham
  // "HUBLA*DANICOLOMBO" na fatura e escolheram Educação em 76 de 89 vezes (out/2026).
  { keywords: ["hubla", "hotmart", "kiwify", "eduzz"], parentCategory: "EDUCACAO", subcategory: "Cursos" },
  // "amazon" sozinho não: é marketplace de tudo (eletrônico, casa, mercado). Vai pra revisão.
  { keywords: ["livraria", "kindle", "livro"], parentCategory: "EDUCACAO", subcategory: "Livros/Material" },
  // Outros: tarifa de banco, seguro, juros — o que sobra
  { keywords: ["tarifa", "anuidade", "iof", "juros", "seguro", "emprestimo", "empréstimo"], parentCategory: "OUTROS", subcategory: "Tarifas bancárias" },
  // Extrato do Nubank: "Aplicação RDB" é dinheiro indo pra caixinha/investimento, não gasto do dia a dia.
  { keywords: ["aplicação rdb", "aplicacao rdb", "aplicação cdb", "aplicacao cdb", "tesouro direto", "aplicação em"], parentCategory: "OUTROS", subcategory: "Investimento" },
];

/**
 * Perfil Empresa: as mesmas oito chaves significam outra coisa (ALIMENTACAO é "Mercadorias e
 * insumos", SAUDE é "Equipe e pró-labore", LAZER é "Serviços e terceiros", EDUCACAO é
 * "Marketing e vendas" — ver profiles/empresa.ts). Com as regras da pessoa física, o almoço no
 * iFood virava custo de mercadoria e a farmácia virava folha de pagamento, e a DRE, a margem e
 * o ponto de equilíbrio saíam errados sem passar pela revisão. Aqui só fica o que quer dizer a
 * mesma coisa nos dois mundos; o resto vai pra revisão. As subcategorias são as de
 * CATEGORIAS_EMPRESA (o teste confere), senão aparece um "Delivery" que não existe na lista.
 */
const EMPRESA_RULES: BuiltinRule[] = [
  { keywords: ["das simples", "das mei", "pgdas", "simples nacional"], parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)" },
  { keywords: ["iss", "issqn"], parentCategory: "IMPOSTOS", subcategory: "ISS" },
  { keywords: ["icms"], parentCategory: "IMPOSTOS", subcategory: "ICMS" },
  { keywords: ["alvara", "alvará"], parentCategory: "IMPOSTOS", subcategory: "Alvará e licenças" },
  { keywords: [...KW_IMPOSTO, "irpj", "csll", "cofins"], parentCategory: "IMPOSTOS" },
  // Na empresa, tarifa de banco mora em Impostos e taxas (é assim no plano de contas dela).
  { keywords: ["tarifa", "anuidade", "iof"], parentCategory: "IMPOSTOS", subcategory: "Taxas bancárias" },
  { keywords: ["juros", "multa"], parentCategory: "IMPOSTOS", subcategory: "Multas e juros" },
  { keywords: ["seguro"], parentCategory: "OUTROS", subcategory: "Seguros" },
  { keywords: ["emprestimo", "empréstimo"], parentCategory: "OUTROS", subcategory: "Empréstimos" },
  { keywords: KW_ALUGUEL, parentCategory: "MORADIA", subcategory: "Aluguel" },
  { keywords: KW_CONDOMINIO, parentCategory: "MORADIA", subcategory: "Condomínio" },
  { keywords: KW_LUZ, parentCategory: "MORADIA", subcategory: "Luz" },
  { keywords: KW_AGUA, parentCategory: "MORADIA", subcategory: "Água" },
  { keywords: KW_TELEFONIA, parentCategory: "MORADIA", subcategory: "Internet/Telefone" },
  // Delivery antes do Uber: "UBER EATS" é comida (almoço ou insumo, só ela sabe), não frete.
  { keywords: KW_DELIVERY, revisar: true },
  { keywords: KW_APLICATIVO, parentCategory: "TRANSPORTE", subcategory: "Motoboy/Aplicativo" },
  { keywords: KW_COMBUSTIVEL, parentCategory: "TRANSPORTE", subcategory: "Combustível" },
  { keywords: KW_ESTACIONAMENTO, parentCategory: "TRANSPORTE", subcategory: "Estacionamento" },
  { keywords: ["correios", "sedex"], parentCategory: "TRANSPORTE", subcategory: "Correios" },
];

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
  return paraPalavras(base)
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
    const padrao = normalizeMerchant(l.description);
    if (padrao && padraoAprendivel(padrao)) padroes.add(padrao);
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
function matchLearned(normalized: string, userRules: LearnedRule[]): Classification | null {
  // Palavra inteira: a regra "maria" não pega "MARIANA", "bar" não pega "BARBEARIA".
  const texto = ` ${normalized} `;
  let melhor: LearnedRule | null = null;
  for (const rule of userRules) {
    if (!rule.pattern || !padraoAprendivel(rule.pattern) || !texto.includes(` ${rule.pattern} `)) continue;
    if (!melhor || rule.pattern.length > melhor.pattern.length) melhor = rule;
  }
  if (!melhor) return null;
  const achada: Classification = { parentCategory: melhor.parentCategory, subcategory: melhor.subcategory };
  if (melhor.customCategoryId) achada.customCategoryId = melhor.customCategoryId;
  return achada;
}

function matchBuiltin(description: string, empresa: boolean): Classification | null {
  const texto = textoParaRegras(description);
  for (const { res, rule } of empresa ? EMPRESA : PESSOAL) {
    if (res.some((re) => re.test(texto))) {
      if ("revisar" in rule) return null;
      return { parentCategory: rule.parentCategory, subcategory: rule.subcategory };
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
  return matchLearned(normalizeMerchant(description), userRules);
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
  const normalized = normalizeMerchant(description);
  return matchLearned(normalized, userRules) ?? matchBuiltin(description, profileKind === "EMPRESA");
}
