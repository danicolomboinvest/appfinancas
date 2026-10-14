import type { ParentCategory } from "@prisma/client";

/**
 * O vocabulário FALADO (14/10/2026, pedido da Dani: "a parte da voz, consegue ser mais
 * inteligente, para ter mais variedades do nome que a pessoa fala?").
 *
 * O dicionário da importação (import/dicionario.ts) conhece o que o BANCO escreve: "AUTO POSTO
 * SHELL", "IFD*RESTAURANTE". Quem fala diz outra coisa: "abasteci", "a quentinha", "o rancho do
 * mês", "a ração da Mel", e o reconhecedor de voz ainda escreve "ifude" e "méqui". Esta lista é
 * só da voz, separada da do extrato, e entra DEPOIS da regra dela, das categorias que ela criou,
 * da base comunitária e do dicionário (ver categoria-da-fala.ts). Sem IA, sem custo por uso.
 *
 * Como casa (ver `acharNoVocabulario`):
 * - sem acento, por palavra inteira: "bar" nunca casa dentro de "barbeiro", "gás" nunca dentro
 *   de "gasolina";
 * - plural e diminutivo: "coxinhas", "pãozinho", "cervejinha", "joguinho";
 * - erro pequeno do reconhecedor só em palavra de 5 letras ou mais, com a mesma primeira letra,
 *   e nunca numa palavra comum da língua ("saldo" não vira "salão");
 * - a expressão mais comprida ganha: "pão de açúcar" é mercado, "pão" é padaria.
 *
 * `grupo`: o assunto que pode ter categoria DELA ("Beleza", "Pets", "Filhos"). Quem usa troca
 * pela dela quando existe; sem ela, fica a reserva Outros › subcategoria.
 */
export type GrupoFalado = "cuidado" | "pet" | "filhos";

type Entrada = { parentCategory: ParentCategory; subcategory: string; grupo?: GrupoFalado; termos: string[] };

