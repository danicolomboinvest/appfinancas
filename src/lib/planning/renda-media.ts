import { pareceContaPropria, pareceResgate } from "@/lib/import/dinheiro-proprio";
import { pareceEstorno } from "@/lib/import/estorno";

/**
 * Quanto entra num mês da pessoa, quando ela não disse (13/10/2026).
 *
 * Pedido da Dani: "o quanto entra não é para você considerar o último mês só. É para você
 * considerar a média do que ela colocou dos últimos 12 meses." Antes cada tela estimava de um
 * jeito: o Orçamento sugeria o que entrou no mês passado, as Recorrentes e as Dívidas usavam o
 * que entrou no mês corrente até hoje (dia 3, sem salário, a renda era quase zero), o Posso
 * comprar a mediana de 3 meses. Agora é uma conta só, aqui.
 *
 * A regra:
 * - a MÉDIA mensal dos últimos 12 meses FECHADOS (o mês corrente está pela metade);
 * - só os meses com alguma entrada lançada: quem começou a usar o app há 3 meses não divide por
 *   12, e um mês em que ela não lançou nada não vira "mês sem renda";
 * - com menos de 12 meses, os que existem (mínimo 1). A tela diz "média de N meses";
 * - o que não é renda continua fora: resgate de aplicação, transferência entre contas dela,
 *   estorno e reembolso.
 *
 * O que ela DIGITOU (a renda planejada do mês) sempre vence esta estimativa: quem decide é quem
 * chama (ver `rendaDeReferencia`). Este arquivo é sem banco (as telas de cliente usam o texto);
 * a leitura mora em `repositories/renda-media.repo.ts`.
 */

/** Quantos meses fechados olhar para trás. */
export const MESES_DA_MEDIA = 12;

export type RendaMedia = {
  /** Média mensal do que entrou nos meses considerados. */
  valor: number;
  /** Quantos meses fechados (com entrada) entraram na média: 1 a 12. */
  meses: number;
};

/**
 * Os termos que a estimativa antiga (mediana de 3 meses) já tirava pelo "contém" do SQL. Ficam,
 * para nada que estava fora voltar a contar como renda.
 */
const TERMOS_QUE_NAO_SAO_RENDA = /(resgate|caixinha|rdb|cdb|estorno)/i;

/**
 * Esta entrada é renda de verdade? Não: resgate, dinheiro dela mesma, estorno ou reembolso.
 * `nomeDaPessoa` (30/10/2026): o Pix que ela recebe da própria conta em outro banco chega como
 * "Pix Recebido <nome dela>" e entrava na média como se fosse salário. Com o nome, vale a mesma
 * regra da importação (lib/import/dinheiro-proprio, inclusive o nome cortado pelo banco).
 */
export function ehRendaDeVerdade(e: { description?: string | null }, nomeDaPessoa: string | null = null): boolean {
  const d = e.description ?? "";
  if (!d) return true;
  if (TERMOS_QUE_NAO_SAO_RENDA.test(d)) return false;
  return !pareceEstorno(d) && !pareceResgate(d) && !pareceContaPropria(d, nomeDaPessoa);
}

/** Os 12 meses fechados antes do mês de `hoje`, do mais recente ao mais antigo. */
export function mesesDaMedia(hoje: Date): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = 1; i <= MESES_DA_MEDIA; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

/**
 * A conta, sem banco. Recebe as entradas (já sem o que não é renda, ou não: o filtro é aplicado
 * de novo aqui) e devolve a média dos meses fechados com entrada, ou null sem nenhum.
 */
export function mediaDaRenda(
  entradas: { year: number; month: number; amount: number; description?: string | null }[],
  hoje: Date,
  nomeDaPessoa: string | null = null,
): RendaMedia | null {
  const janela = new Set(mesesDaMedia(hoje).map((m) => `${m.year}-${m.month}`));
  const porMes = new Map<string, number>();
  for (const e of entradas) {
    const k = `${e.year}-${e.month}`;
    if (!janela.has(k) || !ehRendaDeVerdade(e, nomeDaPessoa)) continue;
    porMes.set(k, (porMes.get(k) ?? 0) + Number(e.amount));
  }
  const valores = [...porMes.values()].filter((v) => v > 0);
  if (valores.length === 0) return null;
  const soma = valores.reduce((s, v) => s + v, 0);
  return { valor: Math.round((soma / valores.length) * 100) / 100, meses: valores.length };
}

/** "média de 12 meses", "média de 1 mês". */
export function textoDaMedia(meses: number): string {
  return `média de ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/**
 * O que ela guarda por mês, de verdade: a média dos aportes dos meses fechados da mesma janela
 * de 12 meses, só os meses com algum aporte (14/10/2026, prazo que cabe nas metas, quando a renda
 * não é conhecida). Mês com resgate maior que o aporte não entra. Null sem nenhum.
 */
export function mediaDosAportes(aportes: { year: number; month: number; amount: number }[], hoje: Date): number | null {
  const janela = new Set(mesesDaMedia(hoje).map((m) => `${m.year}-${m.month}`));
  const porMes = new Map<string, number>();
  for (const a of aportes) {
    const k = `${a.year}-${a.month}`;
    if (!janela.has(k)) continue;
    porMes.set(k, (porMes.get(k) ?? 0) + Number(a.amount));
  }
  const valores = [...porMes.values()].filter((v) => v > 0);
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100;
}
