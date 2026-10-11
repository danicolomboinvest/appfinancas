import type { ParentCategory } from "@prisma/client";
import { naturezaDaCategoria } from "@/lib/profiles/empresa";
import { ehNaoGasto } from "@/lib/planning/nao-e-gasto";
import type { Forma } from "./config";

/**
 * As contas da Empresa refeita (versão nova, 11/10/2026), sem banco: tudo aqui recebe os
 * lançamentos já lidos e devolve números. As regras são as do plano (seção 3.6) e da Ana canônica
 * (seção 10), travadas pelos testes em __tests__/regras.test.ts.
 *
 * Datas como texto "AAAA-MM-DD": a venda do dia 30 não pode virar dia 29 por causa do fuso.
 */

export type LancamentoDaEmpresa = {
  id: string;
  year: number;
  month: number;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: ParentCategory | null;
  customCategoryId?: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  /** "AAAA-MM-DD" ou nulo. */
  entryDate: string | null;
  cliente?: string | null;
  forma?: Forma | null;
  recebeEm?: string | null;
  recebidoEm?: string | null;
  externalId?: string | null;
};

export type Mes = { ano: number; mes: number };

export const SUBCATEGORIA_DO_SALARIO = "Pró-labore";
export const SUBCATEGORIA_DA_MAQUININHA = "Taxas de cartão/maquininha";
const RENDIMENTO_DO_CAIXA = "Rendimento do caixa";

/** Tudo que entra e é venda (o rendimento da aplicação do caixa não é faturamento). */
export function ehVenda(l: Pick<LancamentoDaEmpresa, "category" | "subcategory">): boolean {
  return l.category === "INCOME" && l.subcategory !== RENDIMENTO_DO_CAIXA;
}

const MAQUININHAS = /\b(maquininha|stone|cielo|getnet|pagseguro|pag seguro|sumup|infinitepay|infinite pay|rede|mercado ?pago|ton)\b/;