export const VOCABULARIO_FALADO: Entrada[] = [
  // ── Comida e bebida ──
  {
    parentCategory: "ALIMENTACAO",
    subcategory: "Supermercado",
    termos: [
      "mercado", "supermercado", "mercadinho", "minimercado", "mini mercado", "hipermercado", "atacadao", "atacadista", "atacarejo",
      "assai", "carrefour", "pao de acucar", "sams club", "makro", "guanabara", "zaffari",
      "feira", "feirinha", "feira livre", "sacolao", "hortifruti", "hortifrutti", "quitanda", "verdurao", "varejao",
      "acougue", "peixaria", "emporio", "compras do mes", "compra do mes", "rancho", "rancho do mes", "fiz o mercado", "fiz mercado",
      "fiz a feira", "compras de casa", "compra de casa", "mantimentos", "verdura", "verduras", "fruta", "frutas", "legumes",
      "carne", "frango", "ovos", "leite", "arroz", "feijao", "sabao em po", "produtos de limpeza", "papel higienico",
      "supermecado", "supermercados",
    ],
  },
  {
    parentCategory: "ALIMENTACAO",
    subcategory: "Restaurante",
    termos: [
      "almoco", "almocei", "almocinho", "almoco de domingo", "janta", "jantar", "jantei", "jantinha", "restaurante", "restaurant",
      "marmita", "marmitex", "quentinha", "prato feito", "pf", "comida", "comi fora", "comer fora", "self service", "selfie service",
      "comida a quilo", "por quilo", "rodizio", "pizza", "pizzaria", "esfirra", "esfiha", "hamburguer", "hamburger", "burger",
      "hamburgueria", "x tudo", "xis", "cachorro quente", "dogao", "sushi", "temaki", "japones", "comida japonesa", "comida chinesa",
      "yakisoba", "churrasco", "churrascaria", "espetinho", "galeto", "frango assado", "pastelaria", "lanchonete",
      "mc donalds", "mcdonalds", "mac donalds", "mequi", "meque", "mc", "burger king", "bk", "subway", "habibs", "outback",
      "madero", "coco bambu", "giraffas", "spoleto", "kfc", "bobs", "parmegiana", "feijoada", "buffet",
    ],
  },
  {
    parentCategory: "ALIMENTACAO",
    subcategory: "Delivery",
    termos: [
      "delivery", "ifood", "i food", "ifude", "ifoodi", "aifood", "ai food", "uber eats", "ubereats", "rappi", "ze delivery",
      "aiqfome", "pedi comida", "pedi um lanche", "pedi uma pizza", "pedi pizza", "pedi delivery", "pedido de comida",
      "comida pedida", "tele entrega", "disk pizza",
    ],
  },
  {
    parentCategory: "ALIMENTACAO",
    subcategory: "Padaria",
    termos: ["padaria", "padoca", "pao", "pao frances", "pao de queijo", "panificadora", "confeitaria"],
  },
  {
    parentCategory: "ALIMENTACAO",
    subcategory: "Lanche/Café",
    termos: [
      "lanche", "lanchinho", "cafe", "cafe da manha", "cafe da tarde", "cafeteria", "starbucks", "cappuccino", "capuccino",
      "salgado", "salgadinho", "coxinha", "pastel", "empada", "empadinha", "kibe", "quibe", "esfirrinha", "enroladinho",
      "acai", "sorvete", "picole", "milkshake", "milk shake", "sorveteria", "doce", "docinho", "brigadeiro", "bolo", "pudim",
      "chocolate", "bombom", "biscoito", "bolacha", "chiclete", "bala", "pipoca", "suco", "refrigerante", "refri",
      "agua de coco", "tapioca", "crepe", "churros", "cuscuz", "misto quente", "lanche da tarde", "merenda",
    ],
  },
  {
    parentCategory: "ALIMENTACAO",
    subcategory: "Bar",
    termos: [
      "bar", "barzinho", "boteco", "buteco", "botequim", "cerveja", "breja", "gelada", "chopp", "chope", "chopinho", "caipirinha",
      "drink", "drinks", "drinque", "vinho", "whisky", "uisque", "cachaca", "pinga", "vodka", "gin", "happy hour", "rapi hour",
      "saideira", "petisco", "porcao", "adega", "distribuidora", "tabacaria", "cigarro", "cigarros", "narguile",
    ],
  },

  // ── Transporte ──
  {
    parentCategory: "TRANSPORTE",
    subcategory: "Combustível",
    termos: [
      "gasolina", "alcool", "etanol", "diesel", "gnv", "combustivel", "abasteci", "abastecer", "abastecimento", "abastecemos",
      "posto", "posto de gasolina", "tanque cheio", "enchi o tanque", "shell", "ipiranga", "petrobras", "gasosa",
    ],
  },
  {
    parentCategory: "TRANSPORTE",
    subcategory: "Aplicativo",
    termos: [
      "uber", "uber x", "uber black", "uber moto", "99", "noventa e nove", "nove nove", "99 pop", "99 moto", "taxi", "taxista",
      "corrida", "carro de aplicativo", "aplicativo de carro", "moto taxi", "mototaxi", "cabify", "indriver", "indrive", "lyft",
      "patinete", "bike compartilhada",
    ],
  },
  {
    parentCategory: "TRANSPORTE",
    subcategory: "Transporte público",
    termos: [
      "onibus", "busao", "buzao", "metro", "trem", "brt", "vlt", "lotacao", "van", "passagem de onibus", "passagem do onibus",
      "passagem de metro", "passagem de trem", "passagem", "bilhete unico", "bilhete", "cartao de transporte", "riocard",
      "recarga do bilhete", "recarga do cartao de onibus", "vale transporte", "barca", "balsa", "catamara", "conducao",
    ],
  },
  {
    parentCategory: "TRANSPORTE",
    subcategory: "Estacionamento",
    termos: ["estacionamento", "estacionar", "estacionei", "zona azul", "parquimetro", "flanelinha", "valet", "manobrista", "garagem"],
  },
  {
    parentCategory: "TRANSPORTE",
    subcategory: "Pedágio",
    termos: ["pedagio", "sem parar", "conectcar", "veloe", "tag do carro", "tag de pedagio"],
  },
  {
    parentCategory: "TRANSPORTE",
    subcategory: "Manutenção do veículo",
    termos: [
      "mecanico", "oficina", "pneu", "borracharia", "borracheiro", "revisao do carro", "revisao da moto", "revisao", "conserto do carro",
      "conserto da moto", "troca de oleo", "trocar o oleo", "oleo do carro", "lava jato", "lavajato", "lava rapido", "lavagem do carro",
      "lavei o carro", "lavar o carro", "funilaria", "funileiro", "alinhamento", "balanceamento", "bateria do carro", "pastilha de freio",
      "freio", "auto pecas", "autopecas", "peca do carro", "guincho", "vistoria", "despachante",
    ],
  },
  { parentCategory: "IMPOSTOS", subcategory: "IPVA", termos: ["ipva"] },
  { parentCategory: "IMPOSTOS", subcategory: "IPTU", termos: ["iptu"] },
  { parentCategory: "IMPOSTOS", subcategory: "Imposto de renda", termos: ["imposto de renda", "irpf"] },
  { parentCategory: "IMPOSTOS", subcategory: "DARF", termos: ["darf"] },
  {
    parentCategory: "IMPOSTOS",
    subcategory: "Taxas públicas",
    termos: ["licenciamento", "detran", "multa", "multa de transito", "taxa do detran", "cnh", "carteira de motorista", "taxa de lixo"],
  },
  {
    parentCategory: "OUTROS",
    subcategory: "Seguros",
    termos: ["seguro", "seguro do carro", "seguro da moto", "seguro de vida", "seguro residencial", "seguro do celular", "seguro viagem"],
  },

  // ── Casa ──
  { parentCategory: "MORADIA", subcategory: "Aluguel", termos: ["aluguel"] },
  { parentCategory: "MORADIA", subcategory: "Condomínio", termos: ["condominio", "taxa de condominio", "condo"] },
  {
    parentCategory: "MORADIA",
    subcategory: "Luz",
    termos: ["luz", "conta de luz", "energia", "conta de energia", "energia eletrica", "enel", "cemig", "light", "copel", "celpe", "coelba", "cpfl", "equatorial", "neoenergia"],
  },
  { parentCategory: "MORADIA", subcategory: "Água", termos: ["agua", "conta de agua", "sabesp", "cedae", "copasa", "sanepar", "embasa", "compesa", "esgoto"] },
  { parentCategory: "MORADIA", subcategory: "Gás", termos: ["gas", "botijao", "botijao de gas", "gas de cozinha", "conta de gas", "comgas", "bujao"] },
  {
    parentCategory: "MORADIA",
    subcategory: "Internet",
    termos: [
      "internet", "wifi", "wi fi", "uai fai", "banda larga", "fibra", "celular", "conta do celular", "conta de celular", "plano do celular",
      "plano de celular", "telefone", "conta de telefone", "recarga", "recarga de celular", "credito do celular", "credito de celular",
      "tv a cabo", "sky",
    ],
  },
  {
    parentCategory: "MORADIA",
    subcategory: "Faxina",
    termos: ["faxina", "faxineira", "diarista", "empregada", "empregada domestica", "domestica", "passadeira", "lavanderia", "limpeza da casa"],
  },
  {
    parentCategory: "MORADIA",
    subcategory: "Manutenção",
    termos: [
      "manutencao", "manutencao da casa", "conserto", "reparo", "reforma", "obra", "pedreiro", "pintor", "pintura", "encanador",
      "eletricista", "marceneiro", "serralheiro", "vidraceiro", "chaveiro", "desentupidora", "dedetizacao", "jardineiro", "jardinagem",
      "material de construcao", "cimento", "tinta", "leroy merlin", "telhanorte", "ferragem", "ferramenta", "ferramentas",
      "moveis", "movel", "sofa", "cama", "colchao", "guarda roupa", "armario", "geladeira", "fogao", "maquina de lavar",
      "microondas", "eletrodomestico", "eletrodomesticos", "decoracao", "cortina", "tapete", "luminaria", "lampada", "utensilios",
      "panela", "panelas", "loucas", "tok stok", "tokstok", "casas bahia", "magazine luiza", "camicado", "cama mesa e banho",
    ],
  },

  // ── Saúde ──
  {
    parentCategory: "SAUDE",
    subcategory: "Farmácia",
    termos: [
      "farmacia", "drogaria", "remedio", "remedinho", "medicamento", "medicacao", "antibiotico", "vitamina", "vacina", "pomada",
      "droga raia", "raia", "drogasil", "pague menos", "panvel", "drogao", "anticoncepcional", "fio dental", "curativo",
    ],
  },
  {
    parentCategory: "SAUDE",
    subcategory: "Consultas",
    termos: [
      "consulta", "medico", "medica", "doutor", "doutora", "dentista", "pediatra", "ginecologista", "gineco", "dermatologista",
      "dermato", "oftalmologista", "oftalmo", "cardiologista", "ortopedista", "nutricionista", "nutri", "fonoaudiologa", "fono",
      "pronto socorro", "hospital", "clinica", "aparelho nos dentes", "aparelho do dente", "ortodontista", "oculos", "lente de contato",
    ],
  },
  { parentCategory: "SAUDE", subcategory: "Exames", termos: ["exame", "exame de sangue", "laboratorio", "ultrassom", "raio x", "ressonancia", "tomografia", "mamografia", "check up"] },
  {
    parentCategory: "SAUDE",
    subcategory: "Terapia",
    termos: ["terapia", "terapeuta", "psicologo", "psicologa", "psicanalista", "psiquiatra", "fisioterapia", "fisio", "acupuntura", "massagem", "quiropraxia"],
  },
  {
    parentCategory: "SAUDE",
    subcategory: "Plano de saúde",
    termos: ["plano de saude", "convenio", "convenio medico", "plano odontologico", "unimed", "amil", "bradesco saude", "sulamerica", "hapvida", "notredame"],
  },
  {
    parentCategory: "SAUDE",
    subcategory: "Academia",
    termos: [
      "academia", "personal", "personal trainer", "pilates", "crossfit", "musculacao", "natacao", "yoga", "ioga", "funcional",
      "luta", "jiu jitsu", "muay thai", "boxe", "danca", "smart fit", "smartfit", "bluefit", "suplemento", "suplementos", "whey",
      "creatina", "proteina", "box de crossfit",
    ],
  },

  // ── Educação ──
  { parentCategory: "EDUCACAO", subcategory: "Mensalidade", termos: ["mensalidade", "faculdade", "universidade", "pos graduacao", "mba", "matricula"] },
  { parentCategory: "EDUCACAO", subcategory: "Escola", termos: ["escola", "van escolar", "transporte escolar", "colegio", "creche", "escolinha", "bercario", "excursao da escola", "uniforme"] },
  {
    parentCategory: "EDUCACAO",
    subcategory: "Cursos",
    termos: [
      "curso", "aula", "aula particular", "ingles", "curso de ingles", "espanhol", "idioma", "idiomas", "reforco", "cursinho",
      "pre vestibular", "vestibular", "enem", "concurso", "workshop", "mentoria", "treinamento", "hotmart", "udemy", "alura",
    ],
  },
  {
    parentCategory: "EDUCACAO",
    subcategory: "Livros/Material",
    termos: ["livro", "livraria", "apostila", "material escolar", "material da escola", "caderno", "papelaria", "caneta", "lapis", "mochila", "kindle", "xerox", "impressao"],
  },

  // ── Lazer ──
  {
    parentCategory: "LAZER",
    subcategory: "Cinema/Shows",
    termos: ["cinema", "filme", "show", "teatro", "ingresso", "ingressos", "musical", "stand up", "festival", "jogo de futebol", "estadio", "museu", "exposicao", "pipoca do cinema"],
  },
  {
    parentCategory: "LAZER",
    subcategory: "Viagens",
    termos: [
      "viagem", "viajei", "ferias", "hotel", "pousada", "hostel", "airbnb", "hospedagem", "passagem aerea", "passagem de aviao", "aviao", "voo",
      "latam", "decolar", "booking", "resort", "passeio de barco", "mala", "passagem de onibus para",
    ],
  },
  {
    parentCategory: "LAZER",
    subcategory: "Streaming",
    termos: [
      "streaming", "netflix", "spotify", "disney", "disney plus", "amazon prime", "prime video", "hbo", "globoplay",
      "youtube premium", "deezer", "apple music", "paramount", "crunchyroll", "star plus", "assinatura",
    ],
  },
  { parentCategory: "LAZER", subcategory: "Bar/Balada", termos: ["balada", "boate", "festa", "night", "rolê", "role", "camarote", "open bar"] },
  {
    parentCategory: "LAZER",
    subcategory: "Passeios",
    termos: ["passeio", "parque", "zoologico", "aquario", "praia", "clube", "piscina", "parque de diversoes", "boliche", "karaoke", "escape room", "trilha"],
  },
  {
    parentCategory: "LAZER",
    subcategory: "Presentes",
    termos: ["presente", "presente de aniversario", "aniversario", "lembrancinha", "amigo secreto", "amigo oculto", "flores", "buque", "dia das maes", "dia dos pais"],
  },
  {
    parentCategory: "LAZER",
    subcategory: "Hobbies",
    termos: ["jogo", "videogame", "video game", "playstation", "xbox", "nintendo", "steam", "game", "games", "skin", "fifa", "brinquedo", "lego", "hobby", "violao", "instrumento", "pescaria", "bicicleta", "bike"],
  },

  // ── Cuidado pessoal (vai para a categoria dela desse assunto, quando existe) ──
  {
    parentCategory: "OUTROS",
    subcategory: "Cuidado pessoal",
    grupo: "cuidado",
    termos: [
      "cabelo", "cortei o cabelo", "corte de cabelo", "cabeleireiro", "cabeleireira", "salao", "salao de beleza", "escova", "progressiva",
      "mechas", "tintura", "manicure", "pedicure", "unha", "unhas", "fiz a unha", "fazer a unha", "esmalte", "alongamento de unha",
      "barbeiro", "barbearia", "barba", "depilacao", "depilei", "cera", "laser", "sobrancelha", "design de sobrancelha", "cilios",
      "limpeza de pele", "estetica", "botox", "maquiagem", "make", "batom", "rimel", "perfume", "creme", "hidratante",
      "protetor solar", "shampoo", "xampu", "condicionador", "desodorante", "skincare", "skin care", "boticario", "natura", "sephora",
      "roupa", "roupas", "blusa", "blusinha", "camisa", "camiseta", "calca", "jeans", "short", "bermuda", "saia", "vestido", "casaco",
      "jaqueta", "moletom", "pijama", "calcinha", "cueca", "sutia", "meia", "biquini", "sapato", "tenis", "sandalia", "chinelo",
      "bota", "bolsa", "carteira de couro", "relogio", "brinco", "pulseira", "anel", "acessorio", "renner", "riachuelo",
      "cea", "zara", "shein", "centauro", "netshoes", "havaianas",
    ],
  },

  // ── Pets ──
  {
    parentCategory: "OUTROS",
    subcategory: "Pet",
    grupo: "pet",
    termos: [
      "racao", "racao do cachorro", "racao da gata", "pet", "pet shop", "petshop", "petz", "cobasi", "veterinario", "veterinaria",
      "vet", "banho e tosa", "tosa", "banho do cachorro", "areia do gato", "areia de gato", "vermifugo", "antipulgas", "coleira",
      "petisco do cachorro", "cachorro", "cachorra", "gato", "gata", "hotelzinho", "creche do cachorro", "adestrador",
    ],
  },

  // ── Filhos ──
  {
    parentCategory: "OUTROS",
    subcategory: "Filhos",
    grupo: "filhos",
    termos: [
      "fralda", "fraldas", "baba", "lenco umedecido", "mamadeira", "formula infantil", "leite de formula", "chupeta", "carrinho de bebe",
      "berco", "enxoval", "mesada", "roupa de crianca", "roupinha", "festa infantil", "bebe", "filho", "filha", "filhos",
    ],
  },

  // ── Outros ──
  { parentCategory: "OUTROS", subcategory: "Doações", termos: ["dizimo", "oferta", "oferta na igreja", "igreja", "doacao", "doei", "caridade", "vaquinha", "vakinha", "esmola", "ong"] },
  { parentCategory: "OUTROS", subcategory: "Tarifas bancárias", termos: ["tarifa", "tarifa do banco", "anuidade", "anuidade do cartao", "iof", "taxa do banco"] },
  { parentCategory: "OUTROS", subcategory: "Juros/Empréstimos", termos: ["juros", "emprestimo", "parcela do emprestimo", "consignado", "financiamento", "cheque especial", "agiota"] },
];

