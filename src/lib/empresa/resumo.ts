import type { ParametrosDoMei } from "./legal";
import type { ConfigEmpresa } from "./config";
import {
  caixaEmDias,
  ehGuiaDoMei,
  ehVenda,
  faltaVender,
  limiteDoMei,
  mesAntes,
  mesesFechadosComDado,
  pontoDeEquilibrio,
  reciboDoMes,
  recebimentos,
  salarioSeguro,
  vencimentoDaGuia,
  chaveDoMes,
  type LancamentoDaEmpresa,
  type LimiteDoMei,
  type Mes,
  type Recibo,
} from "./regras";

/**
 * Os números do dia a dia da Empresa a partir dos lançamentos (sem banco). Cada número só existe
 * quando o dado existe: sem mês fechado não há salário seguro, sem venda não há ponto de equilíbrio,
 * sem a linha na tabela legal não há teto nem guia.
 */
export type EntradaDoResumo = {
  config: ConfigEmpresa | null;
  hoje: string;
  mesAtual: Mes;
  dia: number;
  diasNoMes: number;
  lancamentos: LancamentoDaEmpresa[];
  legal: ParametrosDoMei;
  caixa: number;
};

export type Guia = { valor: number; vence: string; paga: boolean; diasAte: number };

export type ResumoDaEmpresa = {
  ehMei: boolean;
  /** Os meses fechados (até 3) que contam para o salário seguro e o ritmo. */
  fechados: Mes[];
  lucros: number[];
  seguro: number | null;
  /** O salário que vale: o combinado no assistente, senão o seguro. */
  salario: number;
  ultimoFechado: Mes;
  reciboFechado: Recibo;
  reciboAtual: Recibo;
  pe: number | null;
  falta: number | null;
  guia: Guia | null;
  limite: LimiteDoMei | null;
  caixaDias: number | null;
  devendo: ReturnType<typeof recebimentos>["devendo"];
  semanas: ReturnType<typeof recebimentos>["semanas"];
};

export function resumoDaEmpresa(e: EntradaDoResumo): ResumoDaEmpresa {
  const ehMei = e.config?.tipo === "MEI";
  const fechados = mesesFechadosComDado(e.lancamentos, e.mesAtual, 3);
  const lucros = fechados.map((m) => reciboDoMes(e.lancamentos, m).sobrou);
  const seguro = salarioSeguro(lucros);
  const salario = e.config?.salario ?? seguro ?? 0;
  const ultimoFechado = mesAntes(e.mesAtual, 1);
  const reciboFechado = reciboDoMes(e.lancamentos, ultimoFechado);
  const reciboAtual = reciboDoMes(e.lancamentos, e.mesAtual);
  const pe = pontoDeEquilibrio(reciboFechado, salario);

  // A guia: o valor da última que ela pagou (o extrato manda); sem nenhuma, o da tabela legal.
  let guia: Guia | null = null;
  if (ehMei && e.legal.diaDoDas) {
    const ultima = e.lancamentos.find((l) => ehGuiaDoMei(l));
    const valor = ultima ? ultima.amount : e.legal.das?.valor ?? null;
    if (valor !== null) {
      const vence = vencimentoDaGuia(e.mesAtual, e.legal.diaDoDas.valor);
      const paga = e.lancamentos.some((l) => l.year === e.mesAtual.ano && l.month === e.mesAtual.mes && ehGuiaDoMei(l));
      guia = { valor, vence, paga, diasAte: Math.round((Date.parse(vence) - Date.parse(e.hoje)) / 86_400_000) };
    }
  }

  let limite: LimiteDoMei | null = null;
  if (ehMei && e.legal.teto && e.legal.tolerancia) {
    const faturado = e.lancamentos.filter((l) => l.year === e.mesAtual.ano && ehVenda(l)).reduce((s, l) => s + l.amount, 0);
    const ritmo = fechados.length ? fechados.reduce((s, m) => s + reciboDoMes(e.lancamentos, m).entrou, 0) / fechados.length : null;
    limite = limiteDoMei({ faturado, teto: e.legal.teto.valor, tolerancia: e.legal.tolerancia.valor, ritmo, hoje: { mes: e.mesAtual.mes, dia: e.dia, diasNoMes: e.diasNoMes } });
  }

  const custoDoMes = reciboFechado.fixas + (guia?.valor ?? reciboFechado.impostos) + salario;
  const { devendo, semanas } = recebimentos(e.lancamentos, e.hoje);
  return {
    ehMei,
    fechados,
    lucros,
    seguro,
    salario,
    ultimoFechado,
    reciboFechado,
    reciboAtual,
    pe,
    falta: pe === null ? null : faltaVender(pe, reciboAtual.entrou),
    guia,
    limite,
    caixaDias: caixaEmDias(e.caixa, custoDoMes),
    devendo,
    semanas,
  };
}

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const nomeDoMes = (m: Mes) => MESES[m.mes - 1];
export const tituloDoMes = (m: Mes) => `${MESES[m.mes - 1][0].toUpperCase()}${MESES[m.mes - 1].slice(1)} ${m.ano}`;
/** "terça, dia 20". */
export function diaDaSemanaDe(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  return `${DIAS_DA_SEMANA[d.getUTCDay()]}, dia ${d.getUTCDate()}`;
}
/** "13 out". */
export function diaCurto(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  return `${d.getUTCDate()} ${MESES_CURTOS[d.getUTCMonth()]}`;
}

type ContaDoMes = { vencimento: string; pagaEm: string | null };

/** As contas do mês de hoje: as das Recorrentes do perfil (a guia do MEI entra lá quando ela abre o negócio). */
export function contasDoMes<C extends ContaDoMes>(dados: { mesAtual: Mes; contas: C[] }) {
  const chave = chaveDoMes(dados.mesAtual);
  return dados.contas
    .map((c) => {
      const paga = !!c.pagaEm && c.pagaEm.slice(0, 7) === chave;
      const dia = paga ? null : c.vencimento.slice(0, 7) <= chave ? c.vencimento : null;
      return { ...c, paga, dia };
    })
    .filter((c) => c.paga || c.dia !== null)
    .sort((a, b) => Number(a.paga) - Number(b.paga) || (a.dia ?? "").localeCompare(b.dia ?? ""));
}

