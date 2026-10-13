import { mesmaCobranca } from "@/lib/contas/achar-contas";
import { comercianteDe, ehParcela, type LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";
import { chaveCobre, chaveUtil } from "@/lib/import/comerciante";
import { normalizarDescricao } from "@/lib/marcas/marca";

/**
 * Assinatura posta à mão (13/10/2026, pedido da Dani: "às vezes pode ter um botãozinho ali, mais,
 * e ela selecionar alguma coisa que é recorrente. Ou ela poder escrever algo").
 *
 * Mora na ContaAPagar com `tipo` = "assinatura": aparece em Assinaturas (não em Contas a pagar),
 * pesa no "Assinaturas" da renda com dono e conta como fixo na semana (a semana fixa já lê toda a
 * lista). Escolhida dos lançamentos, a `chaveDoHistorico` guarda o comerciante, e é por ela que os
 * próximos lançamentos são reconhecidos (o "pago este mês" e o aumento no Dinheiro perdido).
 *
 * Puro, sem banco.
 */

export const TIPO_ASSINATURA = "assinatura";

/** A recusa ("Não é assinatura") de uma achada sozinha mora na ContaRecusada com esta chave. */
export const PREFIXO_DA_RECUSA = "nao-assinatura:";

/** O nome sem acento, caixa nem espaço: "Smart Fit" e "SMARTFIT" são a mesma coisa. */
export function nomeBase(n: string): string {
  return n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function chaveDaRecusa(nome: string): string {
  return `${PREFIXO_DA_RECUSA}${nomeBase(nome)}`.slice(0, 160);
}

/** Quem cobra, na chave do motor ("m:netflix", "manychat"). Nulo quando a descrição não diz nada útil. */
export function chaveDoComercianteDe(descricao: string | null): string | null {
  if (!descricao) return null;
  const c = comercianteDe({ descricao } as LancamentoParaCacar);
  if (!c.chave || (!c.chave.startsWith("m:") && !chaveUtil(c.chave))) return null;
  return c.chave;
}

const CPF = /[•*]{3}\.?\s*\d{3}|\d{3}\.\d{3}\.\d{3}-\d{2}/;
const NAO_E_GASTO =
  /\b(aplicacao|resgate|caixinha|rdb|cdb|lci|lca|tesouro|pagamento de fatura|pagamento fatura|pgto fatura|pag fatura|fatura do cartao|mesma titularidade|entre contas|conta propria|investimento)\b/;

/** Um comerciante para a lista "Escolher dos meus lançamentos". */
export type ComercianteParaEscolher = {
  chave: string;
  nome: string;
  /** A descrição do último lançamento: acha o logo. */
  descricao: string;
  ultimoValor: number;
  /** "AAAA-MM-DD" do último, quando tem. */
  ultimaData: string | null;
  vezes: number;
  /** Em quantos meses diferentes apareceu (2 ou mais: cara de assinatura, vem primeiro). */
  meses: number;
  categoria: string | null;
};

const mesDe = (l: { ano: number; mes: number }) => l.ano * 12 + l.mes;

/**
 * Os gastos dos últimos meses, um item por comerciante: o último valor e quantas vezes apareceu.
 * Fora: parcela, Pix para pessoa (CPF), aplicação e fatura, estorno, e o que ela já marcou.
 * Primeiro o que aparece em mais meses (é o que tem cara de assinatura), depois o mais recente.
 */
export function comerciantesParaEscolher(lancamentos: LancamentoParaCacar[], jaTem: ReadonlySet<string> = new Set()): ComercianteParaEscolher[] {
  const grupos = new Map<string, { itens: LancamentoParaCacar[]; nome: string }>();
  for (const l of lancamentos) {
    if (l.tipo !== "EXPENSE" || l.estorno || !(l.valor > 0) || !l.descricao) continue;
    if (ehParcela(l) || CPF.test(l.descricao) || NAO_E_GASTO.test(normalizarDescricao(l.descricao))) continue;
    const c = comercianteDe(l);
    if (!c.chave || (!c.chave.startsWith("m:") && !chaveUtil(c.chave)) || jaTem.has(c.chave)) continue;
    const g = grupos.get(c.chave) ?? { itens: [], nome: c.nome };
    g.itens.push(l);
    grupos.set(c.chave, g);
  }
  const ordem = (l: LancamentoParaCacar) => `${String(mesDe(l)).padStart(6, "0")}${l.data ?? ""}`;
  const out: ComercianteParaEscolher[] = [];
  for (const [chave, g] of grupos) {
    const itens = [...g.itens].sort((a, b) => ordem(a).localeCompare(ordem(b)));
    const ultimo = itens[itens.length - 1];
    const categorias = new Map<string, number>();
    for (const l of itens) if (l.categoria) categorias.set(l.categoria, (categorias.get(l.categoria) ?? 0) + 1);
    out.push({
      chave,
      nome: g.nome,
      descricao: ultimo.descricao ?? g.nome,
      ultimoValor: Math.round(ultimo.valor * 100) / 100,
      ultimaData: ultimo.data,
      vezes: itens.length,
      meses: new Set(itens.map(mesDe)).size,
      categoria: [...categorias.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    });
  }
  return out.sort((a, b) => Math.min(b.meses, 3) - Math.min(a.meses, 3) || (b.ultimaData ?? "").localeCompare(a.ultimaData ?? "") || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** A assinatura que ela pôs (do banco, já em número). */
export type AssinaturaDela = { id: string; nome: string; valor: number | null; diaDoMes: number | null; chaveDoHistorico: string | null; categoria: string | null };

/** O lançamento é a cobrança desta assinatura? Pelo comerciante aprendido ou pelo nome. */
export function ehDaAssinatura(descricao: string | null, a: Pick<AssinaturaDela, "nome" | "chaveDoHistorico">): boolean {
  if (!descricao) return false;
  const k = chaveDoComercianteDe(descricao);
  // A regra do comerciante vale para a linha com sobra no fim ("manychat" pega "manychat 26").
  if (a.chaveDoHistorico && k && chaveCobre(a.chaveDoHistorico, k)) return true;
  const nome = normalizarDescricao(a.nome);
  return nome.length >= 3 && ` ${normalizarDescricao(descricao)} `.includes(` ${nome} `);
}

/** Uma linha de Assinaturas na tela. */
export type AssinaturaDaTela = {
  /** A dela: o id da conta. A achada: "rx:" ou "dp:" + a chave do motor. */
  chave: string;
  id: string | null;
  nome: string;
  mensal: number;
  dia: number | null;
  /** "sua" = ela pôs; "extrato" = o app achou sozinho. */
  origem: "sua" | "extrato";
  /** Já saiu no extrato deste mês (só a dela, que tem comerciante aprendido ou nome). */
  pagaEsteMes: boolean;
  categoria: string | null;
};

type Achada = { chave: string; nome: string; mensal: number; comerciante?: string | null };

/**
 * Junta as dela com as achadas (Raio-X e Dinheiro perdido), sem repetir: a dela vence a achada do
 * mesmo comerciante ou nome; a achada que virou conta não aparece; a que ela disse "Não é
 * assinatura" some para sempre.
 */
export function juntarAssinaturas(e: {
  dela: AssinaturaDela[];
  achadas: Achada[];
  /** As contas a pagar (não assinaturas): a academia que virou conta não aparece de novo. */
  contas: { nome: string; valor: number | null; chaveDoHistorico?: string | null }[];
  recusas: ReadonlySet<string>;
  lancamentosDoMes: { descricao: string | null; valor: number }[];
}): AssinaturaDaTela[] {
  const delaComoConta = e.dela.map((d) => ({ nome: d.nome, valor: d.valor, chaveDoHistorico: d.chaveDoHistorico }));
  const daDela = (a: Achada) => {
    const k = a.comerciante ?? chaveDoComercianteDe(a.nome);
    return e.dela.some((d) => nomeBase(d.nome) === nomeBase(a.nome) || (k !== null && d.chaveDoHistorico === k)) || mesmaCobranca(a.nome, delaComoConta);
  };
  const vistas = new Set<string>();
  const achadas: AssinaturaDaTela[] = [];
  for (const a of e.achadas) {
    const base = nomeBase(a.nome);
    if (!(a.mensal > 0) || vistas.has(base) || e.recusas.has(chaveDaRecusa(a.nome))) continue;
    if (daDela(a) || mesmaCobranca(a.nome, e.contas)) continue;
    vistas.add(base);
    achadas.push({ chave: a.chave, id: null, nome: a.nome, mensal: a.mensal, dia: null, origem: "extrato", pagaEsteMes: false, categoria: null });
  }
  const delas: AssinaturaDaTela[] = e.dela.map((d) => ({
    chave: d.id,
    id: d.id,
    nome: d.nome,
    mensal: d.valor ?? 0,
    dia: d.diaDoMes,
    origem: "sua",
    pagaEsteMes: e.lancamentosDoMes.some((l) => l.valor > 0 && ehDaAssinatura(l.descricao, d)),
    categoria: d.categoria,
  }));
  return [...delas, ...achadas].sort((a, b) => b.mensal - a.mensal || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * O vencimento da assinatura: o dia dela neste mês (mesmo que já tenha passado: enquanto a
 * cobrança não aparece no extrato, a semana reserva). Sem dia, o último dia do mês.
 */
export function vencimentoDaAssinatura(dia: number | null, hoje: Date): Date {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, dia ? Math.min(dia, ultimo) : ultimo));
}