/** Quantos termos a voz conhece (para o relatório e para o teste). */
export function totalDeTermos(): number {
  return new Set(VOCABULARIO_FALADO.flatMap((e) => e.termos.map((t) => palavrasDe(t).join(" ")))).size;
}

/**
 * Palavras comuns da língua que ficam a uma letra de um termo e NÃO podem ser corrigidas para
 * ele: "saldo" não é "salão", "muita" não é "multa", "feita" não é "feira". Também nomes de
 * gente que caem perto de um termo. Só desligam o "erro pequeno"; a palavra exata continua.
 */
const COMUNS = new Set(
  (
    "saldo conta contas conto contos coisa coisas coisinha outra outro outros outras minha minhas nossa nosso dessa desse " +
    "aquela aquele sobre depois antes agora ainda sempre mesmo mesma parte quase valor valores pagar paguei gastei gasto gastos " +
    "comprei compra compras semana ontem tarde noite manha porque quando entao assim tambem junto todos todas tudo nada cada " +
    "alguma algum algumas alguns preco total reais dinheiro grana cartao credito debito boleto parcela fatura banco bancos " +
    "lugar lojas lojinha fulano fulana ciclano beltrano negocio parada besteira bobagem fiado feita feito ficou fazer tinha " +
    "tenho falta sobra troco menos metade inteiro cheio cheia muita muito muitos muitas pouca pouco dela dele delas deles " +
    "pessoa pessoal gente amigo amiga amigos colega irmao irma primo prima tio tia sogra sogro marido esposa namorado namorada " +
    "barraca carro carros moto motos casal canal festa festas resto vendi venda pegar peguei deixei deixar levar levei trouxe " +
    "passei paga pago pagos pagas pagou pagamos certo certa errado errada maior menor melhor pior primeiro primeira ultimo ultima " +
    "ferias feria musica musicas emprestado emprestada emprestei emprestou sacola sacolas segundo segunda terca quarta quinta sexta sabado domingo mes meses anos semanas cartoes " +
    "maria mario paula paulo pedro joana joao carlos marcelo bruna bruno lucas julia mateus marta marcia carla carol carina " +
    "sergio sandra simone sonia renata renato rafael rafaela daniel daniela gabriel gabriela fernanda fernando"
  ).split(" "),
);

