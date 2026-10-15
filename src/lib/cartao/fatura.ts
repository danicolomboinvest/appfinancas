/**
 * Em que fatura do cartão cada compra entra (15/10/2026, decisão da Dani: versão A do mockup para
 * cadastrar, a linha da fatura da versão B no Digitar; ver
 * ~/Claude/estudo-apps-financas/telas-feedback-cliente.html, "3. Cartão", faturaDe e cicloAberto).
 *
 * Regra do fechamento (a do Nubank): a compra feita no próprio dia do fechamento, ou depois, vai
 * para a fatura seguinte. Por isso o melhor dia para comprar é o do fechamento.
 * Vencimento menor que o fechamento (fecha 28, vence 5) cai no mês seguinte ao do fechamento;
 * maior (fecha 3, vence 10) cai no mesmo mês. Dia que o mês não tem (31 em setembro, 30 em
 * fevereiro) vira o último dia do mês, para o fechamento e para o vencimento.
 *
 * A fatura tem o nome do mês em que VENCE ("fatura de novembro" vence em novembro), como nos
 * apps dos bancos e no mockup.
 *
 * Só a regra, sem banco: as contas que a tela, o Digitar e os testes fazem.
 */

export type Dia = { ano: number; mes: number; dia: number };
export type DiasDoCartao = { diaFechamento: number; diaVencimento: number };

