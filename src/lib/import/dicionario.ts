import type { ParentCategory } from "@prisma/client";

/**
 * O dicionário do motor: nome de loja, rede ou tipo de lugar → categoria do app.
 *
 * Ampliado em 12/10/2026 (pedido da Dani): sushi, restaurante, mercado, ManyChat e ChatGPT vinham
 * perguntados. O app só deve perguntar o que é difícil de verdade (Pix pra uma pessoa, loja que
 * vende de tudo); o resto entra separado, com a opção de revisar.
 *
 * Como casa: palavra inteira (ou sequência de palavras inteiras), sem acento, sem caixa, aceitando
 * o plural ("farmacias"). Nunca pedaço de palavra: "imposto" contém "posto", "PRAIA" contém
 * "raia", "BARBEARIA" contém "bar". A ordem importa: a primeira regra que casa vence (impostos
 * antes de tudo, delivery antes do Uber, o específico antes do genérico).
 *
 * As subcategorias são as de SUBCATEGORIES (categories.ts) e, na Empresa, as de
 * CATEGORIAS_EMPRESA (o teste confere). "Assinaturas e apps", "Anúncios" e "Cartão de crédito"
 * são subcategoria livre em Outros (a lista aceita "Outro" com texto livre).
 */
export type RegraDoDicionario =
  | { keywords: string[]; parentCategory: ParentCategory; subcategory?: string }
  | { keywords: string[]; revisar: true };

const KW_IMPOSTO = ["imposto", "tributo", "darf", "iptu", "ipva", "dae", "receita federal", "irpf"];
const KW_APLICATIVO = ["uber", "ubertrip", "uberrides", "uber trip", "99app", "99pop", "99 pop", "99 taxi", "99 tecnologia", "99 app", "cabify", "taxi", "táxi", "indriver", "indrive", "patinete", "patinetes", "jet patinetes", "whoosh", "tembici", "bike itau"];
const KW_COMBUSTIVEL = [
  "posto", "auto posto", "shell", "ipiranga", "petrobras", "posto br", "br mania", "raizen", "ale combustiveis",
  "combustivel", "combustível", "gasolina", "etanol", "abastece ai", "abasteceai",
];
const KW_ESTACIONAMENTO = ["estacionamento", "estapar", "zona azul", "indigo estacionamento", "multipark", "parebem", "allpark"];
const KW_PEDAGIO = ["sem parar", "semparar", "conectcar", "veloe", "move mais", "taggy", "pedagio", "pedágio", "autoban", "ecorodovias", "arteris", "ccr"];
const KW_ALUGUEL = ["aluguel", "imobiliaria", "imobiliária", "quintoandar", "quinto andar"];
const KW_CONDOMINIO = ["condominio", "condomínio"];
// "energia" sozinha não: "BEBIDA ENERGIA", "ENERGIA FITNESS" e loja de energia solar viravam conta
// de luz sem passar pela revisão. No lugar, o nome das distribuidoras e o "conta de luz" do boleto.
const KW_LUZ = [
  "enel", "cpfl", "light", "eletropaulo", "cemig", "copel", "energisa", "neoenergia", "equatorial", "coelba", "celpe",
  "cosern", "celesc", "edp", "elektro", "rge", "ceee", "amazonas energia", "conta de luz", "energia eletrica", "energia elétrica",
];
const KW_AGUA = [
  "sabesp", "sanepar", "copasa", "aegea", "cedae", "embasa", "caesb", "compesa", "cagece", "casan", "corsan", "saneago",
  "aguas do rio", "iguá", "igua saneamento", "conta de agua", "conta de água",
];
const KW_GAS = ["comgas", "naturgy", "ultragaz", "liquigas", "supergasbras", "copagaz", "nacional gas"];
// "oi", "tim" e "net" só como palavra solta: como pedaço, "BOI GORDO" virava conta de internet.
const KW_TELEFONIA = ["vivo", "claro", "tim", "oi", "net", "internet", "telefonia", "telefonica", "sky", "nextel", "algar", "brisanet", "vero internet", "desktop fibra"];
const KW_DELIVERY = ["ifood", "ifd", "rappi", "uber eats", "ubereats", "ze delivery", "zedelivery", "ze delivey", "aiqfome", "james delivery", "delivery much", "99food", "keeta", "delivery"];

