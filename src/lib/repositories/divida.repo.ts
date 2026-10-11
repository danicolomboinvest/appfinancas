import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { TIPOS, type TipoDeDivida } from "@/lib/dividas/tipos";
import { nomeDaDivida, type DividaDoSpi } from "@/lib/dividas/saude";
import { taxaDe } from "@/lib/dividas/tipos";

/** O que o cadastro de 8 passos grava (e o "Editar" regrava). */
export type DividaInput = {
  tipo: TipoDeDivida;
  credor: string;
  apelido: string;
  paraQue: string | null;
  planejada: boolean;
  saldo: number;
  porMes: number;
  parcelasAbertas: number | null;
  parcelasTotal: number | null;
  semParcela: boolean;
  taxaMensal: number | null;
  diaVencimento: number | null;
  atrasada: boolean;
};

const TIPOS_VALIDOS = new Set<string>(TIPOS.map((t) => t.id));

type Linha = {
  id: string; tipo: string; credor: string; apelido: string; paraQue: string | null; planejada: boolean;
  saldo: unknown; porMes: unknown; parcelasAbertas: number | null; parcelasTotal: number | null; semParcela: boolean;
  taxaMensal: unknown; diaVencimento: number | null; atrasada: boolean;
};

function paraDivida(l: Linha): DividaDoSpi {
  return {
    id: l.id,
    tipo: (TIPOS_VALIDOS.has(l.tipo) ? l.tipo : "outra") as TipoDeDivida,
    credor: l.credor,
    apelido: l.apelido,
    nome: nomeDaDivida(l.credor, l.apelido),
    paraQue: l.paraQue,
    planejada: l.planejada,
    saldo: Number(l.saldo),
    porMes: Number(l.porMes),
    parcelasAbertas: l.parcelasAbertas,
    parcelasTotal: l.parcelasTotal,
    semParcela: l.semParcela,
    taxaMensal: l.taxaMensal == null ? null : Number(l.taxaMensal),
    diaVencimento: l.diaVencimento,
    atrasada: l.atrasada,
  };
}

/** As dívidas em aberto do perfil, na ordem em que ela cadastrou. */
export async function listarDividas(ctx: AuthContext): Promise<DividaDoSpi[]> {
  const linhas = await prisma.divida.findMany({ where: { ...doDono(ctx), quitadaEm: null }, orderBy: { createdAt: "asc" } });
  return linhas.map(paraDivida);
}

export async function criarDivida(ctx: AuthContext, d: DividaInput) {
  return prisma.divida.create({ data: { ...doDono(ctx), ...d } });
}

export async function editarDivida(ctx: AuthContext, id: string, d: DividaInput) {
  return prisma.divida.updateMany({ where: { id, ...doDono(ctx) }, data: d });
}

/** O estado que o Desfazer devolve. */
export type AntesDoToque = { saldo: number; parcelasAbertas: number | null; quitada: boolean };

/**
 * "Paguei uma parcela": o mês corre como no motor (o saldo ganha os juros do mês e perde o que ela
 * pagou) e falta uma parcela a menos. Se zerar, a dívida fica quitada.
 *
 * O `saldo` no filtro do update segura o toque duplo: o segundo toque não acha mais a dívida com o
 * saldo antigo.
 */
export async function pagarParcela(ctx: AuthContext, id: string): Promise<{ antes: AntesDoToque; quitada: boolean } | null> {
  const l = await prisma.divida.findFirst({ where: { id, ...doDono(ctx), quitadaEm: null } });
  if (!l) return null;
  const d = paraDivida(l);
  const juros = d.saldo * (taxaDe(d).taxa / 100);
  const saldo = Math.max(0, Math.round((d.saldo + juros - Math.max(d.porMes, 0)) * 100) / 100);
  const quitada = saldo <= 0.005;
  const parcelasAbertas = d.parcelasAbertas != null && d.parcelasAbertas > 0 ? d.parcelasAbertas - 1 : d.parcelasAbertas;
  const r = await prisma.divida.updateMany({
    where: { id, ...doDono(ctx), saldo: l.saldo, quitadaEm: null },
    data: { saldo, parcelasAbertas, quitadaEm: quitada ? new Date() : null },
  });
  if (r.count === 0) return null;
  return { antes: { saldo: d.saldo, parcelasAbertas: d.parcelasAbertas, quitada: false }, quitada };
}

/** "Quitei": sai da lista na hora, sem apagar (o Desfazer volta). */
export async function quitarDivida(ctx: AuthContext, id: string) {
  return prisma.divida.updateMany({ where: { id, ...doDono(ctx), quitadaEm: null }, data: { quitadaEm: new Date() } });
}

export async function desfazerToque(ctx: AuthContext, id: string, antes: AntesDoToque) {
  return prisma.divida.updateMany({ where: { id, ...doDono(ctx) }, data: { saldo: antes.saldo, parcelasAbertas: antes.parcelasAbertas, quitadaEm: null } });
}


/**
 * A Selic ao ano (em %) para comparar com os juros das dívidas: a das Taxas de referência (a da
 * pessoa ganha da global). Sem Selic cadastrada, o CDI anda junto dela; sem nenhum dos dois, null
 * (a tela usa o valor de reserva e diz que é de exemplo).
 */
export async function selicAnual(userId: string): Promise<number | null> {
  // Selic e CDI ao mesmo tempo (antes, o CDI esperava a Selic voltar vazia).
  const achados = await Promise.all(
    ["Selic", "CDI"].map((nome) =>
      prisma.referenceRate.findFirst({
        where: { OR: [{ userId }, { userId: null }], name: { contains: nome, mode: "insensitive" }, basis: { in: ["ANNUAL_252", "ANNUAL_365"] } },
        orderBy: [{ userId: { sort: "desc", nulls: "last" } }, { effectiveDate: "desc" }],
        select: { rateValue: true },
      }),
    ),
  );
  for (const r of achados) {
    const v = r ? Number(r.rateValue) : NaN;
    // A unidade do sistema é fração (0.1425 = 14,25%).
    if (Number.isFinite(v) && v > 0 && v <= 3) return v * 100;
  }
  return null;
}
