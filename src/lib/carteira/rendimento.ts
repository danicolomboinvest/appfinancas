/**
 * O rendimento do mês da Carteira (15/10/2026), a partir do que o app guarda dia a dia: o ganho
 * (atual menos investido) e o total. O ganho muda quando o preço muda, não quando a pessoa aporta
 * (o aporte sobe o investido e o atual juntos), então a diferença do ganho entre dois dias é o que
 * a carteira rendeu nesse intervalo, sem contar o que ela pôs.
 *
 * Só vale com um registro do começo do mês. O app não inventa o resto: sem o registro, devolve
 * null e a tela diz que ainda está juntando o histórico.
 */
export type RegistroDaCarteira = { dia: string; ganho: number; total: number };
export type RendimentoDoMes = { valor: number; pct: number | null; desde: string };

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

export function rendimentoDoMes(registros: RegistroDaCarteira[], hoje: string, agora: { ganho: number | null; total: number }): RendimentoDoMes | null {
  if (agora.ganho === null) return null;
  const base = registroDoComecoDoMes(registros, hoje);
  if (!base) return null;
  const valor = arredonda(agora.ganho - base.ganho);
  return { valor, pct: base.total > 0 ? valor / base.total : null, desde: base.dia };
}