/**
 * Ferramentas e assinaturas digitais. Na pessoa física vão pra Outros › Assinaturas e apps (não há
 * categoria de assinatura no app; streaming continua em Lazer). Na Empresa, Estrutura › Software.
 * "apple" e "google" sozinhos não: são marketplace de tudo (app, jogo, aparelho). Só o produto.
 */
const KW_FERRAMENTAS = [
  "manychat", "openai", "chatgpt", "chat gpt", "anthropic", "claude ai", "canva", "adobe", "photoshop", "lightroom",
  "google workspace", "gsuite", "g suite", "google one", "google storage", "google play", "icloud", "apple com bill",
  "microsoft", "office 365", "microsoft 365", "notion", "dropbox", "zoom", "zoom us", "calendly", "capcut", "activecampaign",
  "activecamp", "vturb", "mailchimp", "rd station", "rdstation", "hostinger", "godaddy", "registro br", "wix", "shopify",
  "figma", "trello", "slack", "linkedin", "grammarly", "midjourney", "elevenlabs", "heygen", "gamma app", "perplexity",
  "cursor", "github", "vercel", "inlead", "adapta org", "adapta one", "typeform", "hotjar", "semrush", "lovable",
];
const KW_ANUNCIOS = ["facebook", "facebk", "fb ads", "meta ads", "meta platforms", "facebook ads", "instagram ads", "google ads", "tiktok ads", "linkedin ads"];
/** Plataforma de curso online (Hubla, Hotmart...): 13 clientes com "HUBLA*DANICOLOMBO" escolheram Educação em 76 de 89 vezes (out/2026). */
const KW_PLATAFORMA_CURSO = ["hubla", "hotmart", "kiwify", "eduzz", "monetizze", "braip", "perfectpay", "ticto", "greenn", "cakto"];

