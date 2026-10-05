import { classify, normalizeMerchant } from "@/lib/import/classify";

/**
 * Raio-X dos pequenos gastos: acha o que se repete todo mês no extrato — assinaturas e hábitos
 * — e mostra quanto isso custa por ano. É a aula da Dani virando conta: "muitas pessoas acreditam
 * que controlam suas despesas, mas ao registrá-las, percebem que perdem dinheiro em compras
 * diárias pequenas".
 *
 * Regra de "se repete": o mesmo estabelecimento (descrição normalizada sem códigos, ou a marca, pra
 * serviços que mudam a descrição todo mês) aparece em pelo menos 3 meses diferentes. Moradia, saúde, educação e
 * impostos ficam de fora: são essenciais, não "pequenos gastos" pra repensar.
 *
 * Puro, sem banco.
 */

export type RaioXLancamento = {
  description: string | null;
  amount: number;
  year: number;
  month: number;
  parentCategory: string | null;
  /** Subcategoria ("Investimento" = aplicação lançada como débito, não gasto). */
  subcategory?: string | null;
};

export type RaioXItem = {
  /** Chave estável do gasto (a descrição normalizada): é o que guarda a decisão da pessoa. */
  chave: string;
  nome: string;
  mensal: number;
  anual: number;
  meses: number;
  /** Uma cobrança por mês (assinatura) ou várias (hábito, como café na rua). */
  tipo: "assinatura" | "habito";
  vezesPorMes: number;
};

