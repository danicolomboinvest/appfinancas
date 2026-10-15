/**
 * O rendimento do mês da Carteira (15/10/2026), a partir de um registro por dia de cada ativo: o
 * valor atual e o investido. O que o ativo rendeu é a mudança do ganho dele (atual menos investido):
 * o aporte sobe o atual e o investido juntos, então não vira rendimento.
 *
 * Para nunca vir errado, só entram os ativos que existiam nos dois dias, com o investido
 * preenchido nos dois. Ativo novo no meio do mês, ativo apagado e ativo sem valor investido ficam
 * de fora (o ganho que eles já tinham não é do mês). Sem nenhum ativo assim, ou sem registro do
 * começo do mês, devolve null e a tela diz que ainda está juntando o histórico.
 */
export type AtivoRegistrado = { id: string; atual: number; investido: number | null };
export type RegistroDaCarteira = { dia: string; ativos: AtivoRegistrado[] };
export type RendimentoDoMes = {
  valor: number;
  /** Sobre o valor que esses ativos tinham no começo (fração). */
  pct: number | null;
  desde: string;
  /** Quantos ativos da Carteira de hoje ficaram de fora da conta (novos, sem investido ou sem registro). */
  deFora: number;
};

const DIA_MS = 86_400_000;
const instante = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const arredonda = (v: number) => Math.round(v * 100) / 100;

/** O registro que abre o mês: o mais recente até o dia 1 (no máximo 10 dias antes), senão o primeiro do mês. */
export function registroDoComecoDoMes(registros: RegistroDaCarteira[], hoje: string): RegistroDaCarteira | null {
  const primeiro = `${hoje.slice(0, 7)}-01`;
  const antes = registros.filter((r) => r.dia <= primeiro && instante(primeiro) - instante(r.dia) <= 10 * DIA_MS).sort((a, b) => b.dia.localeCompare(a.dia))[0];
  if (antes) return antes;
  return registros.filter((r) => r.dia > primeiro && r.dia < hoje).sort((a, b) => a.dia.localeCompare(b.dia))[0] ?? null;
}

export function rendimentoDoMes(registros: RegistroDaCarteira[], hoje: string, agora: AtivoRegistrado[]): RendimentoDoMes | null {
  const base = registroDoComecoDoMes(registros, hoje);
  if (!base) return null;
  const antes = new Map(base.ativos.map((a) => [a.id, a]));
  let valor = 0;
  let sobre = 0;
  let entram = 0;
  for (const a of agora) {
    const b = antes.get(a.id);
    if (!b || a.investido === null || a.investido <= 0 || b.investido === null || b.investido <= 0) continue;
    valor += a.atual - a.investido - (b.atual - b.investido);
    sobre += b.atual;
    entram += 1;
  }
  if (entram === 0) return null;
  return { valor: arredonda(valor), pct: sobre > 0 ? valor / sobre : null, desde: base.dia, deFora: agora.length - entram };
}
