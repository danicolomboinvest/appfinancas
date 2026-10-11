/**
 * "Saem nesta semana" das Recorrentes (protótipo aprovado, rodada 4): os 7 dias a partir de hoje,
 * com os vencimentos de cada um (a conta que repete aparece em cada dia em que cai), e as setas
 * para as próximas semanas até 30 dias. Conta aproximada (ou que varia) põe o "~" no total.
 */
export type ContaDaSemana = { chave?: string; id: string; nome: string; valor: number | null; vencimento: string; aproximado?: boolean; detalhe?: string };

export type DiaDaSemana = { iso: string; dia: number; sigla: string; contas: ContaDaSemana[]; hoje: boolean };

const SIGLAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function somaDias(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}

/** A semana `deslocamento` (0 = começa hoje; no máximo 4, até uns 30 dias à frente). */
export function semanaDasContas(contas: ContaDaSemana[], hoje: string, deslocamento = 0): { dias: DiaDaSemana[]; total: number; aproximado: boolean; intervalo: string } {
  const inicio = somaDias(hoje, Math.max(0, Math.min(4, deslocamento)) * 7);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const iso = somaDias(inicio, i);
    const d = new Date(`${iso}T12:00:00Z`);
    return { iso, dia: d.getUTCDate(), sigla: SIGLAS[d.getUTCDay()], contas: contas.filter((c) => c.vencimento === iso), hoje: iso === hoje };
  });
  const daSemana = dias.flatMap((d) => d.contas);
  const fim = dias[6].iso;
  const [, mi, di] = inicio.split("-").map(Number);
  const [, mf, df] = fim.split("-").map(Number);
  const intervalo = mi === mf ? `${di} a ${df} ${MES[mf - 1]}` : `${di} ${MES[mi - 1]} a ${df} ${MES[mf - 1]}`;
  return { dias, total: Math.round(daSemana.reduce((s, c) => s + (c.valor ?? 0), 0) * 100) / 100, aproximado: daSemana.some((c) => c.valor === null || c.aproximado), intervalo };
}
