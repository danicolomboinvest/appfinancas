const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

/**
 * "Agora" ancorado no fuso horário de Brasília, não no fuso do servidor (que em produção roda
 * em UTC). Sem isso, entre 21h e meia-noite (horário de Brasília, = 00h-03h UTC do dia
 * seguinte) o servidor já "acha" que é o dia seguinte, o que classifica errado, por algumas
 * horas todo fim de mês/ano, um lançamento recorrente futuro como já realizado.
 *
 * O Date devolvido não representa o instante UTC de "agora em Brasília", ele carrega os
 * COMPONENTES de ano/mês/dia/hora corretos para o calendário do Brasil nos campos locais do
 * próprio Date, então basta ler com getFullYear()/getMonth()/getDate() normalmente, em
 * qualquer fuso em que o servidor esteja rodando.
 */
export function nowInBrazil(instant: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}
