import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { diasDeUso, ondeParou, type DadosDaJornada, type OndeParou } from "@/lib/jornada/jornada";

/**
 * Os dados da Jornada (painel do admin). Só contagens por pessoa na lista; o detalhe (telas,
 * tentativas, lançamentos) só da pessoa aberta, para não puxar o banco inteiro a cada visita
 * (o Neon cobra a transferência). Nunca lê o ImportFile.
 */

export type Saida = {
  /** Para abrir a pessoa pela URL sem pôr o e-mail nela: o id da conta, ou do acesso sem conta. */
  chave: string;
  email: string;
  userId: string | null;
  nome: string | null;
  saiuEm: Date;
  /** A data veio do aviso da Hubla/Apple (exata) ou é a última mudança do acesso (antes de 16/10). */
  dataExata: boolean;
  via: "hubla" | "apple";
  ondeParou: OndeParou;
  diasDeUso: number;
  /** Abriu pelo app instalado em algum momento. */
  instalado: boolean;
};

export type VisaoDaJornada = {
  saidas: Saida[];
  /** Liberações novas (Hubla e Apple) na mesma janela, para a porcentagem. */
  compras: number;
};

/** De onde veio a liberação da Hubla (o mesmo filtro do reembolso, sem o VIP). */
const VEIO_DA_HUBLA: Prisma.AllowedEmailWhereInput = { OR: [{ source: "HUBLA" }, { lastHublaInvoiceId: { not: null } }] };

/**
 * Quem saiu desde `desde`. Reembolso: a Hubla com a data guardada (desde 16/10/2026), a Apple
 * (revogadaEm) e, para trás, o acesso da Hubla desligado antes do vencimento sem "cancelou", que é
 * o que o reembolso fazia sem deixar data. Cancelou: saiu da assinatura e fica até o vencimento.
 */
export async function lerJornada(desde: Date, tipo: "reembolso" | "cancelou"): Promise<VisaoDaJornada> {
  const saidasBrutas: (Omit<Saida, "chave" | "userId" | "nome" | "ondeParou" | "diasDeUso" | "instalado"> & { acessoId: string | null })[] = [];

  if (tipo === "reembolso") {
    const [hubla, legado, apple] = await Promise.all([
      prisma.allowedEmail.findMany({ where: { active: false, reembolsadoEm: { gte: desde } }, select: { id: true, email: true, reembolsadoEm: true } }),
      prisma.allowedEmail.findMany({
        where: { active: false, reembolsadoEm: null, canceladoEm: null, updatedAt: { gte: desde }, ...VEIO_DA_HUBLA },
        select: { id: true, email: true, updatedAt: true, expiresAt: true },
      }),
      prisma.assinaturaApple.findMany({ where: { revogadaEm: { gte: desde } }, select: { revogadaEm: true, user: { select: { email: true } } } }),
    ]);
    for (const h of hubla) saidasBrutas.push({ acessoId: h.id, email: h.email, saiuEm: h.reembolsadoEm!, dataExata: true, via: "hubla" });
    // Desligado antes de vencer = reembolso (o vencimento desliga só depois do prazo).
    for (const l of legado) if (!l.expiresAt || l.expiresAt > l.updatedAt) saidasBrutas.push({ acessoId: l.id, email: l.email, saiuEm: l.updatedAt, dataExata: false, via: "hubla" });
    for (const a of apple) saidasBrutas.push({ acessoId: null, email: a.user.email, saiuEm: a.revogadaEm!, dataExata: true, via: "apple" });
  } else {
    const canceladas = await prisma.allowedEmail.findMany({ where: { canceladoEm: { gte: desde } }, select: { id: true, email: true, canceladoEm: true } });
    for (const c of canceladas) saidasBrutas.push({ acessoId: c.id, email: c.email, saiuEm: c.canceladoEm!, dataExata: true, via: "hubla" });
  }

  // Uma linha por pessoa (a saída mais recente).
  const porEmail = new Map<string, (typeof saidasBrutas)[number]>();
  for (const s of saidasBrutas) {
    const email = normalizeEmail(s.email);
    const atual = porEmail.get(email);
    if (!atual || atual.saiuEm < s.saiuEm) porEmail.set(email, { ...s, email });
  }
  const emails = [...porEmail.keys()];

  const [usuarios, compras] = await Promise.all([
    emails.length ? prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, name: true } }) : [],
    prisma.allowedEmail.count({ where: { createdAt: { gte: desde }, source: { in: ["HUBLA", "APPLE"] } } }),
  ]);
  const ids = usuarios.map((u) => u.id);
  const resumos = await resumirPessoas(ids);

  const saidas: Saida[] = emails.map((email) => {
    const { acessoId, ...s } = porEmail.get(email)!;
    const u = usuarios.find((x) => normalizeEmail(x.email) === email);
    const r = u ? resumos.get(u.id) : undefined;
    return {
      ...s,
      chave: u?.id ?? `a-${acessoId}`,
      userId: u?.id ?? null,
      nome: u?.name ?? null,
      ondeParou: ondeParou({ temConta: !!u, tentativas: r?.tentativas ?? 0, lidas: r?.lidas ?? 0, gravadas: r?.gravadas ?? 0 }),
      diasDeUso: r?.dias ?? 0,
      instalado: r?.instalado ?? false,
    };
  });
  saidas.sort((a, b) => b.saiuEm.getTime() - a.saiuEm.getTime());
  return { saidas, compras };
}

type ResumoDaPessoa = { tentativas: number; lidas: number; gravadas: number; dias: number; instalado: boolean };

