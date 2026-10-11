import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { listAssets } from "@/lib/repositories/asset.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listarContasAPagar, type ContaDaTela } from "@/lib/repositories/conta-a-pagar.repo";
import { parametrosDoMei } from "@/lib/repositories/parametro-legal.repo";
import { lancamentosDaEmpresa, lerPerfilDaEmpresa, perfilPessoal } from "@/lib/repositories/empresa.repo";
import { caixaDaEmpresa } from "@/lib/profiles/empresa";
import { nomeDoNegocio, type ConfigEmpresa } from "./config";
import type { ParametrosDoMei } from "./legal";
import { mesAntes, type LancamentoDaEmpresa, type Mes } from "./regras";

/**
 * Tudo que as telas da Empresa leem, numa ida ao banco: os lançamentos dos últimos 12 meses fechados
 * mais o mês de hoje, as contas, os números legais valendo hoje e o caixa. As contas em cima disso
 * moram em `resumo.ts` (sem banco).
 */
export type ContaDaEmpresa = { id: string; nome: string; valor: number | null; vencimento: string; pagaEm: string | null; lembrar: boolean; repete: boolean };

export type DadosDaEmpresa = {
  nome: string;
  negocio: { com: string; sem: string };
  config: ConfigEmpresa | null;
  /** "AAAA-MM-DD" em Brasília. */
  hoje: string;
  mesAtual: Mes;
  dia: number;
  diasNoMes: number;
  lancamentos: LancamentoDaEmpresa[];
  legal: ParametrosDoMei;
  caixa: number;
  contas: ContaDaEmpresa[];
  pessoal: { id: string; nome: string } | null;
  /** O primeiro nome dela (o "Para" do holerite e o "Ir para Ana, pessoal"). */
  primeiroNome: string;
  nomeCompleto: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function contaParaTela(c: ContaDaTela): ContaDaEmpresa {
  // O "pago em" é um instante: vira o dia de Brasília.
  return { id: c.id, nome: c.nome, valor: c.valor, vencimento: iso(c.vencimento), pagaEm: c.pagaEm ? iso(new Date(c.pagaEm.getTime() - 3 * 3_600_000)) : null, lembrar: c.lembrar, repete: c.repete };
}

export async function carregarEmpresa(ctx: AuthContext): Promise<DadosDaEmpresa> {
  const agora = nowInBrazil();
  const mesAtual = { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
  const hoje = `${mesAtual.ano}-${String(mesAtual.mes).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const [perfil, lancamentos, legal, ativos, fundo, contas, pessoal, user] = await Promise.all([
    lerPerfilDaEmpresa(ctx),
    lancamentosDaEmpresa(ctx, mesAntes(mesAtual, 12)),
    parametrosDoMei(hoje),
    listAssets(ctx),
    getEmergencyFund(ctx),
    listarContasAPagar(ctx),
    perfilPessoal(ctx),
    getOwnUser(ctx),
  ]);
  // O caixa: a mesma conta das outras telas da Empresa (o digitado na tela do caixa ou a reserva da carteira).
  const naCarteira = ativos.filter((a) => a.objective === "RESERVA_EMERGENCIA").reduce((s, a) => s + Number(a.currentValue), 0);
  const nomeCompleto = user.name?.trim() || user.email.split("@")[0];
  return {
    nome: perfil.nome,
    negocio: nomeDoNegocio(perfil.nome),
    config: perfil.config,
    hoje,
    mesAtual,
    dia: agora.getDate(),
    diasNoMes: new Date(mesAtual.ano, mesAtual.mes, 0).getDate(),
    lancamentos,
    legal,
    caixa: caixaDaEmpresa(fundo ? Number(fundo.currentAmount) : null, naCarteira),
    contas: contas.map(contaParaTela),
    pessoal,
    primeiroNome: nomeCompleto.split(" ")[0],
    nomeCompleto,
  };
}