export type Fatura = {
  /** "AAAA-MM" do vencimento: a chave da fatura. */
  chave: string;
  /** O mês da fatura (o do vencimento). */
  ano: number;
  mes: number;
  fechamento: Dia;
  vencimento: Dia;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** O mês `n` meses depois (n pode ser negativo). */
export function somarMesesAoMes(ano: number, mes: number, n: number): { ano: number; mes: number } {
  const total = ano * 12 + (mes - 1) + n;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** O dia `dia` no mês, ou o último dia dele quando o mês é mais curto. */
export function diaNoMes(ano: number, mes: number, dia: number): Dia {
  return { ano, mes, dia: Math.min(dia, diasNoMes(ano, mes)) };
}

export const isoDoDia = (d: Dia) => `${d.ano}-${pad(d.mes)}-${pad(d.dia)}`;
export const chaveDoMes = (ano: number, mes: number) => `${ano}-${pad(mes)}`;

export function diaDoIso(iso: string): Dia | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  if (d.mes < 1 || d.mes > 12 || d.dia < 1 || d.dia > diasNoMes(d.ano, d.mes)) return null;
  return d;
}

/** Os dias do cartão valem? (1 a 31 cada um.) */
export function diasValidos(c: { diaFechamento: number | null; diaVencimento: number | null }): c is DiasDoCartao {
  const ok = (n: number | null) => n !== null && Number.isInteger(n) && n >= 1 && n <= 31;
  return ok(c.diaFechamento) && ok(c.diaVencimento);
}

/** A fatura que fecha no mês (ano, mes): o fechamento e o vencimento dela. */
export function faturaQueFechaEm(ano: number, mes: number, c: DiasDoCartao): Fatura {
  const fechamento = diaNoMes(ano, mes, c.diaFechamento);
  const v = c.diaVencimento > c.diaFechamento ? { ano, mes } : somarMesesAoMes(ano, mes, 1);
  const vencimento = diaNoMes(v.ano, v.mes, c.diaVencimento);
  return { chave: chaveDoMes(v.ano, v.mes), ano: v.ano, mes: v.mes, fechamento, vencimento };
}

/** A fatura que vence no mês (ano, mes). */
export function faturaQueVenceEm(ano: number, mes: number, c: DiasDoCartao): Fatura {
  const f = c.diaVencimento > c.diaFechamento ? { ano, mes } : somarMesesAoMes(ano, mes, -1);
  return faturaQueFechaEm(f.ano, f.mes, c);
}

/**
 * A fatura em que entra uma compra feita no dia `compra`. Antes do fechamento do mês: a que fecha
 * neste mês. No dia do fechamento ou depois: a que fecha no mês seguinte.
 */
export function faturaDe(compra: Dia, c: DiasDoCartao): Fatura {
  const fechaNoMes = diaNoMes(compra.ano, compra.mes, c.diaFechamento).dia;
  const f = compra.dia >= fechaNoMes ? somarMesesAoMes(compra.ano, compra.mes, 1) : { ano: compra.ano, mes: compra.mes };
  return faturaQueFechaEm(f.ano, f.mes, c);
}

/** O dia anterior. */
export function diaAnterior(d: Dia): Dia {
  if (d.dia > 1) return { ...d, dia: d.dia - 1 };
  const m = somarMesesAoMes(d.ano, d.mes, -1);
  return { ano: m.ano, mes: m.mes, dia: diasNoMes(m.ano, m.mes) };
}

/**
 * A fatura aberta hoje: a que recebe a compra de hoje. Começa no fechamento anterior e vai até a
 * véspera do próximo (o mockup mostra "3/out a 2/nov").
 */
export function cicloAberto(hoje: Dia, c: DiasDoCartao): { fatura: Fatura; inicio: Dia; fim: Dia } {
  const fatura = faturaDe(hoje, c);
  const anterior = somarMesesAoMes(fatura.fechamento.ano, fatura.fechamento.mes, -1);
  return { fatura, inicio: diaNoMes(anterior.ano, anterior.mes, c.diaFechamento), fim: diaAnterior(fatura.fechamento) };
}

/** A fatura depois desta. */
export function faturaSeguinte(f: Fatura, c: DiasDoCartao): Fatura {
  const m = somarMesesAoMes(f.fechamento.ano, f.fechamento.mes, 1);
  return faturaQueFechaEm(m.ano, m.mes, c);
}

/** O melhor dia para comprar: o do fechamento (a compra vai para a fatura seguinte, a mais longe). */
export const melhorDiaParaComprar = (c: Pick<DiasDoCartao, "diaFechamento">) => c.diaFechamento;

export type TesteDeCompra = { chave: "hoje" | "vespera" | "fechamento"; dia: Dia };

/**
 * "Testar uma compra": hoje, a véspera do fechamento da fatura aberta e o próprio fechamento (a
 * compra que já pula de fatura). Sem repetir o dia de hoje.
 */
export function testesDeCompra(hoje: Dia, c: DiasDoCartao): TesteDeCompra[] {
  const { fatura } = cicloAberto(hoje, c);
  const fecha = fatura.fechamento;
  const vespera = diaAnterior(fecha);
  const igual = (a: Dia, b: Dia) => a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
  const t: TesteDeCompra[] = [{ chave: "hoje", dia: hoje }];
  if (!igual(vespera, hoje)) t.push({ chave: "vespera", dia: vespera });
  if (!igual(fecha, hoje)) t.push({ chave: "fechamento", dia: fecha });
  return t;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "novembro"; "janeiro de 2027" quando o ano é outro que o de referência. */
export function nomeDaFatura(f: Pick<Fatura, "ano" | "mes">, anoDeReferencia?: number): string {
  const nome = MESES[f.mes - 1];
  return anoDeReferencia !== undefined && f.ano !== anoDeReferencia ? `${nome} de ${f.ano}` : nome;
}

/** "10/nov". */
export const diaCurto = (d: Dia) => `${d.dia}/${MESES_CURTOS[d.mes - 1]}`;

/** O dia de um lançamento (`entryDate` é @db.Date, meia-noite UTC; ou "AAAA-MM-DD"). */
export function diaDoLancamento(entryDate: Date | string | null | undefined): Dia | null {
  if (!entryDate) return null;
  return diaDoIso(typeof entryDate === "string" ? entryDate : entryDate.toISOString());
}

/**
 * A fatura de um lançamento ligado ao cartão. Com o dia e os dias do cartão: pela regra. Sem o dia
 * (a fatura importada que conta tudo no mês do vencimento, sem dia, desde 15/10/2026): o mês do
 * lançamento já é o da fatura. Sem os dias do cartão, também o mês do lançamento.
 */
export function faturaDoLancamento(
  e: { year: number; month: number; entryDate: Date | string | null },
  c: { diaFechamento: number | null; diaVencimento: number | null },
): { chave: string; ano: number; mes: number } {
  const dia = diaDoLancamento(e.entryDate);
  if (dia && diasValidos(c)) {
    const f = faturaDe(dia, c);
    return { chave: f.chave, ano: f.ano, mes: f.mes };
  }
  return { chave: chaveDoMes(e.year, e.month), ano: e.year, mes: e.month };
}