/** As contagens de cada pessoa da lista, em poucas consultas agrupadas. */
async function resumirPessoas(ids: string[]): Promise<Map<string, ResumoDaPessoa>> {
  const mapa = new Map<string, ResumoDaPessoa>();
  if (ids.length === 0) return mapa;
  for (const id of ids) mapa.set(id, { tentativas: 0, lidas: 0, gravadas: 0, dias: 0, instalado: false });

  const [tentativas, lidas, gravadas, lotes, uso] = await Promise.all([
    prisma.importDiagnostic.groupBy({ by: ["userId"], where: { userId: { in: ids }, stage: "parse" }, _count: { _all: true } }),
    prisma.importDiagnostic.groupBy({ by: ["userId"], where: { userId: { in: ids }, stage: "parse", ok: true, parsed: { gt: 0 } }, _count: { _all: true } }),
    prisma.importDiagnostic.groupBy({ by: ["userId"], where: { userId: { in: ids }, stage: "confirm", ok: true, created: { gt: 0 } }, _count: { _all: true } }),
    // Importação de antes do diagnóstico de gravação (18/09/2026) só deixou o lote.
    prisma.importBatch.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.$queryRaw<{ userId: string; dias: bigint; instalado: boolean }[]>`
      SELECT "userId",
             COUNT(DISTINCT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) AS dias,
             BOOL_OR("standalone") AS instalado
      FROM "UsageEvent"
      WHERE "userId" IN (${Prisma.join(ids)})
      GROUP BY "userId"`,
  ]);
  for (const t of tentativas) mapa.get(t.userId)!.tentativas = t._count._all;
  for (const t of lidas) mapa.get(t.userId)!.lidas = t._count._all;
  for (const t of gravadas) mapa.get(t.userId)!.gravadas = t._count._all;
  for (const t of lotes) {
    const r = mapa.get(t.userId)!;
    r.gravadas = Math.max(r.gravadas, t._count._all);
  }
  for (const u of uso) {
    const r = mapa.get(u.userId);
    if (r) {
      r.dias = Number(u.dias);
      r.instalado = u.instalado;
    }
  }
  return mapa;
}

export type PessoaDaJornada = {
  email: string;
  nome: string | null;
  dados: DadosDaJornada;
  diasDeUso: number;
  instalado: boolean;
  /** O último "antes de cancelar" que ela abriu: motivo e o texto que escreveu. */
  motivo: { motivo: string; texto: string | null } | null;
};

/** Tudo de uma pessoa, para a linha do tempo. */
export async function lerPessoaDaJornada(email: string, saiuEm: Date | null, comoSaiu: DadosDaJornada["comoSaiu"]): Promise<PessoaDaJornada | null> {
  const e = normalizeEmail(email);
  const [acesso, usuario] = await Promise.all([
    prisma.allowedEmail.findUnique({ where: { email: e }, select: { createdAt: true, source: true } }),
    prisma.user.findUnique({ where: { email: e }, select: { id: true, name: true, createdAt: true } }),
  ]);
  if (!acesso && !usuario) return null;

  const [usos, tentativas, lotes, manuais, apple, motivo] = usuario
    ? await Promise.all([
        prisma.usageEvent.findMany({ where: { userId: usuario.id }, select: { name: true, path: true, createdAt: true, standalone: true }, orderBy: { createdAt: "asc" }, take: 5000 }),
        prisma.importDiagnostic.findMany({
          where: { userId: usuario.id },
          select: { stage: true, ok: true, target: true, kind: true, encoding: true, message: true, parsed: true, created: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          take: 500,
        }),
        prisma.importBatch.findMany({ where: { userId: usuario.id }, select: { createdAt: true, _count: { select: { entries: true } } }, orderBy: { createdAt: "asc" }, take: 500 }),
        prisma.monthlyEntry.findMany({ where: { userId: usuario.id, importBatchId: null }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 2000 }),
        prisma.assinaturaApple.findFirst({ where: { userId: usuario.id }, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
        prisma.motivoDeCancelamento.findFirst({ where: { userId: usuario.id }, select: { motivo: true, texto: true }, orderBy: { createdAt: "desc" } }),
      ])
    : [[], [], [], [], null, null];

  // Lote gravado sem o diagnóstico de gravação (antes de 18/09/2026) vira uma gravação.
  const comConfirm = tentativas.filter((t) => t.stage === "confirm" && t.ok && t.created > 0).map((t) => t.createdAt.getTime());
  const lotesSemDiagnostico = lotes.filter((l) => !comConfirm.some((c) => Math.abs(c - l.createdAt.getTime()) < 120_000));

  const via: DadosDaJornada["via"] = acesso?.source === "APPLE" || apple ? "apple" : acesso?.source === "HUBLA" ? "hubla" : "manual";
  const dados: DadosDaJornada = {
    comprouEm: apple?.createdAt ?? acesso?.createdAt ?? null,
    via,
    contaEm: usuario?.createdAt ?? null,
    usos: usos.map((u) => ({ nome: u.name, caminho: u.path, em: u.createdAt })),
    tentativas: [
      ...tentativas.map((t) => ({ ...t, em: t.createdAt })),
      ...lotesSemDiagnostico.map((l) => ({ stage: "confirm", ok: true, target: "extrato", kind: null, encoding: null, message: null, parsed: l._count.entries, created: l._count.entries, em: l.createdAt })),
    ].sort((a, b) => a.em.getTime() - b.em.getTime()),
    manuais: manuais.map((m) => m.createdAt),
    saiuEm,
    comoSaiu,
  };
  return {
    email: e,
    nome: usuario?.name ?? null,
    dados,
    diasDeUso: diasDeUso(dados.usos),
    instalado: usos.some((u) => u.standalone),
    motivo,
  };
}
