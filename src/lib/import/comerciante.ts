/**
 * QUEM recebeu o dinheiro, numa chave estável: "o comerciante normalizado".
 *
 * É a chave que o motor usa para tudo que compara uma linha com outra: aprender com ela
 * ("ManyChat é Dani Invest"), aplicar o que ela respondeu às linhas iguais da mesma importação e
 * dos outros meses, e a base comunitária (o que várias pessoas escolheram para a mesma loja).
 *
 * Por que uma chave nova (12/10/2026): a antiga (normalizeMerchant) guardava a descrição inteira,
 * com o "Pix enviado", o horário e a categoria que o BTG escreve na frente ("09h12 Lazer e
 * Entretenimento Pix enviado Bus Servicos..."), o banco do outro lado do Pix e a cidade. O mesmo
 * comerciante virava uma chave diferente a cada extrato ("Manychat", "MANYCHAT.COM", "EBN*MANYCHAT
 * SAO PAULO"), e o que ela ensinava num mês não valia no outro.
 *
 * Puro, sem dependência do app: o script da base comunitária roda com este mesmo arquivo.
 */

/**
 * Minúsculo, sem acento, letra e número separados, só letras/números/espaço simples.
 *
 * Letra de outro alfabeto fica (14/10/2026): a fatura de Israel vem em hebraico, e com só a-z o
 * supermercado dela ("טיב טעם") virava chave vazia, que não vira regra. No alfabeto latino
 * continua só a-z, como antes ("Nº", "1ª" e "ø" dão espaço), para as chaves das regras que já
 * existem não mudarem.
 */
