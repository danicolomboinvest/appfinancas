"use server";

import { revalidatePath } from "next/cache";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { HORAS_POR_MES_PADRAO, PRAZOS_DO_CREDITO, RAMOS, TIPOS_DE_EMPRESA, ehForma, lerConfigEmpresa, type ConfigEmpresa, type Forma, type Ramo, type TipoDeEmpresa } from "@/lib/empresa/config";
import { mesAntes, somarDias, type Mes } from "@/lib/empresa/regras";
import { guiaDoMeiDaEmpresa, MESES } from "@/lib/empresa/resumo";
import { ehAtividadeDoMei } from "@/lib/empresa/legal";
import type { AuthContext } from "@/lib/auth/session";
import { garantirContaDaGuia, lancamentosDaEmpresa, lerPerfilDaEmpresa, marcarRecebida, registrarPagamento, registrarVenda, salvarConfigDaEmpresa, transferirSalario } from "@/lib/repositories/empresa.repo";
import { marcarContaPaga } from "@/lib/repositories/conta-a-pagar.repo";
import { parametrosDoMei } from "@/lib/repositories/parametro-legal.repo";

type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

async function sessaoDaEmpresa() {
  const ctx = await getRequiredSession();
  if (!ehEmpresa(ctx.profileKind)) throw new Error("Esta área é do perfil Empresa.");
  return ctx;
}

function hojeIso(): string {
  const a = nowInBrazil();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
}

