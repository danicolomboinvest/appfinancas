import type { AuthContext } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { mesAntes } from "@/lib/empresa/regras";
import { guiaDoMeiDaEmpresa } from "@/lib/empresa/resumo";
import type { ConfigEmpresa } from "@/lib/empresa/config";
import { garantirContaDaGuia, lancamentosDaEmpresa, lerPerfilDaEmpresa } from "@/lib/repositories/empresa.repo";
import { parametrosDoMei } from "@/lib/repositories/parametro-legal.repo";

/** O nome da conta da guia nas Recorrentes (garantirContaDaGuia). */
export const NOME_DA_GUIA = "Guia do MEI";

function hojeIso(): string {
  const a = nowInBrazil();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
}

/**
 * A conta "Guia do MEI" das Recorrentes com o valor da fonte única (valorDaGuia): o digitado, a
 * última guia paga ou a estimativa pela atividade. Cria a conta se ainda não existe.
 */
export async function acertarContaDaGuia(ctx: AuthContext, config: ConfigEmpresa) {
  if (config.tipo !== "MEI") return;
  const hoje = hojeIso();
  const mesAtual = { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
  const [legal, lancamentos] = await Promise.all([parametrosDoMei(hoje), lancamentosDaEmpresa(ctx, mesAntes(mesAtual, 12))]);
  if (!legal.diaDoDas) return;
  const guia = guiaDoMeiDaEmpresa({ config, legal, lancamentos });
  if (guia) await garantirContaDaGuia(ctx, { valor: guia.valor, dia: legal.diaDoDas.valor, lembrar: config.lembreteDas, hoje });
}

/**
 * O "Paguei" da guia (nas Recorrentes, na aba Contas ou no + da Empresa): a guia paga agora é a
 * mais recente, e a conta da próxima fica com o valor dela. Fora da Empresa, nada.
 */
export async function acertarGuiaDepoisDoPaguei(ctx: AuthContext, nomeDaConta: string) {
  if (nomeDaConta !== NOME_DA_GUIA || !ehEmpresa(ctx.profileKind)) return;
  const config = (await lerPerfilDaEmpresa(ctx)).config;
  if (config) await acertarContaDaGuia(ctx, config);
}