function semAcento(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "do", "da", "dos", "das" viram "de": "conta da luz" é "conta de luz". */
function palavrasDe(texto: string): string[] {
  return semAcento(texto)
    .split(" ")
    .filter(Boolean)
    .map((p) => (p === "do" || p === "da" || p === "dos" || p === "das" ? "de" : p));
}

/** O singular de uma palavra: "pastéis" → "pastel", "pães" → "pao", "bares" → "bar", "coxinhas" → "coxinha". */
function singular(p: string): string {
  if (p.length <= 3) return p;
  if (/(oes|aes)$/.test(p)) return `${p.slice(0, -3)}ao`;
  if (/eis$/.test(p)) return `${p.slice(0, -3)}el`;
  if (/ais$/.test(p)) return `${p.slice(0, -3)}al`;
  if (/ns$/.test(p)) return `${p.slice(0, -2)}m`;
  if (/(r|z|l)es$/.test(p)) return p.slice(0, -2);
  if (/s$/.test(p)) return p.slice(0, -1);
  return p;
}

/** As formas sem diminutivo: "pãozinho" → "pao", "cervejinha" → "cerveja", "joguinho" → "jogo", "churrasquinho" → "churrasco". */
function semDiminutivo(p: string): string[] {
  const m = p.match(/^(.{2,}?)(z?)inh([oa])$/);
  if (!m) return [];
  if (m[2]) return [m[1]];
  const raiz = m[1].replace(/qu$/, "c").replace(/gu$/, "g");
  return [`${raiz}${m[3]}`, `${raiz}e`, raiz];
}

/** Distância de edição com troca de vizinhas ("estacionamentu", "supermecado", "farmasia"). */
function distancia(a: string, b: string, teto: number): number {
  if (Math.abs(a.length - b.length) > teto) return teto + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** 2 = a mesma palavra (ou plural/diminutivo dela), 1 = erro pequeno do reconhecedor, 0 = outra. */
function casa(dita: string, termo: string): 0 | 1 | 2 {
  if (dita === termo) return 2;
  const s = singular(dita);
  if (s === termo || s === singular(termo)) return 2;
  if ([dita, s].some((f) => semDiminutivo(f).some((x) => x === termo || x === singular(termo)))) return 2;
  if (dita.length < 5 || termo.length < 5 || dita[0] !== termo[0] || COMUNS.has(dita) || COMUNS.has(s) || /\d/.test(dita)) return 0;
  return [dita, s].some((f) => quaseIgual(f, termo)) ? 1 : 0;
}

/** Letras que o reconhecedor troca porque soam parecido: "farmasia", "estacionamentu", "mequi". */
const SOAM_PARECIDO = new Set(["sz", "sc", "ck", "ou", "ei", "sx", "gj", "lu", "mn", "qk", "cq"].flatMap((p) => [p, `${p[1]}${p[0]}`]));

/**
 * Erro pequeno do reconhecedor. Palavra curta (5 ou 6 letras) é perigosa: "Camila" fica a uma
 * letra de "camisa", "férias" de "feira". Nela só vale letra a mais ou a menos, duas letras
 * invertidas ou uma troca que SOA parecido. Com 7 letras ou mais, qualquer troca de uma letra; com
 * 9 ou mais, até duas.
 */
function quaseIgual(a: string, b: string): boolean {
  const menor = Math.min(a.length, b.length);
  if (menor >= 7) {
    const teto = menor >= 9 ? 2 : 1;
    return distancia(a, b, teto) <= teto;
  }
  if (distancia(a, b, 1) > 1) return false;
  if (a.length !== b.length) return true;
  const dif = [...a].map((ch, i) => i).filter((i) => a[i] !== b[i]);
  if (dif.length === 1) return SOAM_PARECIDO.has(`${a[dif[0]]}${b[dif[0]]}`);
  // Duas vizinhas invertidas ("farmcia" não; "frutsa" → "frutas").
  return dif.length === 2 && dif[1] === dif[0] + 1;
}

type Compilada = { entrada: Entrada; termo: string; palavras: string[] };
const COMPILADO: Compilada[] = VOCABULARIO_FALADO.flatMap((entrada) =>
  entrada.termos.map((termo) => ({ entrada, termo, palavras: palavrasDe(termo) })),
);
/** Toda palavra que aparece em algum termo: a palavra exata nunca é "corrigida" para outra. */
const PALAVRAS_CONHECIDAS = new Set(COMPILADO.flatMap((c) => c.palavras));

type Candidato = { c: Compilada; exato: boolean; inicio: number };

/**
 * A ordem entre dois termos que casaram: o exato; o de mais palavras ("pão de açúcar" ganha de
 * "pão"); o do pet, que diz para quem foi ("vacina do cachorro", "comida do gato"); o que veio
 * primeiro na frase, porque é o que ela disse que comprou ("botei gás no fogão").
 */
function melhorQue(a: Candidato, b: Candidato): boolean {
  if (a.exato !== b.exato) return a.exato;
  if (a.c.palavras.length !== b.c.palavras.length) return a.c.palavras.length > b.c.palavras.length;
  const petA = a.c.entrada.grupo === "pet";
  const petB = b.c.entrada.grupo === "pet";
  if (petA !== petB) return petA;
  return a.inicio < b.inicio;
}

export type AchadoFalado = {
  parentCategory: ParentCategory;
  subcategory: string;
  grupo?: GrupoFalado;
  /** O termo do vocabulário que casou, sem acento ("pao de acucar"). */
  termo: string;
  /** Quantas palavras o termo tem: a expressão ("uber eats", "seguro do carro") sabe mais que a palavra solta. */
  palavras: number;
  /** Casou sem precisar corrigir erro do reconhecedor. */
  exato: boolean;
};

/**
 * O termo do vocabulário falado que aparece na frase, ou null. Entre vários, ver `melhorQue`.
 */
export function acharNoVocabulario(texto: string): AchadoFalado | null {
  const ditas = palavrasDe(texto);
  if (!ditas.length) return null;
  let melhor: Candidato | null = null;
  for (const c of COMPILADO) {
    const n = c.palavras.length;
    for (let i = 0; i + n <= ditas.length; i += 1) {
      let exato = true;
      let ok = true;
      for (let k = 0; k < n; k += 1) {
        const dita = ditas[i + k];
        const r = PALAVRAS_CONHECIDAS.has(dita) && dita !== c.palavras[k] ? (casa(dita, c.palavras[k]) === 2 ? 2 : 0) : casa(dita, c.palavras[k]);
        if (r === 0) {
          ok = false;
          break;
        }
        if (r === 1) exato = false;
      }
      if (!ok) continue;
      if (!melhor || melhorQue({ c, exato, inicio: i }, melhor)) melhor = { c, exato, inicio: i };
      break;
    }
  }
  if (!melhor) return null;
  const { entrada, palavras } = melhor.c;
  const achado: AchadoFalado = {
    parentCategory: entrada.parentCategory,
    subcategory: entrada.subcategory,
    termo: palavras.join(" "),
    palavras: palavras.length,
    exato: melhor.exato,
  };
  if (entrada.grupo) achado.grupo = entrada.grupo;
  return achado;
}

/**
 * Palavras que não dizem O QUE foi: nunca viram regra aprendida. "compra", "coisa", "gasto"
 * pegariam todo lançamento dali para frente.
 */
const NAO_ENSINA = new Set(
  (
    "a o as os um uma uns umas de em no na nos nas num numa com pra para pro por pelo pela e ou que se eu me meu minha meus minhas " +
    "seu sua dele dela nosso nossa hoje ontem agora aqui ali la isso isto aquilo esse essa este esta so mais menos muito muita " +
    "compra compras comprinha coisa coisas coisinha coisinhas gasto gastos gastei paguei comprei pagamento pago paga conta contas " +
    "despesa despesas valor total reais real dinheiro grana negocio negocios parada item itens produto produtos lugar loja lojinha " +
    "besteira besteiras bobeira bobagem outro outra outros outras algo algum alguma tudo nada dia mes semana vez fiz dei tive " +
    "pedi peguei mandei transferi passei botei coloquei fui foi deu"
  ).split(" "),
);

/** Os termos inteiros do vocabulário ("pao de acucar", "conta de luz"): não se partem no "de". */
const TERMOS_INTEIROS = new Set(COMPILADO.map((c) => c.palavras.join(" ")));
/** Depois destas vem o LUGAR: "almoço no Coco Bambu", "gasolina no posto Shell". */
const LUGAR = new Set(["no", "na", "nos", "nas", "num", "numa", "em"]);
const DE = new Set(["de", "do", "da", "dos", "das"]);

/**
 * A palavra-chave de uma fala, para guardar a correção dela (14/10/2026): quando ela troca a
 * categoria que a voz sugeriu (ou escolhe uma quando não veio nenhuma), a próxima fala com essa
 * palavra já vem certa.
 *
 * - O lugar, quando ela disse onde: "Almoço no Coco Bambu" ensina "coco bambu" (não todo almoço).
 * - Senão, a primeira coisa dita: "Ração da Mel" ensina "racao" (o que vem depois de "do/da" é
 *   dono, não o que ela comprou), "Escola do Pedro" ensina "escola".
 * - O "de" que é parte do nome fica: "pão de açúcar", "mensalidade da academia".
 * - Nada específico ("compra", "coisa", "gasto", "umas coisinhas"): null, e nada é guardado.
 *
 * Volta minúsculo e sem acento, no formato das regras da importação (normalizeMerchant).
 */
export function chaveParaAprender(fala: string): string | null {
  // Sem trocar "da" por "de": a regra casa com a fala como ela foi dita (normalizeMerchant).
  const ditas = semAcento(fala)
    .split(" ")
    .filter((p) => p && !/\d/.test(p));
  // Pedaços seguidos de palavras que dizem algo; cada um lembra se veio depois de "no/na".
  const pedacos: { palavras: string[]; lugar: boolean }[] = [];
  let atual: string[] = [];
  let lugar = false;
  let separador = "";
  const fecha = () => {
    if (atual.length) pedacos.push({ palavras: atual, lugar });
    atual = [];
  };
  for (const p of ditas) {
    // "de" no meio de um pedaço pode ser parte do nome ("pão de açúcar"): decide depois.
    if (DE.has(p) && atual.length) atual.push(p);
    else if (NAO_ENSINA.has(p) || DE.has(p)) {
      fecha();
      separador = p;
    } else {
      if (!atual.length) lugar = LUGAR.has(separador);
      atual.push(p);
    }
  }
  fecha();
  const uteis = pedacos
    .map((p) => ({ ...p, palavras: partirNoDono(p.palavras) }))
    .filter((p) => p.palavras.length && p.palavras.join("").length >= 3);
  if (!uteis.length) return null;
  // O lugar só ganha quando diz mais que a coisa: nome que o vocabulário não conhece ("Fasano")
  // ou de duas palavras ("coco bambu", "posto shell"). "Gás no fogão" ensina "gas".
  const lugarUtil = uteis.find((p) => p.lugar && (p.palavras.length > 1 || !PALAVRAS_CONHECIDAS.has(p.palavras[0])));
  const escolhido = lugarUtil ?? uteis[0];
  return escolhido.palavras.slice(0, 3).join(" ");
}

/**
 * "racao da mel" → "racao": o que vem depois do "de/da/do" é dono, a não ser que seja parte do
 * termo ("pao de acucar") ou outra coisa do vocabulário ("mensalidade da academia").
 */
function partirNoDono(palavras: string[]): string[] {
  const semDeNaPonta = DE.has(palavras[palavras.length - 1]) ? palavras.slice(0, -1) : palavras;
  if (TERMOS_INTEIROS.has(palavrasDe(semDeNaPonta.join(" ")).join(" "))) return semDeNaPonta;
  const i = semDeNaPonta.findIndex((p) => DE.has(p));
  if (i < 0) return semDeNaPonta;
  const depois = semDeNaPonta.slice(i + 1).join(" ");
  if (depois && acharNoVocabulario(depois)?.exato) return semDeNaPonta;
  return semDeNaPonta.slice(0, i);
}
