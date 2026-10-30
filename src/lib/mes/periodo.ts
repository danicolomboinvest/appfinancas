/**
 * O mês da pessoa (21/10/2026): quem recebe no meio do mês e paga as contas do mês seguinte com
 * esse dinheiro fecha o mês do dia 15 ao dia 14. O mês leva o nome do mês em que ele COMEÇA
 * (15/10 a 14/11 é outubro). Sem dia escolhido (nulo ou 1) o mês é o de sempre, do dia 1 ao fim.
 *
 * Vale só para o que é lançado depois da escolha: year/month de cada lançamento são gravados na
 * hora, então o que já está no app continua onde estava. O cartão tem a regra própria dele
 * (lib/cartao/fatura.ts) e não passa por aqui.
 */

/** Até o 28: todo mês tem esse dia, então o intervalo nunca "pula" fevereiro. */
export const DIA_MAXIMO_DO_MES = 28;

/** O dia que vale: inteiro de 2 a 28. 1, nulo e o resto = mês de sempre (null). */
export function diaDeInicioDoMes(valor: unknown): number | null {
  const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 2 || n > DIA_MAXIMO_DO_MES) return null;
  return n;
}

/** Mês a que a data pertence. `data` é "AAAA-MM-DD" ou uma Date local (meio-dia do formulário). */
export function mesDoPeriodo(
  data: Date | string | null | undefined,
  diaInicio: number | null | undefined,
): { year: number; month: number } | null {
  if (!data) return null;
  let ano: number, mes: number, dia: number;
  if (typeof data === "string") {
    const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    if (Number.isNaN(data.getTime())) return null;
    [ano, mes, dia] = [data.getFullYear(), data.getMonth() + 1, data.getDate()];
  }
  const inicio = diaDeInicioDoMes(diaInicio);
  if (!inicio || dia >= inicio) return { year: ano, month: mes };
  const antes = new Date(ano, mes - 2, 1);
  return { year: antes.getFullYear(), month: antes.getMonth() + 1 };
}

const dd = (n: number) => String(n).padStart(2, "0");

/** "15/10 a 14/11" para o mês (year, month); null quando o mês é o de sempre. */
export function intervaloDoMes(year: number, month: number, diaInicio: number | null | undefined): string | null {
  const inicio = diaDeInicioDoMes(diaInicio);
  if (!inicio) return null;
  const fim = new Date(year, month, inicio - 1);
  return `${dd(inicio)}/${dd(month)} a ${dd(fim.getDate())}/${dd(fim.getMonth() + 1)}`;
}

// ---------------------------------------------------------------------------------------------
// O período na tela (30/10/2026). Antes só o lançamento novo passava pela regra; o mês "de agora"
// do Resumo, do Orçamento e do seletor, os "dias restantes" e o "Paguei" eram do calendário, e quem
// escolheu o dia via número errado do dia 1 ao 14. Sem dia escolhido, tudo aqui é o mês de sempre.
// ---------------------------------------------------------------------------------------------

export type PeriodoDoMes = {
  year: number;
  month: number;
  /** Primeiro e último dia, Date local à meia-noite (como o formulário). */
  inicio: Date;
  fim: Date;
  /** "AAAA-MM-DD" das duas pontas. */
  inicioIso: string;
  fimIso: string;
  /** Quantos dias o mês tem. */
  dias: number;
};

const isoLocal = (d: Date) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
const DIA_MS = 86_400_000;
const utcDoDia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/** O período do mês (year, month) da pessoa: de 15/10 a 14/11 com dia 15; de 1 ao fim sem dia. */
export function periodoDoMes(year: number, month: number, diaInicio: number | null | undefined): PeriodoDoMes {
  const inicioDia = diaDeInicioDoMes(diaInicio) ?? 1;
  const inicio = new Date(year, month - 1, inicioDia);
  const fim = inicioDia === 1 ? new Date(year, month, 0) : new Date(year, month, inicioDia - 1);
  const dias = Math.round((utcDoDia(fim) - utcDoDia(inicio)) / DIA_MS) + 1;
  return { year, month, inicio, fim, inicioIso: isoLocal(inicio), fimIso: isoLocal(fim), dias };
}

