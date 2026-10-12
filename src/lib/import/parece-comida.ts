import type { Classification } from "./classify";

/**
 * Comida que o dicionário não pegava (12/10/2026). A Dani, importando as faturas do cartão EQI/BTG:
 * "Costelão do gaúcho. É lógico que é comida. [...] Sendo que estava escrito restaurante."
 *
 * Três buracos, todos aqui:
 *
 * 1. O nome CORTADO pela maquininha/fatura. A fatura do BTG corta o nome em ~21 letras, e a
 *    última palavra chega pela metade: "Oguru Itaim Restauran", "Gcc Comercio De Alime",
 *    "Battisti Battisti Alim". O dicionário casa palavra inteira, então "restauran" não era
 *    "restaurante". `completarPalavraCortada` completa SÓ a última palavra (é onde o corte cai) e
 *    SÓ para palavras de tipo de comida, com um mínimo de letras por palavra para não inventar.
 *
 * 2. O nome GRUDADO: "Jesrestaurante", "Nanurestauran", "Botecoritamaria", "Emporiotopmix".
 *    `descolarPalavraDeComida` separa o tipo de lugar do resto ("jes restaurante").
 *
 * 3. Nome que tem cara de comida sem ser palavra certeira ("Sabor da Terra", "Cozinha da Vó",
 *    "Doces da Ana"). Não entra no dicionário (que separa com confiança alta): é o sinal de
 *    segunda linha `pareceComida`, motivo "parece_comida", confiança média. Entra separado na
 *    revisão, com o porquê à vista, e um toque troca.
 */

/** Tipos de lugar de comida que aparecem grudados no nome, do mais comprido pro mais curto. */
const TIPOS = [
  "restaurante", "pizzaria", "padaria", "lanchonete", "churrascaria", "hamburgueria", "sorveteria", "confeitaria",
  "pastelaria", "cafeteria", "panificadora", "emporio", "boteco", "yakisobaria",
].sort((a, b) => b.length - a.length);
/** Grudado DEPOIS de outro nome, inteiro ou cortado no fim: "jesrestaurante", "nanurestauran". */
const DEPOIS_RE = new RegExp(`(?:^| )([a-z]{2,})(${[...TIPOS, "restaurant", "restauran"].join("|")})(?= |$)`, "g");
/** Grudado ANTES de outro nome: "emporiotopmix", "botecoritamaria" (3+ letras depois, senão é plural). */
const ANTES_RE = new RegExp(`(?:^| )(${TIPOS.join("|")})([a-z]{3,})(?= |$)`, "g");

/** "jesrestaurante" → "jes restaurante"; "emporiotopmix" → "emporio topmix". Texto já sem acento e minúsculo. */
export function descolarPalavraDeComida(texto: string): string {
  return texto
    .replace(DEPOIS_RE, (m, antes: string, tipo: string) => `${m.startsWith(" ") ? " " : ""}${antes} ${tipo}`)
    .replace(ANTES_RE, (m, tipo: string, depois: string) => `${m.startsWith(" ") ? " " : ""}${tipo} ${depois}`);
}

/**
 * Palavra de tipo de comida e o mínimo de letras para aceitar o pedaço cortado como ela.
 * "alim" (4) já é alimentos: nenhum outro ramo começa assim. "pada" não (pode ser nome): "padar" sim.
 */
const CORTADAS: [string, number][] = [
  ["restaurante", 6],
  ["alimentos", 4],
  ["alimentacao", 9],
  ["padaria", 5],
  ["panificadora", 6],
  ["lanchonete", 6],
  ["pizzaria", 6],
  ["churrascaria", 7],
  ["hamburgueria", 8], // "hamburg" é Novo Hamburgo (RS) cortado
  ["confeitaria", 7],
  ["sorveteria", 7],
  ["cafeteria", 6],
  ["pastelaria", 7],
  ["supermercado", 7],
  ["mercearia", 6],
  ["hortifruti", 6],
  ["gastronomia", 6],
  ["culinaria", 6],
];

/** "oguru itaim restauran" → "oguru itaim restaurante". Só a última palavra, só tipo de comida. */
export function completarPalavraCortada(texto: string): string {
  const m = texto.match(/(?:^| )([a-z]+)$/);
  if (!m) return texto;
  const ultima = m[1];
  for (const [inteira, minimo] of CORTADAS) {
    if (ultima.length >= minimo && ultima.length < inteira.length && inteira.startsWith(ultima)) {
      return texto.slice(0, texto.length - ultima.length) + inteira;
    }
  }
  return texto;
}

/**
 * Palavras com cara de comida, fracas demais para o dicionário. "Paes" e "mesa" ficaram de fora:
 * são sobrenome (medido na base em 12/10/2026).
 */
const CARA_DE_COMIDA = [
  "sabor", "sabores", "gourmet", "cozinha", "cozinhas", "kitchen", "doce", "doces", "delicia", "delicias", "quitute", "quitutes",
  "tempero", "temperos", "armazem", "brasa", "forno", "fornalha", "panela", "panelas", "massa", "massas", "pao",
  "queijo", "queijos", "frango", "carne", "carnes", "peixe", "peixes", "fruta", "frutas", "vinho", "vinhos", "cerveja",
  "cervejas", "churras", "tapioca", "eats", "chef", "cheff", "comedoria", "petisco", "petiscos", "caldo", "caldos",
];
/**
 * Palavras que dizem que o lugar é OUTRA coisa: com elas, "Sabor de Casa Imóveis" e "Doce Lar Móveis"
 * não viram comida. Só barra o sinal fraco; o dicionário tem as regras dele.
 */
const NAO_E_COMIDA = [
  "imoveis", "imobiliaria", "pneu", "pneus", "auto", "autopecas", "pecas", "moveis", "confeccoes", "confeccao", "confecc",
  "roupa", "roupas", "moda", "modas", "calcados", "cosmeticos", "perfumaria", "farma", "farmacia", "drogaria", "pet", "petshop",
  "veterinaria", "construcao", "materiais", "material", "tintas", "eletro", "eletronicos", "informatica", "celular", "celulares",
  "papelaria", "joias", "otica", "clinica", "estetica", "salao", "cabeleireiro", "beleza", "academia", "escola", "curso",
  "transportes", "logistica", "seguros", "contabilidade", "advocacia", "engenharia", "utilidades", "presentes", "decoracao",
  "brinquedos", "ferragens", "madeiras", "lavanderia", "hotel", "pousada", "veiculos", "motos", "locadora", "tecidos",
  "lar", "colchoes", "mesas", "cadeiras",
];
const palavra = (lista: string[]) => new RegExp(`(?:^| )(?:${lista.join("|")})(?= |$)`);
const CARA_DE_COMIDA_RE = palavra(CARA_DE_COMIDA);
const NAO_E_COMIDA_RE = palavra(NAO_E_COMIDA);

/**
 * Sinal de segunda linha: o nome tem cara de comida e nada nele diz o contrário. `texto` é a
 * descrição já em palavras (sem acento, minúscula). Devolve Alimentação › Restaurante.
 */
export function pareceComida(texto: string): Classification | null {
  // Pix e transferência vão pra gente: "Paes", "Mesa" e "Carneiro" são sobrenome.
  if (/(?:^| )(?:pix|ted|doc|transferencia|transf)(?= |$)/.test(texto)) return null;
  if (!CARA_DE_COMIDA_RE.test(texto) || NAO_E_COMIDA_RE.test(texto)) return null;
  return { parentCategory: "ALIMENTACAO", subcategory: "Restaurante" };
}
