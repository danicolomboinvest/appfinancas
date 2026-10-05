/**
 * Contas a pagar (05/10/2026): a Dani pediu "colocar contas a pagar, e o próprio app lembrar
 * você", inclusive as de valor que muda (luz, cartão). Aqui só as regras: em que situação cada
 * conta está, qual o próximo vencimento de uma conta que repete e quem recebe lembrete hoje.
 *
 * Datas são "dia de calendário" (sem hora), em UTC meia-noite, como o Postgres DATE devolve.
 * Puro, sem banco.
 */

export type ContaParaRegra = {
  id: string;
  nome: string;
  valor: number | null;
  vencimento: Date;
  repete: boolean;
  lembrar: boolean;
  quitada: boolean;
};

export type Situacao = "atrasada" | "hoje" | "amanha" | "semana" | "depois";

const DIA_MS = 86_400_000;

/** O dia (UTC meia-noite) de uma data qualquer, olhando o calendário de Brasília quando vem com hora. */
export function diaDe(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "Hoje" no calendário de Brasília (UTC−3), como dia sem hora. */
export function hojeEmBrasilia(agora: Date = new Date()): Date {
  return diaDe(new Date(agora.getTime() - 3 * 3_600_000));
}

export function diasAte(vencimento: Date, hoje: Date): number {
  return Math.round((diaDe(vencimento).getTime() - diaDe(hoje).getTime()) / DIA_MS);
}

export function situacao(vencimento: Date, hoje: Date): Situacao {
  const n = diasAte(vencimento, hoje);
  if (n < 0) return "atrasada";
  if (n === 0) return "hoje";
  if (n === 1) return "amanha";
  if (n <= 7) return "semana";
  return "depois";
}

/**
 * O mesmo dia no mês seguinte; se o mês não tem esse dia (31 em fevereiro), o último dia dele.
 * `diaOriginal` guarda a intenção: conta do dia 31 que passou por fevereiro volta pro 31 em março.
 */
export function proximoMes(vencimento: Date, diaOriginal = vencimento.getUTCDate()): Date {
  const ano = vencimento.getUTCFullYear();
  const mes = vencimento.getUTCMonth() + 1;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(diaOriginal, ultimo)));
}

/**
 * Depois do "paguei": a conta que repete vai pro mês seguinte ao vencimento que ela pagou (paga
 * atrasada ou adiantada, o próximo continua sendo no dia de sempre). A que não repete fica quitada.
 */
export function depoisDePagar(c: Pick<ContaParaRegra, "vencimento" | "repete">, diaOriginal?: number): { vencimento: Date; quitada: boolean } {
  if (!c.repete) return { vencimento: diaDe(c.vencimento), quitada: true };
  return { vencimento: proximoMes(diaDe(c.vencimento), diaOriginal), quitada: false };
}

/** As do Foco: atrasadas e as que vencem nos próximos 7 dias, da mais urgente para a menos. */
export function contasDoFoco<T extends ContaParaRegra>(contas: T[], hoje: Date): (T & { situacao: Situacao; dias: number })[] {
  return contas
    .filter((c) => !c.quitada)
    .map((c) => ({ ...c, situacao: situacao(c.vencimento, hoje), dias: diasAte(c.vencimento, hoje) }))
    .filter((c) => c.situacao !== "depois")
    .sort((a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome, "pt-BR"));
}

export type Lembrete = { contaId: string; quando: "vespera" | "dia"; chave: string };

/**
 * Quem recebe lembrete hoje: a conta que vence amanhã (véspera) e a que vence hoje (no dia).
 * A chave inclui o vencimento: a mesma conta no mês seguinte é outro lembrete.
 */
export function lembretesDeHoje(contas: ContaParaRegra[], hoje: Date): Lembrete[] {
  const out: Lembrete[] = [];
  for (const c of contas) {
    if (c.quitada || !c.lembrar) continue;
    const n = diasAte(c.vencimento, hoje);
    if (n !== 0 && n !== 1) continue;
    const quando = n === 0 ? "dia" : "vespera";
    out.push({ contaId: c.id, quando, chave: `conta|${c.id}|${diaDe(c.vencimento).toISOString().slice(0, 10)}|${quando}` });
  }
  return out;
}

/** "2026-10-12" → Date do dia. Recusa data que não existe (31/02). */
export function lerData(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}