export function semAcentoNemPontuacao(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    // Abreviação hebraica com aspas é uma palavra só: בע"מ (Ltda), חו"ל (exterior), ד"ר (doutor).
    .replace(/([\u05D0-\u05EA])["'\u05F3\u05F4]+(?=[\u05D0-\u05EA])/g, "$1")
    .replace(/[^\P{Script=Latin}a-z]/gu, " ")
    .replace(/[^\p{L}0-9*]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O que o BTG (e outros) escreve antes do nome: "00h14 Seguro Pix enviado ...", "22h21
 * Alimentação Compra no débito autorizada ...". A categoria do banco só sai quando vem logo
 * depois do horário: sozinha, "Transporte" pode ser o nome da empresa.
 */
const CATEGORIAS_DO_BANCO = [
  "lazer e entretenimento", "cuidados pessoais", "outra categoria", "outras categorias", "alimentacao", "transferencia",
  "transferencias", "contas", "compras", "doacoes", "seguro", "seguros", "tarifas", "saude", "transporte", "educacao",
  "moradia", "viagem", "viagens", "servicos", "investimentos", "mercado", "restaurantes", "casa", "pets", "vestuario",
  "impostos", "assinaturas", "beleza", "bares e restaurantes", "supermercado",
].sort((a, b) => b.length - a.length);
const HORARIO_E_CATEGORIA = new RegExp(`^\\d{1,2}h\\d{2}\\s+(?:(?:${CATEGORIAS_DO_BANCO.join("|")})\\s+)?`);
const SO_A_CATEGORIA = new RegExp(`^\\d{1,2}h\\d{2}\\s+(${CATEGORIAS_DO_BANCO.join("|")})\\s+`);

/**
 * A categoria que o banco escreveu NA PRÓPRIA descrição, logo depois do horário (extrato do BTG:
 * "22h21 Alimentação Compra no débito autorizada Mazu Restaurante" → "alimentacao"). Antes ela
 * só era cortada fora da chave e jogada no lixo; agora vira sinal do motor (motivo "ramo_do_banco").
 * Pix, TED e boleto ficam de fora (ver abaixo).
 */
export function categoriaNaFrenteDaDescricao(descricao: string | null | undefined): string | null {
  if (!descricao) return null;
  const t = semAcentoNemPontuacao(descricao);
  // Só compra no cartão: aí o ramo vem do cadastro da maquininha. No Pix e na transferência o BTG
  // chuta (o Pix pra uma empresa de passagem de ônibus vinha como "Lazer e Entretenimento").
  if (/\b(pix|ted|doc|transferencia|boleto)\b/.test(t)) return null;
  return t.match(SO_A_CATEGORIA)?.[1] ?? null;
}

/**
 * O jeito que o dinheiro saiu, escrito pelo banco antes do nome. Ordem importa: o mais comprido
 * primeiro ("transferencia enviada pelo pix" antes de "pix").
 */
const OPERACOES = [
  "transferencia enviada pelo pix", "transferencia recebida pelo pix", "transferencia enviada pix", "transferencia recebida pix",
  "transferencia enviada", "transferencia recebida", "devolucao de pix enviada", "devolucao de pix recebida",
  "pix enviado", "pix recebido", "pix enviada", "pix recebida", "pix qrs", "pix qr code", "pix transf", "pix pagamento", "pix",
  "compra no debito autorizada", "compra no debito", "compra no credito", "compra com cartao", "compra cartao debito",
  "compra cartao credito", "compra cartao", "compra debito", "compra credito", "compra internacional", "compra online", "compra",
  "pagamento de boleto efetuado", "pagamento de boleto devolvido", "pagamento de boleto", "pagamento efetuado", "pagamento de",
  "pagamento", "pag boleto", "pagto", "pgto", "debito automatico", "deb automatico", "deb aut", "debito aut", "debito em conta",
  "debito", "deb", "credito", "cred", "ted enviada", "ted recebida", "ted", "doc enviado", "doc", "transferencia", "transf",
  "elo", "visa electron", "visa", "mastercard", "maestro", "master", "cartao", "rshop", "int", "sispag", "boleto",
  "cancelamento", "estorno", "nupay", "apple pay", "google pay", "samsung pay", "contactless", "aprovada", "autorizada",
].sort((a, b) => b.length - a.length);
const OPERACAO_NA_FRENTE = new RegExp(`^(?:(?:${OPERACOES.join("|")})(?: |$))+`);

/**
 * Intermediário de pagamento grudado na frente do nome com asterisco: "PAG*LOJA", "IFD*RESTAURANTE",
 * "EC *ESTRELA", "MP*", "EBN*CANVA", "HTM*CURSO", "PP*" (PayPal), "DL*" (dLocal), "SUMUP *",
 * "JIM.COM*", "PG *". O nome de verdade vem depois do asterisco.
 */
const INTERMEDIARIO =
  /^(?:pag|pg|ifd|ec|mp|ebn|htm|pp|dl|dm|jim com|jim|hna|mlp|ppro|iz|sq|tst|sumup|paypal|pagseguro|pagbank|mercadopago|picpay|ame|mov|lpv|sm|pay)\s?\*\s?/;
/** Sem asterisco, só os nomes compridos o bastante para não comer o nome da loja ("EC" sozinho pode ser nome). */
const INTERMEDIARIOS_SEM_ASTERISCO = /^(?:pagseguro|pagbank|sumup|mercadopago|paypal|picpay|ifd|qrs|dl|ebn|ebw|hna|cp|mp|ppro|pg|pay|ec|htm|nupay)\s+(?=\S)/;

/** Sobra de fim: cidade, UF, país, "ltda", "s a", "me", número do pedido, "com br". */
const FIM_RUIDO = new RegExp(
  "(?:\\s+(?:" +
    [
      "sao paulo", "rio de janeiro", "curitiba", "belo horizonte", "brasilia", "porto alegre", "salvador", "recife", "fortaleza",
      "florianopolis", "goiania", "campinas", "osasco", "barueri", "sao jose", "santos", "londrina", "maringa", "joinville",
      "cwb", "spo", "sp", "rj", "pr", "sc", "rs", "mg", "ba", "pe", "ce", "df", "go", "es", "br", "bra", "bras", "brasil",
      "usa", "us", "irl", "ie", "gb", "nld", "com", "net", "org", "www", "inc", "llc", "ltd", "ltda", "eireli", "epp", "me", "mei",
      "s a", "sa", "cia", "comercio", "servicos", "sub", "assinatura", "subscription", "plus", "premium", "mensal", "anual",
    ].join("|") +
    "))+$",
);

/** Palavras que nunca são o nome (artigo, meio de pagamento, ruído do banco). */
const VAZIAS = new Set([
  "no", "na", "de", "da", "do", "das", "dos", "em", "com", "para", "pra", "pelo", "pela", "via", "e", "o", "a",
  "enviado", "enviada", "recebido", "recebida", "efetuado", "efetuada", "devolvido", "devolvida", "autorizada", "autorizado",
  "parcela", "parc", "parcelado", "lancamento", "fatura", "agencia", "conta", "cc", "nu", "pagamentos", "ip",
  "ltda", "limitada", "eireli", "epp", "nupay",
  // Cartão de Israel: "הוראת קבע" é débito automático, "בע״מ" é Ltda, "תשלום X מתוך Y" é parcela,
  // "חו״ל אתר" é compra em site de fora, "אונליין" é online. Dizem como, não onde.
  "הוראת", "קבע", "בעמ", "תשלום", "תשלומים", "מתוך", "אונליין", "חול", "אתר",
]);

/** Termos que não dizem QUAL é o lugar: "bar", "loja", "posto" sozinhos são um tipo, não um nome. */
const SO_TIPO = new Set(["bar", "loja", "lojas", "posto", "lanche", "restaurante", "mercado", "farmacia", "padaria", "cafe", "casa", "pix", "ted", "doc"]);

/**
 * "Manychat", "MANYCHAT.COM", "EBN*MANYCHAT SAO PAULO BR", "Compra no débito - MANYCHAT INC" → "manychat".
 * "Transferência enviada pelo Pix - Ricardo Romero Colombo - •••.143.577-•• - ITAÚ ..." → "ricardo romero colombo".
 * Devolve "" quando não sobra nome nenhum ("Compra no débito", "PIX ENVIADO").
 */
export function chaveDoComerciante(descricao: string | null | undefined): string {
  if (!descricao) return "";
  // O que vem depois do CPF/CNPJ e do "Agência:" é o banco do outro lado, não o comerciante.
  let base = descricao;
  const doc = base.search(/\s+-\s+([•*]{3}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (doc > -1) base = base.slice(0, doc);
  base = base.replace(/\s+-\s+[^-]*\(\d{3,4}\)\s*Ag[eê]ncia.*$/i, "").replace(/\s+Ag[eê]ncia:.*$/i, "");
  // Parcela "(2/6)", "PARC 02/10", "2 de 6", data "12/05", número de pedido.
  base = base.replace(/\(?\b\d{1,2}\s*(\/|de)\s*\d{1,2}\)?/gi, " ").replace(/\bparc(ela)?\b/gi, " ");
  // ".com" e ".com.br" grudados no nome: "MANYCHAT.COM" é "manychat".
  base = base.replace(/\.(com|net|org)(\.br)?\b/gi, " ");
  let t = semAcentoNemPontuacao(base)
    // Fatura que gruda a cidade no nome: "UBERRIDESSAO PAULOBR", "IFOOD CLUBOSASCOBRA".
    .replace(/([a-z]{3,})(sao paulo|osasco|barueri|curitiba)/g, "$1 $2")
    .replace(/\b(sao paulo|osasco|barueri|curitiba)(br|bra|bras)\b/g, "$1");
  t = t.replace(HORARIO_E_CATEGORIA, "");
  // Operação e intermediário podem vir alternados ("Compra no débito - PAG*LOJA"): repete até parar.
  for (let i = 0; i < 4; i += 1) {
    const antes = t;
    t = t.replace(OPERACAO_NA_FRENTE, "").replace(/^\s*-?\s*/, "");
    t = t.replace(INTERMEDIARIO, "").replace(INTERMEDIARIOS_SEM_ASTERISCO, "");
    if (t === antes) break;
  }
  t = t
    .replace(/\*/g, " ")
    // Número de 3+ dígitos (loja 1234, pedido, CPF picado) não identifica ninguém; o curto no
    // meio do nome fica ("Clube dos 50"), e "99" (o app) sempre fica.
    // "IFD1234", "DROGASIL1234": letra e número grudados viram palavras separadas.
    .replace(/([a-z])(?=\d)/g, "$1 ")
    .replace(/(\d)(?=[a-z])/g, "$1 ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/^(?:(?!99\b)\d+\s+)+/, "")
    .replace(/\s+/g, " ")
    .trim();
  // Palavra repetida em seguida ("UBER *UBER *TRIP", "99APP *99APP") conta uma vez.
  const palavras = t
    .split(" ")
    .filter((p) => p && !VAZIAS.has(p) && (p.length > 1 || /\d/.test(p)))
    .filter((p, i, todas) => p !== todas[i - 1]);
  t = palavras.join(" ").replace(FIM_RUIDO, "").trim();
  // Até 4 palavras: o resto costuma ser cidade, filial ou complemento ("Grupo Madero Batel Curitiba").
  return t.split(" ").filter(Boolean).slice(0, 4).join(" ");
}

/**
 * A chave serve para aprender e comparar? Precisa de nome de verdade: uma palavra que não seja só
 * o tipo de lugar ("bar", "posto"), com 3 letras ou mais no total ("kfc", "99" contam).
 */
export function chaveUtil(chave: string): boolean {
  if (!chave) return false;
  const proprias = chave.split(" ").filter((p) => !SO_TIPO.has(p) && (p.length > 1 || /\d/.test(p)));
  const letras = proprias.join("").replace(/[^\p{L}]/gu, "");
  return letras.length >= 3 || proprias.includes("99");
}

/**
 * Loja que vende de tudo (13/10/2026): Amazon, Mercado Livre, Mercado Pago, Shopee, Magalu,
 * Americanas, AliExpress, Temu, TikTok Shop. O nome não diz o que foi comprado (um livro, uma
 * panela, um batom), então a categoria é sempre perguntada: nem o dicionário, nem a base da
 * comunidade, nem a resposta de um mês passado decidem sozinhos. A Dani tinha a Amazon e o
 * Mercado Pago indo para "Cuidado pessoal" em todas as faturas por causa de uma resposta só.
 * Fica de fora o que é serviço com nome próprio (Amazon Prime, Music, Kindle, AWS) e a loja que
 * passou pelo Mercado Pago com o nome dela ("MERCADOPAGO*LOJAX" é a LOJAX). Shein é roupa: não entra.
 */
const LOJA_DE_TUDO = / (amazon|amzn|mercado ?livre|mercadoli(vre)?|mercado ?pago|shopee|shpp|magalu|magazine luiza|americanas|aliexpress|ali express|temu|tiktok shop) /;
const SERVICO_DA_AMAZON = / (amazon|amzn) (prime|music|video|kindle|aws|web services|ad free|digital) /;

export function ehLojaDeTudo(descricao: string | null | undefined): boolean {
  const chave = ` ${chaveDoComerciante(descricao)} `;
  return LOJA_DE_TUDO.test(chave) && !SERVICO_DA_AMAZON.test(chave);
}

/**
 * A chave `regra` vale para a linha de chave `linha`? Vale quando as palavras da regra são o
 * COMEÇO das palavras da linha: a regra "anthropic" pega "anthropic claude"; a regra "uber eats"
 * não pega "uber". Palavra inteira sempre ("maria" não pega "mariana").
 */
export function chaveCobre(regra: string, linha: string): boolean {
  if (!regra || !linha) return false;
  return linha === regra || linha.startsWith(`${regra} `);
}
