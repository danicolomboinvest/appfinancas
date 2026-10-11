/**
 * Acerto do mês do perfil Casal (out/2026): cada lançamento diz quem pagou (A ou B) e se o gasto é
 * da casa ou pessoal. No fim do mês, quanto cada um pagou dos gastos da casa contra a parte que
 * era dele, pela renda (proporcional, o mais recomendado quando as rendas são diferentes) ou meio
 * a meio. O resultado vira uma frase: "Pedro deve R$ 224 pra Dani".
 */

export type Pessoa = "A" | "B";
export type ModoDeDivisao = "renda" | "meio" | "combinado";
/**
 * O jeito de UMA conta (divisão conta por conta, aprovada em 11/10/2026): pela renda, meio a meio
 * ou "um paga tudo" (a conta sai do acerto e vira gasto de quem pagou).
 */
export type ModoDaConta = "renda" | "meio" | "um_paga";

export type ConfigCasal = {
  nomeA: string;
  nomeB: string;
  divisao: ModoDeDivisao;
  /** Meses já acertados, "2026-10". */
  acertos: string[];
  /** Login do par (11/10/2026): a titular deixa o par ver a renda dela. Desligado, ele vê só a
   * proporção ("pela renda: 55% e 45%"). Ausente = desligado. */
  mostrarRenda?: boolean;
  /** "Combinado" (passo a passo, 11/10/2026): a parte da pessoa A na casa, de 20 a 80 (%). */
  pctA?: number;
  /** Conta por conta: o jeito de cada conta, pela chave da conta (ver chaveDaConta). Ausente = o geral. */
  regras?: Record<string, ModoDaConta>;
};

export const CONFIG_PADRAO: ConfigCasal = { nomeA: "Pessoa 1", nomeB: "Pessoa 2", divisao: "renda", acertos: [] };

/** Lê o JSON do perfil sem confiar no formato (veio do banco, pode estar velho ou vazio). */
export function lerConfigCasal(json: unknown): ConfigCasal {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const nome = (v: unknown, padrao: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : padrao);
  return {
    nomeA: nome(o.nomeA, CONFIG_PADRAO.nomeA),
    nomeB: nome(o.nomeB, CONFIG_PADRAO.nomeB),
    divisao: o.divisao === "meio" ? "meio" : o.divisao === "combinado" ? "combinado" : "renda",
    acertos: Array.isArray(o.acertos) ? o.acertos.filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}$/.test(x)) : [],
    ...(o.mostrarRenda === true ? { mostrarRenda: true } : {}),
    ...(typeof o.pctA === "number" && o.pctA >= 20 && o.pctA <= 80 ? { pctA: Math.round(o.pctA) } : {}),
    ...(lerRegras(o.regras) ? { regras: lerRegras(o.regras)! } : {}),
  };
}

function ehModoDaConta(v: unknown): v is ModoDaConta {
  return v === "renda" || v === "meio" || v === "um_paga";
}

function lerRegras(v: unknown): Record<string, ModoDaConta> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r: Record<string, ModoDaConta> = {};
  for (const [k, m] of Object.entries(v as Record<string, unknown>)) if (typeof k === "string" && k.length <= 80 && ehModoDaConta(m)) r[k] = m;
  return Object.keys(r).length ? r : null;
}

/**
 * A chave de uma conta: o nome sem acento, minúsculo, sem espaço sobrando ("Internet Vivo" vira
 * "internet vivo"). Lançamentos com o mesmo nome são a mesma conta (os dois mercados do mês). Sem
 * nome, vale a categoria.
 */
export function chaveDaConta(descricao: string | null | undefined, categoria: string | null | undefined): string {
  const n = (descricao ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return n || `categoria:${(categoria ?? "outros").toLowerCase()}`;
}

export function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function ehPessoa(v: unknown): v is Pessoa {
  return v === "A" || v === "B";
}

export type LancamentoDoAcerto = {
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION" | string;
  amount: number;
  pessoa: string | null;
  doCasal: boolean | null;
  /** O jeito desta conta (conta por conta). Ausente = o jeito geral do casal. */
  modo?: ModoDaConta;
};

export type Acerto = {
  /** Gastos da casa com dono (os que entram na conta). */
  totalDaCasa: number;
  pagou: Record<Pessoa, number>;
  parte: Record<Pessoa, number>;
  /** Fração da A na divisão (0,6 = 60%). */
  fracaoA: number;
  /** Positivo: A pagou a mais e B deve isso a ela. Negativo: A deve a B. */
  saldoA: number;
  rendas: Record<Pessoa, number>;
  /** Pela renda mas sem renda dos dois lançada: a conta caiu pra meio a meio. */
  caiuParaMeio: boolean;
  /** Gastos da casa sem "quem pagou": ficam de fora até alguém marcar. */
  semDono: { quantidade: number; valor: number };
};

export function calcularAcerto(lancamentos: LancamentoDoAcerto[], modo: ModoDeDivisao, opcoes: { pctA?: number } = {}): Acerto {
  const pagou: Record<Pessoa, number> = { A: 0, B: 0 };
  const rendas: Record<Pessoa, number> = { A: 0, B: 0 };
  const semDono = { quantidade: 0, valor: 0 };
  for (const l of lancamentos) {
    if (l.category === "INCOME" && ehPessoa(l.pessoa)) rendas[l.pessoa] += Math.abs(Number(l.amount) || 0);
  }
  const temRendas = rendas.A > 0 && rendas.B > 0;
  const fracaoRenda = temRendas ? rendas.A / (rendas.A + rendas.B) : 0.5;
  const fracaoCombinada = typeof opcoes.pctA === "number" ? Math.min(0.8, Math.max(0.2, opcoes.pctA / 100)) : 0.5;
  // A fração da pessoa A no jeito geral (o que a tela mostra como "55 e 45").
  const fracaoA = modo === "renda" ? fracaoRenda : modo === "combinado" ? fracaoCombinada : 0.5;
  const caiuParaMeio = modo === "renda" && !temRendas;

  // Conta por conta: cada gasto da casa usa a fração do jeito dele. "Um paga tudo" sai do acerto.
  let parteA = 0;
  for (const l of lancamentos) {
    if (l.category !== "EXPENSE" || l.doCasal === false) continue;
    const valor = Math.abs(Number(l.amount) || 0);
    if (!ehPessoa(l.pessoa)) {
      semDono.quantidade += 1;
      semDono.valor += valor;
      continue;
    }
    if (l.modo === "um_paga") continue;
    pagou[l.pessoa] += valor;
    const f = l.modo === "renda" ? fracaoRenda : l.modo === "meio" ? 0.5 : fracaoA;
    parteA += valor * f;
  }
  const totalDaCasa = pagou.A + pagou.B;
  const parte = { A: parteA, B: totalDaCasa - parteA };
  const centavos = (v: number) => Math.round(v * 100) / 100;
  return {
    totalDaCasa: centavos(totalDaCasa),
    pagou: { A: centavos(pagou.A), B: centavos(pagou.B) },
    parte: { A: centavos(parte.A), B: centavos(parte.B) },
    fracaoA,
    saldoA: centavos(pagou.A - parte.A),
    rendas,
    caiuParaMeio,
    semDono: { quantidade: semDono.quantidade, valor: centavos(semDono.valor) },
  };
}