export const DICIONARIO_PESSOAL: RegraDoDicionario[] = [
  // Impostos primeiro: "PAGAMENTO IMPOSTO DE RENDA" não pode ser pego por nenhuma regra de consumo.
  { keywords: ["ipva"], parentCategory: "IMPOSTOS", subcategory: "IPVA" },
  { keywords: ["iptu"], parentCategory: "IMPOSTOS", subcategory: "IPTU" },
  { keywords: ["imposto de renda", "irpf", "receita federal"], parentCategory: "IMPOSTOS", subcategory: "Imposto de renda" },
  { keywords: ["darf"], parentCategory: "IMPOSTOS", subcategory: "DARF" },
  // DAS do MEI: 5 clientes escolheram Impostos pra "Simples Nacional" (out/2026).
  { keywords: ["simples nacional", "das simples", "das mei", "pgdas", "detran", "licenciamento"], parentCategory: "IMPOSTOS", subcategory: "Taxas públicas" },
  { keywords: KW_IMPOSTO, parentCategory: "IMPOSTOS" },

  // Juros e IOF do Pix no crédito citam o recebedor ("... PARA MANDACARU GASTRONOMIA"): não é a compra.
  { keywords: ["juros de atraso", "iof de atraso", "multa de atraso", "encargos de atraso"], parentCategory: "OUTROS", subcategory: "Tarifas bancárias" },

  // Alimentação. Delivery primeiro: "IFD*RESTAURANTE" é pedido no iFood.
  { keywords: KW_DELIVERY, parentCategory: "ALIMENTACAO", subcategory: "Delivery" },
  {
    keywords: [
      "supermercado", "supermercados", "mercado", "mercados", "minimercado", "mini mercado", "mercearia", "hipermercado", "atacadao",
      "atacadão", "atacadista", "atacado", "assai", "assaí", "carrefour", "pao de acucar", "pão de açúcar", "paodeacucar",
      "hortifruti", "hortifrutti", "hortifrutigranjeiro", "sacolao", "sacolão", "acougue", "açougue", "casa de carnes", "peixaria",
      "quitanda", "feira livre", "emporio", "empório", "festval", "super festval", "super muffato", "condor", "bistek",
      "savegnago", "cia zaffari", "guanabara", "prezunic", "sonda", "st marche", "oba hortifruti", "hirota", "sams club", "makro",
      "tenda atacado", "roldao", "fort atacadista", "comper", "super nosso", "verdemar", "covabra", 
      "rede economia", "market4u", "market 4u", "minha quitandinha", "daki", "big bompreco", "bompreco",
      "atakarejo", "cometa supermercados", "supernosso", "bh supermercados", "dia supermercado", "carrefour express",
      "vsg mercados", "spani", "higa", "irmaos muffato", "mercadinho", "zona sul", "oxxo",
      // 12/10/2026: o que a Dani teve que responder na mão.
      "frutaria", "queijaria", "laticinios", "laticínios", "casa do queijo", "emporium",
    ],
    parentCategory: "ALIMENTACAO",
    subcategory: "Supermercado",
  },
  {
    keywords: [
      "padaria", "panificadora", "panificacao", "panificação", "confeitaria", "boulangerie", "doceria", "padoca",
      // "Saint Claire Bakery" vinha perguntado (12/10/2026).
      "bakery", "bakeries", "bakehouse", "bake shop", "panetteria", "panaderia", "panadería",
    ],
    parentCategory: "ALIMENTACAO",
    subcategory: "Padaria",
  },
  {
    keywords: [
      "cafe", "café", "cafeteria", "coffee", "starbucks", "sbux", "casa do pao de queijo", "havanna", "acai", "açaí", "sorveteria",
      "sorvete", "gelato", "gelateria", "bacio di latte", "kopenhagen", "cacau show", "lindt", "chocolates", "chocolateria",
      "brigaderia", "frooty", "oakberry", "the coffee", "fran s cafe", "suco", "sucos", "pastelaria", "pastel", "lanchonete",
      "lanche", "lanches", "salgados", "coxinha", "esfiha", "esfiharia",
      "cake", "cakes", "bolo", "bolos", "pudim", "pudins", "pipoca", "pipocas", "pipocaria", "creperia", "crepe", "crepes",
      "tapiocaria", "waffle", "donut", "donuts", "cookie", "cookies", "brownie", "brownies", "churros", "empada", "empadas",
      "empadaria", "salgaderia", "paleteria", "frozen yogurt", "yogurteria", "milkshake", "bubble tea",
    ],
    parentCategory: "ALIMENTACAO",
    subcategory: "Lanche/Café",
  },
  { keywords: ["bar", "boteco", "botequim", "choperia", "chopp", "chope", "cervejaria", "brewery", "brew", "pub", "adega", "bebidas", "distribuidora de bebidas", "tabacaria"], parentCategory: "ALIMENTACAO", subcategory: "Bar" },
  {
    keywords: [
      "restaurante", "restaurantes", "restaurant", "restau", "restaura", "rest", "sushi", "temaki", "temakeria", "japones", "japonesa",
      "japanese", "yakisoba", "ramen", "pizzaria", "pizza", "pizzas", "hamburgueria", "hamburguer", "hamburger", "burger", "burguer",
      "lanchonete", "churrascaria", "churrasco", "cantina", "trattoria", "osteria", "bistro", "bistrô", "grill", "steakhouse",
      "galeteria", "food", "comida", "comidas", "cozinha italiana", "almoco", "almoço", "jantar", "poke", "mexicano",
      "mcdonald", "mcdonalds", "mc donald", "mc donalds", "burger king", "bk", "subway", "kfc", "popeyes", "habibs", "habib s",
      "ragazzo", "giraffas", "spoleto", "china in box", "outback", "madero", "grupo madero", "coco bambu", "applebees", "fogo de chao",
      "dominos", "domino s", "pizza hut", "abbraccio", "divino fogao", "viena", "montana grill", "bobs", "bob s",
      "paris 6", "camaroes", "camarões", "frango assado", "rodizio", "rodízio", "self service", "marmitaria", "marmita",
      "cucina", "pizzeria", "sushiloko", "nagayama", "jappa", "gendai", "lpqbr", "le pain quotidien",
      // 12/10/2026, a Dani: "Costelão do gaúcho. É lógico que é comida." "Gaúcho" sozinho não
      // entra (GAUCHO PNEUS); entra o que só pode ser comida.
      "costelao", "costelão", "costela", "costelaria", "picanha", "picanharia", "espeto", "espetinho", "espetinhos", "espetaria",
      "galeto", "parrilla", "steak", "steaks", "fondue", "ristorante", "gastronomia", "gastronomica", "culinaria", "culinária",
      "forneria", "yakisobaria", "onigiri", "lamen", "taqueria", "tacos", "burrito", "kebab", "shawarma", "falafel",
      "brasserie", "gastrobar", "gastropub", "rotisseria", "rotisserie", "buffet", "comida a quilo", "por quilo",
      "sushi bar", "sushibar", "izakaya", "dim sum", "noodles", "pastaria",
    ],
    parentCategory: "ALIMENTACAO",
    subcategory: "Restaurante",
  },
  // O ramo escrito no NOME da loja: "Gcc Comercio De Alime[ntos]", "Wrappd Alimento SA",
  // "Marcolini Alimentari". É comida, mas não dá pra saber se é mercado ou restaurante.
  { keywords: ["alimentos", "alimento", "alimentacao", "alimentação", "alimentari", "alimenticios", "alimentícios", "food service", "foods"], parentCategory: "ALIMENTACAO" },

  // Transporte
  { keywords: KW_APLICATIVO, parentCategory: "TRANSPORTE", subcategory: "Aplicativo" },
  { keywords: KW_COMBUSTIVEL, parentCategory: "TRANSPORTE", subcategory: "Combustível" },
  { keywords: KW_ESTACIONAMENTO, parentCategory: "TRANSPORTE", subcategory: "Estacionamento" },
  // Tag de pedágio: 4 clientes escolheram Transporte pra "Sem Parar" (out/2026).
  { keywords: KW_PEDAGIO, parentCategory: "TRANSPORTE", subcategory: "Pedágio" },
  {
    keywords: ["metro", "metrô", "cptm", "bilhete unico", "bilhete único", "sptrans", "onibus", "ônibus", "brt", "clickbus", "buser", "rodoviaria", "rodoviária", "top transporte", "riocard", "bom recarga", "urbs", "via quatro", "viamobilidade"],
    parentCategory: "TRANSPORTE",
    subcategory: "Transporte público",
  },
  {
    keywords: ["oficina", "auto pecas", "autopecas", "auto peças", "borracharia", "lava rapido", "lava jato", "pneus", "pneu", "funilaria", "mecanica", "mecânica", "dpaschoal", "troca de oleo"],
    parentCategory: "TRANSPORTE",
    subcategory: "Manutenção do veículo",
  },

  // Saúde. "raia" e "pacheco" sozinhos pegavam PRAIA e qualquer JOAO PACHECO de Pix.
  {
    keywords: [
      "farmacia", "farmácia", "farma", "drogaria", "drogarias", "drogasil", "droga raia", "drogaraia", "raia drogasil", "raiadrogasil",
      "drogariasaopaulo", "drogasaopaulo", "drogaria sao paulo", "pague menos", "paguemenos", "panvel", "nissei", "drogao", "drogão",
      "drogaria venancio", "drogaria onofre", "extrafarma", "ultrafarma", "drogaria araujo", "poupafarma", "drogal", "droga leste", "farmacia popular",
    ],
    parentCategory: "SAUDE",
    subcategory: "Farmácia",
  },
  {
    keywords: ["unimed", "amil", "bradesco saude", "sulamerica saude", "sulamerica", "plano de saude", "hapvida", "notredame", "intermedica", "porto saude", "prevent senior", "golden cross", "alice saude", "sami saude"],
    parentCategory: "SAUDE",
    subcategory: "Plano de saúde",
  },
  {
    keywords: ["laboratorio", "laboratório", "fleury", "dasa", "delboni auriemo", "lavoisier", "sabin medicina", "hermes pardini", "a mais medicina", "exame", "exames", "diagnosticos", "diagnósticos", "imagem diagnostica"],
    parentCategory: "SAUDE",
    subcategory: "Exames",
  },
  {
    keywords: ["hospital", "clinica", "clínica", "consultorio", "consultório", "dentista", "odonto", "odontologia", "medico", "médico", "oftalmo", "dermato", "fisioterapia", "nutricionista", "pronto socorro"],
    parentCategory: "SAUDE",
    subcategory: "Consultas",
  },
  // Psicóloga e terapia: clientes escolhiam Saúde à mão toda vez (out/2026).
  { keywords: ["psicologa", "psicóloga", "psicologo", "psicólogo", "psicologia", "terapia", "terapeuta", "psicoline", "zenklub", "vittude"], parentCategory: "SAUDE", subcategory: "Terapia" },
  {
    keywords: ["academia", "smartfit", "smart fit", "bluefit", "bodytech", "bio ritmo", "selfit", "just fit", "crossfit", "pilates", "totalpass", "total pass", "gympass", "wellhub", "fit former", "bt fit"],
    parentCategory: "SAUDE",
    subcategory: "Academia",
  },

  // Lazer
  {
    keywords: [
      "netflix", "spotify", "disney", "disneyplus", "disney plus", "hbo", "hbomax", "hbo max", "max com", "amazon prime", "amazonprime",
      "prime video", "primevideo", "youtube", "youtube premium", "youtubepremium", "google youtube", "deezer", "globoplay", "paramount",
      "apple tv", "apple music", "amazon music", "crunchyroll", "mubi", "star plus", "telecine", "premiere", "tidal", "twitch",
      "playstation", "psn", "xbox", "steam", "nintendo",
    ],
    parentCategory: "LAZER",
    subcategory: "Streaming",
  },
  {
    keywords: ["cinema", "cinemark", "kinoplex", "cinepolis", "uci", "ingresso", "ingressos", "ingresso com", "teatro", "show", "sympla", "eventim", "ticketmaster", "ingresse", "ticket", "museu", "meaple"],
    parentCategory: "LAZER",
    subcategory: "Cinema/Shows",
  },
  // "azul" e "gol" sozinhos não: são sobrenome e palavra comum, e o Pix pra "ANA AZUL" virava
  // Viagens sem passar pela revisão. Só o nome da companhia como aparece na fatura.
  {
    keywords: [
      "hotel", "hoteis", "hotéis", "pousada", "hostel", "resort", "airbnb", "booking", "decolar", "123milhas", "123 milhas",
      "maxmilhas", "hurb", "trivago", "expedia", "hospedagem", "passagem", "passagens", "latam", "gol linhas", "gol transportes",
      "voegol", "azul linhas", "azul viagens", "voeazul", "iberia", "tap air", "air france", "american airlines", "airlines",
      "lineas aereas", "aereas", "aéreas", "cvc", "loungekey", "getyourguide", "get your guide", "rentcars", "rent car", "civitatis",
    ],
    parentCategory: "LAZER",
    subcategory: "Viagens",
  },

  // Moradia
  { keywords: KW_ALUGUEL, parentCategory: "MORADIA", subcategory: "Aluguel" },
  { keywords: KW_CONDOMINIO, parentCategory: "MORADIA", subcategory: "Condomínio" },
  { keywords: KW_LUZ, parentCategory: "MORADIA", subcategory: "Luz" },
  { keywords: KW_AGUA, parentCategory: "MORADIA", subcategory: "Água" },
  { keywords: KW_GAS, parentCategory: "MORADIA", subcategory: "Gás" },
  { keywords: KW_TELEFONIA, parentCategory: "MORADIA", subcategory: "Internet" },
  { keywords: ["leroy merlin", "telhanorte", "c c material", "material de construcao", "material de construção", "casa e construcao", "chaveiro", "eletricista", "encanador"], parentCategory: "MORADIA", subcategory: "Manutenção" },

  // Educação
  {
    keywords: ["escola", "faculdade", "universidade", "curso", "colegio", "colégio", "mensalidade", "udemy", "alura", "coursera", "duolingo", "babbel", "cultura inglesa", "wizard", "ccaa", "fisk", "kumon", "open english", "descomplica", "estrategia concursos"],
    parentCategory: "EDUCACAO",
    subcategory: "Mensalidade",
  },
  { keywords: KW_PLATAFORMA_CURSO, parentCategory: "EDUCACAO", subcategory: "Cursos" },
  // "amazon" sozinho não: é marketplace de tudo (eletrônico, casa, mercado). Vai pra revisão.
  { keywords: ["livraria", "kindle", "livro", "livros", "saraiva", "estante virtual", "kindle unlimited", "papelaria", "kalunga"], parentCategory: "EDUCACAO", subcategory: "Livros/Material" },

  // Ferramentas e anúncios (quem vende pela internet tem isso no cartão pessoal também).
  { keywords: KW_ANUNCIOS, parentCategory: "OUTROS", subcategory: "Anúncios" },
  { keywords: KW_FERRAMENTAS, parentCategory: "OUTROS", subcategory: "Assinaturas e apps" },

  // Outros: tarifa de banco, seguro, juros, o que sobra
  { keywords: ["tarifa", "tarifas", "tar pacote", "tar", "anuidade", "iof", "juros", "cesta de servicos", "pacote de servicos", "manutencao de conta"], parentCategory: "OUTROS", subcategory: "Tarifas bancárias" },
  { keywords: ["seguro", "seguros", "emprestimo", "empréstimo"], parentCategory: "OUTROS", subcategory: "Tarifas bancárias" },
  { keywords: ["igreja", "dizimo", "dízimo", "doacao", "doação", "vakinha", "unicef", "medicos sem fronteiras"], parentCategory: "OUTROS", subcategory: "Doações" },
  // Extrato do Nubank: "Aplicação RDB" é dinheiro indo pra caixinha/investimento, não gasto do dia a dia.
  { keywords: ["aplicação rdb", "aplicacao rdb", "aplicação cdb", "aplicacao cdb", "tesouro direto", "aplicação em"], parentCategory: "OUTROS", subcategory: "Investimento" },
];

