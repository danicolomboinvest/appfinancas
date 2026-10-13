import type { AuthContext } from "@/lib/auth/session";
import { lancamentosDaEmpresa } from "@/lib/repositories/empresa.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import type { DadosDaEmpresa } from "./dados";
import { lerPeriodo, primeiroMesDoPeriodo, periodoDoTipo, primeiroDia, ultimoDia, type PeriodoDaEmpresa } from "./periodo";
import { lerChaveDoMes, mesAntes, type LancamentoDaEmpresa } from "./regras";

const ord = (m: { ano: number; mes: number }) => m.ano * 12 + m.mes;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * O período que a tela mostra, lido do endereço: ?periodo=, ?de=&ate= ou o ?mes=AAAA-MM de antes
 * (os links antigos continuam abrindo o mesmo mês). Sem nada: o `padrao` de cada tela.
 */
export function periodoDaTela(sp: Record<string, string | string[] | undefined>, hoje: string, padrao: PeriodoDaEmpresa | (() => PeriodoDaEmpresa)): PeriodoDaEmpresa {
  const lido = lerPeriodo({ periodo: um(sp.periodo), de: um(sp.de), ate: um(sp.ate) }, hoje);
  if (lido) return lido;
  const mes = lerChaveDoMes(um(sp.mes));
  if (mes) {
    const doMes = lerPeriodo({ de: primeiroDia(mes), ate: ultimoDia(mes) }, hoje);
    if (doMes) return doMes;
  }
  return typeof padrao === "function" ? padrao() : padrao;
}

/** O padrão da Visão geral e dos Relatórios: o último mês fechado (com dado); sem dado nele, o mês de hoje. */
export function padraoDaEmpresa(dados: Pick<DadosDaEmpresa, "hoje" | "mesAtual" | "lancamentos">): PeriodoDaEmpresa {
  const passado = mesAntes(dados.mesAtual, 1);
  const temDado = dados.lancamentos.some((l) => l.year === passado.ano && l.month === passado.mes);
  return periodoDoTipo(temDado ? "mes-passado" : "mes", dados.hoje);
}

/**
 * Os lançamentos que o período precisa. A Empresa já lê os últimos 12 meses fechados e o mês de
 * hoje; um período mais antigo (Escolher datas, 2024) busca a partir do primeiro mês dele, sempre
 * no perfil aberto.
 */
export async function lancamentosParaOPeriodo(ctx: AuthContext, dados: Pick<DadosDaEmpresa, "mesAtual" | "lancamentos">, p: PeriodoDaEmpresa): Promise<LancamentoDaEmpresa[]> {
  const ini = primeiroMesDoPeriodo(p);
  if (ord(ini) >= ord(mesAntes(dados.mesAtual, 12))) return dados.lancamentos;
  return lancamentosDaEmpresa(ctx, ini);
}

/** O nome das categorias personalizadas do perfil (as da Empresa), para os totais por categoria. */
export async function nomesDasCategorias(ctx: AuthContext): Promise<Record<string, { nome: string; icone: string }>> {
  const cs = await listCustomCategories(ctx);
  return Object.fromEntries(cs.map((c) => [c.id, { nome: c.name, icone: c.icon }]));
}