function valorValido(v: unknown, max = 10_000_000): number | null {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

/**
 * A conta "Guia do MEI" das Recorrentes com o valor da fonte única (valorDaGuia): o digitado, a
 * última guia paga ou a estimativa pela atividade. Cria a conta se ainda não existe.
 */
async function acertarContaDaGuia(ctx: AuthContext, config: ConfigEmpresa) {
  if (config.tipo !== "MEI") return;
  const hoje = hojeIso();
  const mesAtual = { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
  const [legal, lancamentos] = await Promise.all([parametrosDoMei(hoje), lancamentosDaEmpresa(ctx, mesAntes(mesAtual, 12))]);
  if (!legal.diaDoDas) return;
  const guia = guiaDoMeiDaEmpresa({ config, legal, lancamentos });
  if (guia) await garantirContaDaGuia(ctx, { valor: guia.valor, dia: legal.diaDoDas.valor, lembrar: config.lembreteDas, hoje });
}

function atualizar() {
  revalidatePath("/empresa", "layout");
  revalidatePath("/mensal", "layout");
}

export type RespostasDoAssistente = {
  tipo: TipoDeEmpresa;
  faz: Ramo;
  formas: Forma[];
  prazoCredito: number;
  salario: number | null;
  lembreteDas: boolean;
};

/** "Abrir meu negócio": guarda o que o assistente perguntou e põe a guia do MEI nas contas. */
export async function abrirNegocioAction(r: RespostasDoAssistente): Promise<Resultado> {
  const ctx = await sessaoDaEmpresa();
  if (!TIPOS_DE_EMPRESA.includes(r.tipo)) return { ok: false, erro: "Escolha o tipo da empresa." };
  const atual = (await lerPerfilDaEmpresa(ctx)).config;
  const config: ConfigEmpresa = {
    tipo: r.tipo,
    faz: RAMOS.some((x) => x.chave === r.faz) ? r.faz : "outro",
    formas: (r.formas ?? []).filter(ehForma),
    prazoCredito: (PRAZOS_DO_CREDITO as readonly number[]).includes(r.prazoCredito) ? r.prazoCredito : 30,
    salario: r.salario !== null && Number.isFinite(r.salario) && r.salario >= 0 ? Math.round(r.salario * 100) / 100 : null,
    diaDoSalario: atual?.diaDoSalario ?? 5,
    lembreteDas: r.lembreteDas !== false,
    taxas: atual?.taxas ?? { credito: null, debito: null },
    horasPorMes: atual?.horasPorMes ?? HORAS_POR_MES_PADRAO,
    abertoEm: atual?.abertoEm ?? new Date().toISOString(),
    atividadeMei: atual?.atividadeMei ?? "servico",
    dasDigitado: atual?.dasDigitado ?? null,
  };
  await salvarConfigDaEmpresa(ctx, config);
  await acertarContaDaGuia(ctx, config);
  atualizar();
  return { ok: true };
}

/** Configurações da empresa: muda um pedaço da configuração. */
export async function ajustarEmpresaAction(mudanca: Partial<Pick<ConfigEmpresa, "salario" | "lembreteDas" | "taxas" | "horasPorMes" | "diaDoSalario" | "tipo" | "faz" | "atividadeMei">>): Promise<Resultado> {
  const ctx = await sessaoDaEmpresa();
  const atual = (await lerPerfilDaEmpresa(ctx)).config;
  if (!atual) return { ok: false, erro: "Abra o seu negócio primeiro." };
  if (mudanca.atividadeMei !== undefined && !ehAtividadeDoMei(mudanca.atividadeMei)) return { ok: false, erro: "Escolha o que o MEI faz." };
  const novo = lerConfigEmpresa({ ...atual, ...mudanca, taxas: { ...atual.taxas, ...(mudanca.taxas ?? {}) } });
  if (!novo) return { ok: false, erro: "Não deu para salvar." };
  await salvarConfigDaEmpresa(ctx, novo);
  if (mudanca.lembreteDas !== undefined || mudanca.atividadeMei !== undefined) await acertarContaDaGuia(ctx, novo);
  atualizar();
  return { ok: true };
}

/**
 * "Usar o valor da minha guia": o valor que ela digitou passa a valer no Resumo, em Impostos e na
 * conta "Guia do MEI" das Recorrentes, até ela pagar uma guia depois disso. `null` volta para o
 * valor estimado pelo app.
 */
export async function usarValorDaGuiaAction(valor: number | null): Promise<Resultado> {
  const ctx = await sessaoDaEmpresa();
  const atual = (await lerPerfilDaEmpresa(ctx)).config;
  if (!atual || atual.tipo !== "MEI") return { ok: false, erro: "Isso é do MEI." };
  let dasDigitado: ConfigEmpresa["dasDigitado"] = null;
  if (valor !== null) {
    const v = valorValido(valor, 100_000);
    if (!v) return { ok: false, erro: "Digite o valor da guia." };
    dasDigitado = { valor: v, em: hojeIso() };
  }
  const novo: ConfigEmpresa = { ...atual, dasDigitado };
  await salvarConfigDaEmpresa(ctx, novo);
  await acertarContaDaGuia(ctx, novo);
  atualizar();
  return { ok: true };
}

export type VendaDoRegistrar = { valor: number; forma: Forma; cliente: string | null; cai: "agora" | "prazo" | "data"; data: string | null };

/** "Vendi". O cliente e o dia em que o dinheiro cai são opcionais (plano, seção 4). */
export async function vendiAction(v: VendaDoRegistrar): Promise<Resultado> {
  const ctx = await sessaoDaEmpresa();
  const valor = valorValido(v.valor);
  if (!valor) return { ok: false, erro: "Digite quanto entrou." };
  if (!ehForma(v.forma)) return { ok: false, erro: "Escolha como pagou." };
  const hoje = hojeIso();
  const config = (await lerPerfilDaEmpresa(ctx)).config;
  let recebeEm: string | null = null;
  if (v.cai === "prazo") recebeEm = somarDias(hoje, v.forma === "credito" ? (config?.prazoCredito ?? 30) : v.forma === "debito" ? 1 : 30);
  if (v.cai === "data" && v.data && /^\d{4}-\d{2}-\d{2}$/.test(v.data)) recebeEm = v.data;
  const cliente = v.cliente?.trim().slice(0, 80) || null;
  await registrarVenda(ctx, { valor, forma: v.forma, cliente, hoje, recebeEm: recebeEm && recebeEm > hoje ? recebeEm : null, recebida: !recebeEm || recebeEm <= hoje });
  atualizar();
  return { ok: true, mensagem: "Entrada registrada" };
}

/** O que ela pagou: uma conta das Recorrentes ou um tipo de gasto do dia a dia. */
const TIPOS_DE_PAGAMENTO: Record<string, { parent: ParentCategory; sub: string | null; nome: string }> = {
  insumos: { parent: "ALIMENTACAO", sub: "Matéria-prima", nome: "Insumos" },
  embalagens: { parent: "ALIMENTACAO", sub: "Embalagens", nome: "Embalagens" },
  entregas: { parent: "TRANSPORTE", sub: "Frete", nome: "Entregas" },
  anuncios: { parent: "EDUCACAO", sub: "Anúncios", nome: "Anúncios" },
  maquininha: { parent: "EDUCACAO", sub: "Taxas de cartão/maquininha", nome: "Maquininha" },
  outro: { parent: "OUTROS", sub: null, nome: "Outro" },
};

export async function pagueiAction(p: { valor: number; tipo?: string; contaId?: string; contaNome?: string }): Promise<Resultado> {
  const ctx = await sessaoDaEmpresa();
  const valor = valorValido(p.valor);
  if (!valor) return { ok: false, erro: "Digite o valor pago." };
  const hoje = hojeIso();
  if (p.contaId) {
    const ehGuia = p.contaNome === "Guia do MEI";
    const paga = await marcarContaPaga(ctx, p.contaId);
    if (!paga) return { ok: false, erro: "Essa conta já estava paga." };
    await registrarPagamento(ctx, {
      valor,
      parentCategory: ehGuia ? "IMPOSTOS" : "MORADIA",
      subcategory: ehGuia ? "DAS (Simples Nacional)" : null,
      descricao: (p.contaNome ?? "Conta").slice(0, 80),
      hoje,
    });
    // A guia paga agora é a mais recente: a conta da próxima fica com o valor dela.
    if (ehGuia) {
      const config = (await lerPerfilDaEmpresa(ctx)).config;
      if (config) await acertarContaDaGuia(ctx, config);
    }
  } else {
    const t = TIPOS_DE_PAGAMENTO[p.tipo ?? ""];
    if (!t) return { ok: false, erro: "Escolha o que você pagou." };
    await registrarPagamento(ctx, { valor, parentCategory: t.parent, subcategory: t.sub, descricao: t.nome, hoje });
  }
  atualizar();
  return { ok: true, mensagem: "Pagamento registrado" };
}

/** "Recebi": a venda a prazo virou dinheiro. */
export async function recebiAction(id: string): Promise<Resultado> {
  const ctx = await sessaoDaEmpresa();
  const r = await marcarRecebida(ctx, id, hojeIso());
  if (r.count === 0) return { ok: false, erro: "Essa entrada já estava recebida." };
  atualizar();
  return { ok: true };
}

/** O holerite: o salário do mês fechado vai para o Pessoal (é o registro; nada sai do banco). */
export async function transferirSalarioAction(p: { ano: number; mes: number; valor: number }): Promise<Resultado & { pessoalId?: string }> {
  const ctx = await sessaoDaEmpresa();
  const valor = valorValido(p.valor);
  if (!valor) return { ok: false, erro: "Sem salário para transferir neste mês." };
  const hoje = hojeIso();
  const ref: Mes = { ano: p.ano, mes: p.mes };
  const [a, m] = hoje.split("-").map(Number);
  const atual = { ano: a, mes: m };
  // Só mês que já fechou, e no máximo os 12 de trás.
  const idx = (x: Mes) => x.ano * 12 + x.mes;
  if (idx(ref) >= idx(atual) || idx(ref) < idx(mesAntes(atual, 12))) return { ok: false, erro: "O salário sai quando o mês fecha." };
  const { nome } = await lerPerfilDaEmpresa(ctx);
  const r = await transferirSalario(ctx, { ref, valor, hoje, nomeDaEmpresa: nome, nomeDoMes: `${MESES[ref.mes - 1]} de ${ref.ano}` });
  if (!r.ok) return r;
  atualizar();
  return { ok: true, pessoalId: r.pessoal.id };
}
