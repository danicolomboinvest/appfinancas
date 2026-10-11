/**
 * A aba Recorrentes (versão nova, seção 3.17): em que seção cada conta mora, quanto ela pesa por
 * mês e o que sai em cada dia dos próximos 30. Puro, sem banco; datas em "AAAA-MM-DD".
 */
import { lerData } from "./contas";
import { ehMenosQueMensal, guardePorMes, mediaPorMes, ocorrencias, regraDaConta, type CamposDaRegra } from "./frequencia";

export type ContaDaAba = CamposDaRegra & {
  id: string;
  nome: string;
  valor: number | null;
  vencimento: string;
  pagaEm: string | null;
  diaDoMes: number | null;
  parcelaAtual: number | null;
  aproximado: boolean;
};

const fimDoMes = (hoje: Date) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
const mesmoMes = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

export function ehParcelada(c: Pick<ContaDaAba, "parcelas">): boolean {
  return (c.parcelas ?? 0) > 1;
}

/** Conta do ano: repete menos de uma vez por mês e não é parcela (IPVA, seguro, matrícula). */
export function ehDoAno(c: ContaDaAba): boolean {
  return !ehParcelada(c) && ehMenosQueMensal(regraDaConta(c));
}

/**
 * Já paga neste mês: pagou dentro do mês e o próximo vencimento ficou para depois dele. A diarista
 * paga no dia 15 com outra no dia 29 continua a pagar.
 */
export function pagaNoMes(c: ContaDaAba, hoje: Date): boolean {
  const paga = c.pagaEm ? lerData(c.pagaEm) : null;
  const venc = lerData(c.vencimento);
  return !!paga && !!venc && mesmoMes(paga, hoje) && venc.getTime() > fimDoMes(hoje).getTime();
}

/** Quanto falta pagar neste mês: as que vencem até o fim do mês (ou já venceram) e não foram pagas. */
export function faltaNoMes(contas: ContaDaAba[], hoje: Date): { total: number; quantas: number; aproximado: boolean } {
  const fim = fimDoMes(hoje).getTime();
  const abertas = contas.filter((c) => !ehDoAno(c) && !pagaNoMes(c, hoje) && (lerData(c.vencimento)?.getTime() ?? Infinity) <= fim);
  return { total: abertas.reduce((s, c) => s + (c.valor ?? 0), 0), quantas: abertas.length, aproximado: abertas.some((c) => c.aproximado || c.valor === null) };
}

/**
 * "Renda com dono": contas do dia a dia pela média por mês (a diarista a cada 2 semanas pesa
 * R$ 390, não R$ 180), parcelas pelo valor da parcela, e o que separar para as contas do ano.
 */
export function pesoPorMes(contas: ContaDaAba[], hoje: Date): { contas: number; parcelas: number; contasDoAno: number } {
  let contasMes = 0;
  let parcelas = 0;
  let doAno = 0;
  for (const c of contas) {
    const v = c.valor ?? 0;
    if (v <= 0) continue;
    const r = regraDaConta(c);
    if (ehParcelada(c)) parcelas += v;
    else if (ehDoAno(c)) {
      const venc = lerData(c.vencimento);
      if (venc) doAno += guardePorMes(v, venc, hoje);
    } else if (r.tipo === "nao_repete") {
      const venc = lerData(c.vencimento);
      if (venc && mesmoMes(venc, hoje)) contasMes += v;
    } else contasMes += mediaPorMes(v, r);
  }
  return { contas: Math.round(contasMes), parcelas: Math.round(parcelas), contasDoAno: Math.round(doAno) };
}

export type Vencimento = { chave: string; id: string; nome: string; valor: number | null; aproximado: boolean; dia: string };

/**
 * Cada vencimento entre hoje e `dias` à frente, de todas as contas (a diarista aparece duas vezes,
 * a do ano só quando cai na janela). Atrasadas não entram: a semana olha para frente.
 */
export function vencimentosDaJanela(contas: ContaDaAba[], hoje: Date, dias = 35): Vencimento[] {
  const ate = new Date(hoje.getTime() + dias * 86_400_000);
  const out: Vencimento[] = [];
  for (const c of contas) {
    const venc = lerData(c.vencimento);
    if (!venc) continue;
    const restantes = ehParcelada(c) ? (c.parcelas ?? 0) - (c.parcelaAtual ?? 1) + 1 : Infinity;
    const r = regraDaConta(c);
    const datas = r.tipo === "nao_repete" ? (venc >= hoje && venc <= ate ? [venc] : []) : ocorrencias(venc, r, hoje, ate, c.diaDoMes ?? venc.getUTCDate(), restantes);
    for (const d of datas) {
      const dia = d.toISOString().slice(0, 10);
      out.push({ chave: `${c.id}|${dia}`, id: c.id, nome: c.nome, valor: c.valor, aproximado: c.aproximado || c.valor === null, dia });
    }
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome, "pt-BR"));
}