/** A taxa da maquininha: a subcategoria própria ou uma tarifa com o nome de uma maquininha. */
export function ehMaquininha(l: Pick<LancamentoDaEmpresa, "category" | "subcategory" | "description">): boolean {
  if (l.category !== "EXPENSE") return false;
  if (l.subcategory === SUBCATEGORIA_DA_MAQUININHA) return true;
  const d = (l.description ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /\b(taxa|tarifa|mdr)\b/.test(d) && MAQUININHAS.test(d);
}

export type TipoDaSaida = "salario" | "imposto" | "variavel" | "fixa" | "fora";

/**
 * Onde cada saída entra no recibo. O pró-labore é o salário dela (fica de fora do "Sobrou", que é
 * o lucro antes do salário); aplicação e pagamento de fatura não são gasto.
 */
export function tipoDaSaida(l: LancamentoDaEmpresa): TipoDaSaida {
  if (l.category !== "EXPENSE") return "fora";
  if (l.subcategory === SUBCATEGORIA_DO_SALARIO) return "salario";
  if (ehNaoGasto(l)) return "fora";
  if (l.customCategoryId) return "fixa";
  return naturezaDaCategoria(l.parentCategory);
}

export type Recibo = {
  entrou: number;
  nVendas: number;
  /** Insumos e entregas: o que sobe com a venda (inclui a maquininha). */
  variaveis: number;
  /** Contas do mês: o que não muda com a venda, sem o salário dela. */
  fixas: number;
  /** A guia do MEI (ou os impostos, fora do MEI). */
  impostos: number;
  /** Lucro antes do salário dela. */
  sobrou: number;
  /** O pró-labore lançado no mês. */
  salarioLancado: number;
  maquininha: number;
  /** Quanto entrou por jeito de pagar (só as vendas que dizem o jeito). */
  porForma: Partial<Record<Forma, number>>;
};

export function reciboDoMes(lancamentos: LancamentoDaEmpresa[], m: Mes): Recibo {
  const r: Recibo = { entrou: 0, nVendas: 0, variaveis: 0, fixas: 0, impostos: 0, sobrou: 0, salarioLancado: 0, maquininha: 0, porForma: {} };
  for (const l of lancamentos) {
    if (l.year !== m.ano || l.month !== m.mes) continue;
    if (ehVenda(l)) {
      r.entrou += l.amount;
      r.nVendas += 1;
      if (l.forma) r.porForma[l.forma] = (r.porForma[l.forma] ?? 0) + l.amount;
      continue;
    }
    const t = tipoDaSaida(l);
    if (t === "salario") r.salarioLancado += l.amount;
    else if (t === "imposto") r.impostos += l.amount;
    else if (t === "variavel") r.variaveis += l.amount;
    else if (t === "fixa") r.fixas += l.amount;
    if (ehMaquininha(l)) r.maquininha += l.amount;
  }
  const c = (v: number) => Math.round(v * 100) / 100;
  r.entrou = c(r.entrou);
  r.variaveis = c(r.variaveis);
  r.fixas = c(r.fixas);
  r.impostos = c(r.impostos);
  r.salarioLancado = c(r.salarioLancado);
  r.maquininha = c(r.maquininha);
  r.sobrou = c(r.entrou - r.variaveis - r.fixas - r.impostos);
  return r;
}

/** O mês `k` meses antes (k > 0) ou depois (k < 0). */
export function mesAntes(m: Mes, k: number): Mes {
  const i = m.ano * 12 + (m.mes - 1) - k;
  return { ano: Math.floor(i / 12), mes: (i % 12) + 1 };
}

export const chaveDoMes = (m: Mes) => `${m.ano}-${String(m.mes).padStart(2, "0")}`;

export function lerChaveDoMes(texto: string | null | undefined): Mes | null {
  const x = /^(\d{4})-(\d{2})$/.exec(texto ?? "");
  if (!x) return null;
  const mes = Number(x[2]);
  return mes >= 1 && mes <= 12 ? { ano: Number(x[1]), mes } : null;
}

/** Os meses que já fecharam e têm algum lançamento, dos `n` antes deste (mais antigo primeiro). */
export function mesesFechadosComDado(lancamentos: LancamentoDaEmpresa[], hoje: Mes, n: number): Mes[] {
  const com = new Set(lancamentos.map((l) => chaveDoMes({ ano: l.year, mes: l.month })));
  return Array.from({ length: n }, (_, i) => mesAntes(hoje, n - i)).filter((m) => com.has(chaveDoMes(m)));
}

/**
 * Salário seguro (plano 3.6, regra nova): o menor lucro dos 3 últimos meses fechados, menos 10% para
 * o caixa, arredondado para baixo até a centena (pendência 5.1.11: a recomendação do plano).
 * Ana: min(5.240; 5.310; 5.036) × 0,9 = 4.532,40, que vira R$ 4.500.
 * Sem mês fechado, não existe (nulo). Lucro zero ou negativo: salário seguro zero.
 */
export function salarioSeguro(lucros: number[]): number | null {
  if (lucros.length === 0) return null;
  const menor = Math.min(...lucros);
  if (menor <= 0) return 0;
  return Math.floor((menor * 0.9) / 100 + 1e-9) * 100;
}

/**
 * Ponto de equilíbrio (plano 3.6): o que precisa vender no mês para pagar as contas e o salário,
 * pela margem do mês de referência, arredondado PARA CIMA. É a conta do calcularDRE do app: o imposto
 * sai da venda antes da margem.
 * Ana: (400 + 4.500) ÷ 60,4% = 8.112,58, que vira R$ 8.113.
 * Nulo quando a margem não é positiva (cada venda perde dinheiro) ou não houve venda.
 */
export function pontoDeEquilibrio(r: Pick<Recibo, "entrou" | "variaveis" | "impostos" | "fixas">, salario: number): number | null {
  if (r.entrou <= 0) return null;
  const margem = (r.entrou - r.impostos - r.variaveis) / r.entrou;
  if (margem <= 0) return null;
  return Math.ceil((r.fixas + Math.max(0, salario)) / margem - 1e-9);
}

/** Quanto falta vender no mês para o equilíbrio: para cima e nunca negativo. Ana: 8.113 − 2.900 = R$ 5.213. */
export function faltaVender(pe: number, vendido: number): number {
  return Math.max(0, Math.ceil(pe - vendido - 1e-9));
}

/** Porcentagens inteiras que somam 100 (método do maior resto). Ana, quem compra: 21, 15, 4 e 60. */
export function porcentagensQueSomam100(valores: number[]): number[] {
  const total = valores.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return valores.map(() => 0);
  const exatas = valores.map((v) => (Math.max(0, v) / total) * 100);
  const base = exatas.map(Math.floor);
  let falta = 100 - base.reduce((s, v) => s + v, 0);
  exatas
    .map((x, i) => [x - Math.floor(x), i] as const)
    // Restos iguais (na conta, a menos de um fio): ganha o pedaço maior.
    .sort((a, b) => (Math.abs(b[0] - a[0]) > 1e-9 ? b[0] - a[0] : valores[b[1]] - valores[a[1]]))
    .forEach(([, i]) => {
      if (falta > 0) {
        base[i]++;
        falta--;
      }
    });
  return base;
}

export type LimiteDoMei = {
  faturado: number;
  teto: number;
  tolerancia: number;
  /** 0 a 1 (ou mais) do teto. */
  pct: number;
  cabe: number;
  /** Alerta a partir de 80% (plano 3.6). */
  alerta: boolean;
  faixa: "mei" | "guia-extra" | "fora";
  /** O mês (1–12) em que passa do teto no ritmo dos últimos meses, se for ainda este ano. */
  passaEm: number | null;
};

/**
 * O medidor do MEI: faturado no ano ÷ teto. Ana: 66.420 ÷ 81.000 = 82%; cabem R$ 14.580; no ritmo de
 * R$ 9.000 por mês, passa em novembro. O ritmo é a média dos meses fechados recentes.
 */
export function limiteDoMei(p: { faturado: number; teto: number; tolerancia: number; ritmo: number | null; hoje: { mes: number; dia: number; diasNoMes: number } }): LimiteDoMei {
  const pct = p.teto > 0 ? p.faturado / p.teto : 0;
  const cabe = Math.max(0, p.teto - p.faturado);
  const faixa = p.faturado <= p.teto ? "mei" : p.faturado <= p.tolerancia ? "guia-extra" : "fora";
  let passaEm: number | null = null;
  if (faixa === "mei" && p.ritmo && p.ritmo > 0) {
    const meses = cabe / p.ritmo;
    const restoDoMes = (p.hoje.diasNoMes - p.hoje.dia) / p.hoje.diasNoMes;
    const m = meses <= restoDoMes ? p.hoje.mes : p.hoje.mes + Math.ceil(meses - restoDoMes);
    passaEm = m <= 12 ? m : null;
  } else if (faixa !== "mei") {
    passaEm = p.hoje.mes;
  }
  return { faturado: p.faturado, teto: p.teto, tolerancia: p.tolerancia, pct, cabe, alerta: pct >= 0.8, faixa, passaEm };
}

/** Dias corridos entre duas datas "AAAA-MM-DD". */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

export function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

const CARTAO: ReadonlySet<string> = new Set(["credito", "debito"]);

/**
 * A venda já virou dinheiro na conta? Cartão cai sozinho na data; boleto, Pix combinado e fiado só
 * quando ela toca em "Recebi". Venda sem data de cair é dinheiro na hora.
 */
export function foiRecebida(v: Pick<LancamentoDaEmpresa, "forma" | "recebeEm" | "recebidoEm">, hoje: string): boolean {
  if (v.recebidoEm) return true;
  if (!v.recebeEm) return true;
  if (v.forma && CARTAO.has(v.forma)) return v.recebeEm <= hoje;
  return false;
}

export type Devendo = { id: string; cliente: string; valor: number; dias: number; descricao: string | null };
export type Semana = { inicio: string; fim: string; total: number; quem: { nome: string; forma: Forma | null }[] };

/**
 * O que vai entrar nas próximas 4 semanas (a partir de hoje) e quem está devendo (a data de cair já
 * passou e ela não marcou "Recebi").
 */
export function recebimentos(vendas: LancamentoDaEmpresa[], hoje: string): { semanas: Semana[]; devendo: Devendo[] } {
  const semanas: Semana[] = Array.from({ length: 4 }, (_, i) => ({ inicio: somarDias(hoje, i * 7), fim: somarDias(hoje, i * 7 + 6), total: 0, quem: [] }));
  const devendo: Devendo[] = [];
  for (const v of vendas) {
    if (!ehVenda(v) || !v.recebeEm || foiRecebida(v, hoje)) continue;
    const nome = v.cliente?.trim() || v.description?.trim() || "Venda";
    if (v.recebeEm < hoje) {
      devendo.push({ id: v.id, cliente: nome, valor: v.amount, dias: diasEntre(v.recebeEm, hoje), descricao: v.description });
      continue;
    }
    const s = semanas.find((w) => v.recebeEm! >= w.inicio && v.recebeEm! <= w.fim);
    if (!s) continue;
    s.total += v.amount;
    if (!s.quem.some((q) => q.nome === nome)) s.quem.push({ nome, forma: v.forma ?? null });
  }
  devendo.sort((a, b) => b.dias - a.dias);
  return { semanas, devendo };
}

/** Em média, quantos dias entre vender e o dinheiro cair (só as vendas que dizem as duas datas). */
export function prazoMedio(vendas: LancamentoDaEmpresa[]): number | null {
  const com = vendas.filter((v) => ehVenda(v) && v.entryDate && v.recebeEm);
  if (com.length === 0) return null;
  return Math.round(com.reduce((s, v) => s + Math.max(0, diasEntre(v.entryDate!, v.recebeEm!)), 0) / com.length);
}

/** Quantos dias o caixa paga de contas, guia e salário, se parar de vender hoje. */
export function caixaEmDias(caixa: number, custoDoMes: number): number | null {
  if (caixa <= 0 || custoDoMes <= 0) return null;
  return Math.round(caixa / (custoDoMes / 30));
}

export type Cliente = { nome: string; valor: number; pct: number };

/**
 * Quem compra (3 meses): os 3 maiores clientes com nome e o resto ("Balcão e outros", inclusive as
 * vendas sem nome), em porcentagens que somam 100. Ana: 21%, 15%, 4% e 60%.
 */
export function quemCompra(vendas: LancamentoDaEmpresa[]): { clientes: Cliente[]; outros: { valor: number; pct: number }; total: number; dependente: Cliente | null } | null {
  const porNome = new Map<string, { nome: string; valor: number }>();
  let total = 0;
  for (const v of vendas) {
    if (!ehVenda(v)) continue;
    total += v.amount;
    const nome = v.cliente?.trim();
    if (!nome) continue;
    const k = nome.toLocaleLowerCase("pt-BR");
    const c = porNome.get(k) ?? { nome, valor: 0 };
    c.valor += v.amount;
    porNome.set(k, c);
  }
  if (porNome.size === 0 || total <= 0) return null;
  const top = [...porNome.values()].sort((a, b) => b.valor - a.valor).slice(0, 3);
  const outros = total - top.reduce((s, c) => s + c.valor, 0);
  const pcts = porcentagensQueSomam100([...top.map((c) => c.valor), outros]);
  const clientes = top.map((c, i) => ({ ...c, pct: pcts[i] }));
  return { clientes, outros: { valor: outros, pct: pcts[top.length] }, total, dependente: clientes.find((c) => c.valor / total > 0.3) ?? null };
}

export type QuantoCobrar = { hora: number; tempo: number; contas: number; custo: number; taxaELucro: number; preco: number };

/**
 * O preço mínimo (etiqueta do Quanto cobrar): materiais + embalagem + o tempo dela (salário ÷ horas
 * do mês) + a parte das contas, dividido pelo que sobra depois da taxa da maquininha e do lucro.
 * Ana, bolo de 2 kg: 62 + 8 + 3 h × 37,50 + 8,10 = 190,60 ÷ (1 − 3,1% − 15%) = 232,72, que vira R$ 233.
 */
export function quantoCobrar(p: { materiais: number; embalagem: number; horas: number; salario: number; horasPorMes: number; contasPorUnidade: number; taxaPct: number; margemPct: number }): QuantoCobrar | null {
  const sobra = 1 - p.taxaPct / 100 - p.margemPct / 100;
  if (sobra <= 0 || p.horasPorMes <= 0) return null;
  const hora = p.salario / p.horasPorMes;
  const tempo = p.horas * hora;
  const custo = p.materiais + p.embalagem + tempo + p.contasPorUnidade;
  const exato = custo / sobra;
  return { hora, tempo, contas: p.contasPorUnidade, custo, taxaELucro: exato - custo, preco: Math.ceil(exato - 1e-9) };
}

export type PedacoDos100 = { chave: "ins" | "con" | "maq" | "imp" | "sal" | "fic"; nome: string; valor: number; cem: number };

/**
 * Para onde vai cada R$ 100 vendido no mês, em pedaços que somam 100. Ana (setembro): insumos e
 * entregas 37, contas 4, maquininha 2, imposto 1, seu salário 50, fica na empresa 6.
 * Nulo sem venda ou quando o mês deu prejuízo (os pedaços passariam de 100).
 */
export function cadaCemReais(r: Recibo, salario: number): PedacoDos100[] | null {
  if (r.entrou <= 0 || r.sobrou < 0) return null;
  const sal = Math.min(Math.max(0, salario), r.sobrou);
  const pedacos: Omit<PedacoDos100, "cem">[] = [
    { chave: "ins", nome: "Insumos e entregas", valor: r.variaveis - r.maquininha },
    { chave: "con", nome: "Contas", valor: r.fixas },
    { chave: "maq", nome: "Maquininha", valor: r.maquininha },
    { chave: "imp", nome: "Imposto", valor: r.impostos },
    { chave: "sal", nome: "Seu salário", valor: sal },
    { chave: "fic", nome: "Fica na empresa", valor: Math.max(0, r.sobrou - sal) },
  ];
  const cem = porcentagensQueSomam100(pedacos.map((p) => p.valor));
  return pedacos.map((p, i) => ({ ...p, cem: cem[i] })).filter((p) => p.valor > 0);
}

/** Os nomes de dona para as subcategorias de empresa ("Matéria-prima" vira "Insumos"). */
const NOME_DE_DONA: Record<string, string> = {
  "Matéria-prima": "Insumos",
  "Mercadorias pra revenda": "Mercadorias",
  Frete: "Entregas",
  "Motoboy/Aplicativo": "Entregas",
  Correios: "Entregas",
  "Taxas de cartão/maquininha": "Maquininha",
  "DAS (Simples Nacional)": "Guia do MEI",
};

/** O nome com que uma saída aparece no "Para onde foi": a subcategoria (em palavras de dona), ou a descrição. */
export function nomeDaSaida(l: LancamentoDaEmpresa): string {
  const sub = l.subcategory?.trim();
  if (sub) return NOME_DE_DONA[sub] ?? sub;
  return l.description?.trim() || "Outros";
}

/** As despesas que mais cresceram de um mês para o outro (até 3). */
export function despesasQueCresceram(lancamentos: LancamentoDaEmpresa[], atual: Mes, anterior: Mes): { nome: string; valor: number; mais: number }[] {
  const soma = (m: Mes) => {
    const s = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.year !== m.ano || l.month !== m.mes) continue;
      const t = tipoDaSaida(l);
      if (t === "fora" || t === "salario") continue;
      s.set(nomeDaSaida(l), (s.get(nomeDaSaida(l)) ?? 0) + l.amount);
    }
    return s;
  };
  const a = soma(atual);
  const b = soma(anterior);
  return [...a]
    .filter(([nome]) => b.has(nome))
    .map(([nome, valor]) => ({ nome, valor, mais: Math.round(valor - (b.get(nome) ?? 0)) }))
    .filter((x) => x.mais > 0)
    .sort((x, y) => y.mais - x.mais)
    .slice(0, 3);
}

/** A data de vencimento da guia no mês (o dia vem da tabela de parâmetros legais). */
export function vencimentoDaGuia(m: Mes, dia: number): string {
  const ultimo = new Date(Date.UTC(m.ano, m.mes, 0)).getUTCDate();
  return `${m.ano}-${String(m.mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** A guia do MEI já foi paga no mês? (lançamento de imposto com DAS, Simples ou PGMEI). */
export function ehGuiaDoMei(l: Pick<LancamentoDaEmpresa, "category" | "parentCategory" | "subcategory" | "description">): boolean {
  if (l.category !== "EXPENSE") return false;
  const t = `${l.subcategory ?? ""} ${l.description ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /\b(das|simples nacional|pgmei|guia do mei|das mei)\b/.test(t);
}
