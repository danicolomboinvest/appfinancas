/**
 * Acerto do mês do perfil Casal (out/2026): cada lançamento diz quem pagou (A ou B) e se o gasto é
 * da casa ou pessoal. No fim do mês, quanto cada um pagou dos gastos da casa contra a parte que
 * era dele, pela renda (proporcional, o mais recomendado quando as rendas são diferentes) ou meio
 * a meio. O resultado vira uma frase: "Pedro deve R$ 224 pra Dani".
 */

export type Pessoa = "A" | "B";
export type ModoDeDivisao = "renda" | "meio";

export type ConfigCasal = {
  nomeA: string;
  nomeB: string;
  divisao: ModoDeDivisao;
  /** Meses já acertados, "2026-10". */
  acertos: string[];
};

export const CONFIG_PADRAO: ConfigCasal = { nomeA: "Pessoa 1", nomeB: "Pessoa 2", divisao: "renda", acertos: [] };

/** Lê o JSON do perfil sem confiar no formato (veio do banco, pode estar velho ou vazio). */
export function lerConfigCasal(json: unknown): ConfigCasal {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const nome = (v: unknown, padrao: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : padrao);
  return {
    nomeA: nome(o.nomeA, CONFIG_PADRAO.nomeA),
    nomeB: nome(o.nomeB, CONFIG_PADRAO.nomeB),
    divisao: o.divisao === "meio" ? "meio" : "renda",
    acertos: Array.isArray(o.acertos) ? o.acertos.filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}$/.test(x)) : [],
  };
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

export function calcularAcerto(lancamentos: LancamentoDoAcerto[], modo: ModoDeDivisao): Acerto {
  const pagou: Record<Pessoa, number> = { A: 0, B: 0 };
  const rendas: Record<Pessoa, number> = { A: 0, B: 0 };
  const semDono = { quantidade: 0, valor: 0 };
  for (const l of lancamentos) {
    const valor = Math.abs(Number(l.amount) || 0);
    if (l.category === "INCOME") {
      if (ehPessoa(l.pessoa)) rendas[l.pessoa] += valor;
      continue;
    }
    if (l.category !== "EXPENSE" || l.doCasal === false) continue;
    if (ehPessoa(l.pessoa)) pagou[l.pessoa] += valor;
    else {
      semDono.quantidade += 1;
      semDono.valor += valor;
    }
  }
  const totalDaCasa = pagou.A + pagou.B;
  const temRendas = rendas.A > 0 && rendas.B > 0;
  const caiuParaMeio = modo === "renda" && !temRendas;
  const fracaoA = modo === "renda" && temRendas ? rendas.A / (rendas.A + rendas.B) : 0.5;
  const parte = { A: totalDaCasa * fracaoA, B: totalDaCasa * (1 - fracaoA) };
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