const MIN_MESES = 3;
const TETO_MENSAL = 800;
const FORA = new Set(["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]);
/** Academia cai em Saúde no classificador, mas é a assinatura clássica de repensar: essa passa. */
const ACADEMIA = /smart\s*fit|academia|gympass|wellhub|bluefit|bodytech|selfit|totalpass/;
/**
 * Palavras de extrato que não são estabelecimento ("PIX ENVIADO", "DÉBITO AUTOMÁTICO", "INT PAG
 * TIT BANCO 237"): uma descrição feita só delas juntaria pagamentos que não têm nada a ver um com
 * o outro e diria que é "o mesmo gasto".
 */
const GENERICAS = new Set([
  "enviado", "recebido", "enviada", "recebida", "envio", "transferencia", "transf", "saque", "boleto", "fatura", "tarifa",
  "estorno", "deposito", "pagto", "pag", "automatico", "pelo", "pela", "qr", "code", "efetuado", "efetuada", "cobranca",
  "titulo", "conta", "iof", "juros", "encargos", "rotativo", "internacional", "mora", "multa", "via", "para", "de", "do", "da",
  "int", "tit", "eletron", "banco", "sispag", "deb",
]);
const soPalavrasGenericas = (chave: string) => chave.split(" ").every((p) => GENERICAS.has(p) || p.length <= 2);
/** Juros, IOF, multa e encargos não são "gasto pra cancelar": é custo de dívida, outro assunto. */
const ENCARGO = /\b(juros|iof|multa|encargos?|saque)\b/;
/** Dinheiro indo pra ela mesma ou pagando a fatura: não é gasto, muito menos "assinatura pra cancelar". */
const NAO_E_GASTO = /\b(aplicacao|resgate|caixinha|rdb|cdb|tesouro direto|pagamento de fatura|pagamento fatura|pgto fatura|pag fatura|fatura do cartao|mesma titularidade|entre contas)\b/;
/** CPF mascarado ("•••.123.456-••") = transferência pra uma PESSOA, não assinatura pra cancelar. */
const CPF_MASCARADO = /[•*]{3}\.?\s*\d{3}/;
const TRANSFERENCIA = /\b(pix|ted|doc|transf|transferencia)\b/;
/** Como o banco diz o meio de pagamento ("Compra no débito", "DEB MC", "VISA ELECTRON", "RSHOP"): não é o nome da loja. */
const MEIO_DE_PAGAMENTO = new Set(["no", "com", "deb", "mc", "visa", "electron", "via", "nupay", "rshop", "elo", "master", "mastercard", "maestro"]);
/**
 * Serviços que mudam a descrição todo mês ("SPOTIFY P1234ABCD", "IFD*BURGER KING", "UBER *TRIP"):
 * a chave vira a marca, senão a mesma assinatura se esconde em pedaços que nunca chegam a 3 meses.
 * As expressões são ancoradas pra "DISNEYLANDIA BRINQUEDOS" ou "UBERLANDIA" não virarem a marca.
 */
const MARCAS: [RegExp, string][] = [
  [/\bifood\b|\bifd\b|ifd\*/, "ifood"],
  [/uber\s*\*?\s*eats|ubereats/, "uber eats"],
  [/\buber\b/, "uber"],
  [/\b99\s*food|\b99food\b/, "99 food"],
  [/\b99\s*(app|pop|tecnologia|taxi|taxis|ride)\b|\b99app\b|\b99pop\b/, "99 app"],
  [/\brappi\b/, "rappi"],
  [/amazon\s*prime|amazonprime|prime\s*video/, "amazon prime"],
  [/netflix/, "netflix"],
  [/spotify/, "spotify"],
  [/\bdisney\b|disney\s*\+|disneyplus/, "disney"],
  [/\bhbo\b|\bmax\.com\b/, "max"],
  [/deezer/, "deezer"],
  [/youtube\s*(premium|music)|google\s*\*?\s*youtube|youtube\.com/, "youtube"],
  [/apple\.com|\bitunes\b/, "apple"],
];
/** Parcela de compra ("LOJA X 03/10", "PARC 3/10", "PARC03/10") não é assinatura: tem fim. */
const PARCELA_EXPLICITA = /\bparc(ela)?(?=\b|\d)/i;
const FRACAO = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/g;
/** Até 15% de diferença entre cobranças ainda é "o mesmo valor todo mês" (reajuste, câmbio). */
const VARIACAO_ASSINATURA = 1.15;
export const RAIOX_TAXA_MENSAL = 0.009;

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** A chave do gasto: a marca, se for um serviço conhecido; senão a descrição sem datas, códigos e meio de pagamento. */
export function chaveRaioX(description: string): string {
  const baixa = semAcento(description);
  for (const [re, marca] of MARCAS) if (re.test(baixa)) return marca;
  const limpa = baixa
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ")
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ")
    .replace(/[*\-/.()_=#,;:|+]/g, " ");
  // Código que mistura letra e número ("P1234ABCD", "IFD1234") muda a cada cobrança.
  const semCodigo = limpa
    .split(/\s+/)
    .filter((tok) => !(/[a-z]/.test(tok) && /\d/.test(tok)))
    .join(" ");
  return normalizeMerchant(semCodigo)
    .split(" ")
    .filter((p) => p.length > 1 && !MEIO_DE_PAGAMENTO.has(p))
    .join(" ")
    .slice(0, 100);
}

/** Nome pra mostrar: o pedaço da descrição que diz QUEM recebeu, não "Transferência enviada pelo Pix - ". */
function nomeLegivel(description: string): string {
  const partes = description.trim().replace(/\s+/g, " ").split(/\s+-\s+/);
  const boa = partes.find((p) => {
    const k = chaveRaioX(p);
    return k.length >= 3 && !soPalavrasGenericas(k);
  });
  return (boa ?? partes[0]).slice(0, 40);
}

/**
 * `essenciais`: o Money Reset (dia 5, "o que já tem dono no mês") quer a lista inteira do que sai
 * todo mês, aluguel, escola e plano de saúde incluídos e sem o teto do "pequeno gasto". O Raio-X
 * continua sem eles: lá a pergunta é o que dá para cortar.
 */
export function acharRecorrentes(lancamentos: RaioXLancamento[], limite = 10, opcoes: { essenciais?: boolean } = {}): RaioXItem[] {
  type Cobranca = { mes: number; valor: number; fracoes: [number, number][] };
  type Grupo = { nomes: Map<string, number>; cobrancas: Cobranca[]; transferencia: boolean };
  const grupos = new Map<string, Grupo>();
  // Meses que a pessoa tem no app: é por eles que o gasto mensal de um hábito é dividido. Quem
  // aparece em 3 de 5 meses custa 3/5 do que custaria todo mês, não o mês cheio.
  const mesesComDados = new Set<number>();
  for (const l of lancamentos) {
    if (!l.description || l.amount <= 0) continue;
    const mes = l.year * 12 + l.month;
    mesesComDados.add(mes);
    const baixa = semAcento(l.description);
    // Categoria personalizada não diz se é essencial: a descrição diz ("Escola Pequeno Príncipe"
    // numa categoria "Filhos" continua sendo escola, e escola não é "pequeno gasto pra cortar").
    const categoria = l.parentCategory ?? classify(l.description)?.parentCategory ?? null;
    if (!opcoes.essenciais && categoria && FORA.has(categoria) && !(categoria === "SAUDE" && ACADEMIA.test(baixa))) continue;
    if (l.subcategory === "Investimento" || NAO_E_GASTO.test(baixa)) continue;
    if (PARCELA_EXPLICITA.test(l.description) || ENCARGO.test(baixa) || CPF_MASCARADO.test(l.description)) continue;
    const chave = chaveRaioX(l.description);
    if (chave.length < 3 || soPalavrasGenericas(chave)) continue;
    const g: Grupo = grupos.get(chave) ?? { nomes: new Map(), cobrancas: [], transferencia: false };
    const nome = nomeLegivel(l.description);
    g.nomes.set(nome, (g.nomes.get(nome) ?? 0) + 1);
    const fracoes = [...l.description.matchAll(FRACAO)]
      .map((f) => [Number(f[1]), Number(f[2])] as [number, number])
      .filter(([a, b]) => a <= b && b >= 2);
    g.cobrancas.push({ mes, valor: l.amount, fracoes });
    if (TRANSFERENCIA.test(baixa)) g.transferencia = true;
    grupos.set(chave, g);
  }
  const ultimoMes = Math.max(...mesesComDados);

  const assinaturas: RaioXItem[] = [];
  const habitos: RaioXItem[] = [];
  for (const [chave, g] of grupos) {
    // Parcela: o mesmo "de N" avançando de 1 em 1, mês a mês ("3/10" em junho, "4/10" em julho).
    // Uma data como "05/08" não avança assim, então não derruba o hábito da padaria.
    const vistas = new Set(g.cobrancas.flatMap((c) => c.fracoes.map(([a, b]) => `${b}|${c.mes}|${a}`)));
    const ehParcela = g.cobrancas.some((c) => c.fracoes.some(([a, b]) => vistas.has(`${b}|${c.mes + 1}|${a + 1}`)));
    if (ehParcela) continue;
    // Compra fora da curva com a mesma marca (um iPhone na Apple, junto do iCloud) não entra na conta.
    const tipica = mediana(g.cobrancas.map((c) => c.valor));
    const cobrancas = g.cobrancas.filter((c) => c.valor <= tipica * 3).sort((a, b) => a.mes - b.mes);
    const porMes = new Map<number, { total: number; vezes: number }>();
    for (const c of cobrancas) {
      const m = porMes.get(c.mes) ?? { total: 0, vezes: 0 };
      m.total += c.valor;
      m.vezes += 1;
      porMes.set(c.mes, m);
    }
    if (porMes.size < MIN_MESES) continue;
    // Sumiu nos dois últimos meses com dado: já foi cancelado ou parou. Não é mais decisão.
    if (Math.max(...porMes.keys()) < ultimoMes - 1) continue;
    const meses = [...porMes.values()];
    const mensalTipico = mediana(meses.map((m) => m.total));
    if (!opcoes.essenciais && mensalTipico > TETO_MENSAL) continue;
    const vezesPorMes = meses.reduce((s, m) => s + m.vezes, 0) / meses.length;
    const nome = [...g.nomes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Assinatura = uma cobrança na maioria dos meses E valor estável nas últimas cobranças (um
    // reajuste do Netflix no meio da janela não vira "hábito"). Posto com R$ 120, 250, 180 é
    // hábito; transferência nunca é "assinatura pra cancelar".
    const umaPorMes = meses.filter((m) => m.vezes === 1).length > meses.length / 2;
    const valores = cobrancas.map((c) => c.valor);
    const faixa = (v: number[]) => Math.max(...v) / Math.min(...v);
    const estavel = faixa(valores.slice(-2)) <= 1.01 || faixa(valores.slice(-3)) <= VARIACAO_ASSINATURA;
    // E todo mês: aparecer em junho, agosto e outubro com o mesmo valor é hábito, não mensalidade.
    const chaves = [...porMes.keys()];
    const todoMes = porMes.size >= (Math.max(...chaves) - Math.min(...chaves) + 1) * 0.75;
    const assinatura = umaPorMes && estavel && todoMes && !g.transferencia;
    // Assinatura custa o valor dela por mês. Hábito custa a média pelos meses que a pessoa tem no app.
    const mensal = assinatura ? mensalTipico : meses.reduce((s, m) => s + m.total, 0) / Math.max(porMes.size, mesesComDados.size);
    const item: RaioXItem = { chave, nome, mensal, anual: mensal * 12, meses: porMes.size, tipo: assinatura ? "assinatura" : "habito", vezesPorMes };
    (assinatura ? assinaturas : habitos).push(item);
  }
  // Assinaturas primeiro: são o "pequeno gasto" clássico, e mercado e posto não podem empurrá-las pra fora da lista.
  const porAnual = (a: RaioXItem, b: RaioXItem) => b.anual - a.anual;
  return [...assinaturas.sort(porAnual), ...habitos.sort(porAnual)].slice(0, limite);
}

/** Quanto R$ X por mês vira em N meses, rendendo a taxa mensal. */
export function valorFuturo(mensal: number, meses: number, taxa = RAIOX_TAXA_MENSAL): number {
  if (taxa <= 0) return mensal * meses;
  return mensal * ((Math.pow(1 + taxa, meses) - 1) / taxa);
}

/** Economia por ano de cada decisão: cancelar tira tudo, cortar pela metade tira metade. */
export function economiaAnual(item: Pick<RaioXItem, "anual">, decisao: "raiox_cancelar" | "raiox_metade" | "raiox_manter"): number {
  if (decisao === "raiox_cancelar") return item.anual;
  if (decisao === "raiox_metade") return item.anual / 2;
  return 0;
}