/** O mês "de agora" da pessoa: o período que contém hoje (no fuso que `agora` já traz). */
export function mesDeAgoraDaPessoa(agora: Date, diaInicio: number | null | undefined): { year: number; month: number } {
  return mesDoPeriodo(agora, diaInicio) ?? { year: agora.getFullYear(), month: agora.getMonth() + 1 };
}

/** O período que contém hoje. */
export function periodoDeAgora(agora: Date, diaInicio: number | null | undefined): PeriodoDoMes {
  const m = mesDeAgoraDaPessoa(agora, diaInicio);
  return periodoDoMes(m.year, m.month, diaInicio);
}

/**
 * A posição de um dia dentro do período (1 = o primeiro dia). Sem dia escolhido é o dia do mês. Fora
 * do período dá menos que 1 ou mais que `dias`; quem chama decide o que fazer.
 */
export function diaNoPeriodo(data: Date | string, p: PeriodoDoMes): number {
  const t = typeof data === "string" ? Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) : utcDoDia(data);
  return Math.round((t - utcDoDia(p.inicio)) / DIA_MS) + 1;
}

/** O dia está dentro do período? (`data` em "AAAA-MM-DD" ou Date local.) */
export function dentroDoPeriodo(data: Date | string, p: PeriodoDoMes): boolean {
  const n = diaNoPeriodo(data, p);
  return n >= 1 && n <= p.dias;
}

/** Dias que faltam no mês da pessoa, CONTANDO HOJE (1 no último dia), como a régua do Orçamento. */
export function diasRestantesNoMes(agora: Date, diaInicio: number | null | undefined): number {
  const p = periodoDeAgora(agora, diaInicio);
  return Math.max(1, p.dias - diaNoPeriodo(agora, p) + 1);
}

export type RelogioDoMes = {
  periodo: PeriodoDoMes;
  year: number;
  month: number;
  /** A posição de hoje no mês (1 = o primeiro dia) e quantos dias o mês tem. */
  dia: number;
  diasNoMes: number;
  /** Hoje à meia-noite UTC (como o entryDate, @db.Date) e em "AAAA-MM-DD". */
  hojeUtc: Date;
  hojeIso: string;
  /** Meia-noite de Brasília (03:00 UTC) do primeiro dia do mês. */
  inicioDoMes: Date;
  /** Meia-noite de Brasília da segunda desta semana, ou do primeiro dia do mês se a semana começou antes dele. */
  inicioDaSemana: Date;
};

/**
 * As datas que o Resumo (carregarFoco) usa, a partir de hoje e do dia da pessoa. Sem dia escolhido
 * dá exatamente o que o Resumo calculava antes com o calendário (ver o teste).
 * `indiceDoDiaDaSemana`: 0 = segunda ... 6 = domingo (diaDaSemana de lib/decisoes/foco-semana).
 */
export function relogioDoMes(agora: Date, diaInicio: number | null | undefined, indiceDoDiaDaSemana: number): RelogioDoMes {
  const periodo = periodoDeAgora(agora, diaInicio);
  const hojeUtc = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const tresDaManha = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 3));
  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - indiceDoDiaDaSemana);
  return {
    periodo,
    year: periodo.year,
    month: periodo.month,
    dia: diaNoPeriodo(agora, periodo),
    diasNoMes: periodo.dias,
    hojeUtc,
    hojeIso: hojeUtc.toISOString().slice(0, 10),
    inicioDoMes: tresDaManha(periodo.inicio),
    inicioDaSemana: tresDaManha(segunda < periodo.inicio ? periodo.inicio : segunda),
  };
}