/**
 * Perfil Empresa: as mesmas oito chaves significam outra coisa (ALIMENTACAO é "Mercadorias e
 * insumos", SAUDE é "Equipe e pró-labore", LAZER é "Serviços e terceiros", EDUCACAO é
 * "Marketing e vendas" — ver profiles/empresa.ts). Com as regras da pessoa física, o almoço no
 * iFood virava custo de mercadoria e a farmácia virava folha de pagamento. Aqui só fica o que quer
 * dizer a mesma coisa nos dois mundos, mais as ferramentas e os anúncios, que na empresa têm lugar
 * certo; o resto vai pra revisão.
 */
export const DICIONARIO_EMPRESA: RegraDoDicionario[] = [
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
  { keywords: ["correios", "sedex", "loggi", "jadlog", "melhor envio", "melhorenvio", "lalamove", "total express"], parentCategory: "TRANSPORTE", subcategory: "Correios" },
  { keywords: ["contabilidade", "contabil", "contábil", "contador"], parentCategory: "LAZER", subcategory: "Contador" },
  { keywords: KW_ANUNCIOS, parentCategory: "EDUCACAO", subcategory: "Anúncios" },
  { keywords: KW_FERRAMENTAS, parentCategory: "MORADIA", subcategory: "Software e assinaturas" },
];
