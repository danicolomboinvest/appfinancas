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
