import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Evento } from "../regra";

/**
 * O cron do lembrete de cancelar (dentro do cron das contas, 8h de Brasília): quem recebe, quando
 * e por qual canal. Banco, push e e-mail de mentira; nada sai de verdade.
 */

type Pessoa = { id: string; email: string; name: string; role: string; currency: string; createdAt: Date; push: boolean };
const banco = vi.hoisted(() => ({
  pessoas: [] as Pessoa[],
  lembretes: [] as { id: string; userId: string; profileId: string; descricao: string; dados: unknown; createdAt: Date }[],
  entradas: [] as { userId: string; profileId: string; description: string; amount: number; entryDate: Date; year: number; month: number; createdAt: Date; importBatchId: string | null; externalId: string | null }[],
  log: [] as { userId: string; key: string }[],
  eventos: new Map<string, Evento[]>(),
  pushes: [] as { userId: string; title: string; body: string; url?: string }[],
  emails: [] as { to: string; subject: string; html: string }[],
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    decisao: {
      findMany: vi.fn(async ({ where, distinct }: { where: Record<string, unknown>; distinct?: string[] }) => {
        if (distinct) {
          const vistos = new Set<string>();
          const user = where.user as { email?: string };
          return banco.lembretes
            .filter((l) => l.descricao === "ligar")
            .map((l) => ({ l, p: banco.pessoas.find((p) => p.id === l.userId)! }))
            .filter(({ p }) => !user.email || p.email === user.email)
            .filter(({ l }) => (vistos.has(`${l.userId}|${l.profileId}`) ? false : (vistos.add(`${l.userId}|${l.profileId}`), true)))
            .map(({ l, p }) => ({ userId: l.userId, profileId: l.profileId, user: p, profile: { theme: "padrao" } }));
        }
        if (where.tipo === "assinatura_lembrete") return banco.lembretes.filter((l) => l.userId === where.userId && l.profileId === where.profileId);
        return [];
      }),
    },
    monthlyEntry: { findMany: vi.fn(async ({ where }: { where: { userId: string; profileId: string } }) => banco.entradas.filter((e) => e.userId === where.userId && e.profileId === where.profileId)) },
    notificationLog: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; key: { in: string[] } } }) => banco.log.filter((l) => l.userId === where.userId && where.key.in.includes(l.key))),
      createMany: vi.fn(async ({ data }: { data: { userId: string; key: string }[] }) => {
        banco.log.push(...data);
        return { count: data.length };
      }),
    },
  },
}));
vi.mock("../respostas", () => ({
  carregarRespostasDeAssinatura: vi.fn(async (q: { userId: string }) => ({ eventos: banco.eventos.get(q.userId) ?? [], daCasa: new Set() })),
  itensDoRaioX: vi.fn(async () => []),
}));
vi.mock("@/lib/repositories/casa.repo", () => ({ casaDoUsuario: vi.fn(async () => null) }));
vi.mock("@/lib/repositories/allowedEmail.repo", () => ({
  contasQueUsamOApp: vi.fn(async (l: { email: string }[]) => new Set(l.map((x) => x.email))),
  normalizeEmail: (e: string) => e,
}));
vi.mock("@/lib/push/send", () => ({
  isPushConfigured: () => true,
  sendPushToUser: vi.fn(async (userId: string, p: { title: string; body: string; url?: string }) => {
    if (!banco.pessoas.find((x) => x.id === userId)?.push) return 0;
    // O dinheiro formatado vem com espaço fino (nbsp): aqui vira espaço comum.
    banco.pushes.push({ userId, ...p, title: p.title.replace(/\u00a0/g, " ") });
    return 1;
  }),
}));
vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async (m: { to: string; subject: string; html: string }) => {
    banco.emails.push({ ...m, subject: m.subject.replace(/\u00a0/g, " ") });
    return { ok: true };
  }),
}));

import { enviarLembretesDeAssinatura } from "../lembretes-envio";

const NETFLIX = ["c:m:netflix", "n:netflix", "r:netflix"];
const dia = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d));
const pessoa = (id: string, push: boolean): Pessoa => ({ id, email: `${id}@exemplo.test`, name: id, role: "USER", currency: "BRL", createdAt: new Date(), push });
let seq = 0;
const evento = (userId: string, resposta: Evento["resposta"], em: Date): Evento => ({ id: `e${seq++}`, marcas: NETFLIX, resposta, em, minha: true, daCasa: false, registro: true });
const ligar = (userId: string, em: Date, diaDaCobranca: number | null = 12) =>
  banco.lembretes.push({ id: `l${seq++}`, userId, profileId: `p-${userId}`, descricao: "ligar", dados: { marcas: NETFLIX, em: em.toISOString(), dia: diaDaCobranca, valor: 55.9, nome: "Netflix", raiox: "netflix" }, createdAt: em });
const rodar = (hoje: Date, extra: { dryRun?: boolean; onlyEmail?: string } = {}) => enviarLembretesDeAssinatura({ hoje, baseUrl: "http://localhost", ...extra });

beforeEach(() => {
  banco.pessoas = [pessoa("ana", true), pessoa("bia", false), pessoa("clara", true), pessoa("caio", true)];
  banco.lembretes = [];
  banco.entradas = [];
  banco.log = [];
  banco.pushes = [];
  banco.emails = [];
  banco.eventos = new Map();
  // Ana (push) e Bia (sem push) marcaram a Netflix para cancelar e pediram o lembrete.
  for (const id of ["ana", "bia"]) {
    banco.eventos.set(id, [evento(id, "raiox_cancelar", new Date(Date.UTC(2026, 9, 5, 12)))]);
    ligar(id, new Date(Date.UTC(2026, 9, 5, 13)));
  }
  // Clara pediu, mas depois disse "Cancelei mesmo".
  banco.eventos.set("clara", [evento("clara", "raiox_cancelar", new Date(Date.UTC(2026, 9, 5, 12))), evento("clara", "raiox_cancelei", new Date(Date.UTC(2026, 9, 8, 12)))]);
  ligar("clara", new Date(Date.UTC(2026, 9, 5, 13)));
  // Caio (o outro da casa da Bia) marcou a mesma Netflix para cancelar, mas não pediu lembrete.
  banco.eventos.set("caio", [evento("caio", "raiox_cancelar", new Date(Date.UTC(2026, 9, 5, 12)))]);
});

describe("o cron do lembrete de cancelar", () => {
  it("na véspera: push para quem tem, e-mail para quem não tem; quem cancelou e quem não pediu não recebem", async () => {
    const r = await rodar(dia(10, 11));
    expect(r).toMatchObject({ pessoas: 2, pushed: 1, mailed: 1 });
    expect(banco.pushes).toEqual([{ userId: "ana", title: "Netflix cobra R$ 55,90 amanhã", body: "Se for cancelar, é hoje.", url: "/decidir/raio-x", tag: "assinatura|c:m:netflix|2026-10-12" }]);
    expect(banco.emails.map((e) => e.to)).toEqual(["bia@exemplo.test"]);
    expect(banco.emails[0].subject).toContain("Netflix cobra R$ 55,90 amanhã");
    expect(banco.emails[0].html).toContain("/decidir/raio-x");
  });

  it("a trava: no mesmo dia e no dia da cobrança não sai de novo; no mês seguinte, sim", async () => {
    await rodar(dia(10, 11));
    await rodar(dia(10, 11));
    await rodar(dia(10, 12));
    expect(banco.pushes).toHaveLength(1);
    expect(banco.emails).toHaveLength(1);
    await rodar(dia(11, 11));
    expect(banco.pushes).toHaveLength(2);
  });

  it("ligou no dia da cobrança: sai no dia", async () => {
    banco.lembretes = [];
    ligar("ana", new Date(Date.UTC(2026, 9, 12, 9)));
    await rodar(dia(10, 12));
    expect(banco.pushes.map((p) => p.title)).toEqual(["Netflix cobra R$ 55,90 hoje"]);
  });

  it("fora da véspera e do dia, nada; sem dia, nada", async () => {
    expect((await rodar(dia(10, 9))).pessoas).toBe(0);
    banco.lembretes = [];
    ligar("ana", new Date(Date.UTC(2026, 9, 5, 13)), null);
    expect((await rodar(dia(10, 11))).pessoas).toBe(0);
  });

  it("desligado (Desfazer) para", async () => {
    banco.lembretes.push({ id: `l${seq++}`, userId: "ana", profileId: "p-ana", descricao: "desligar", dados: { marcas: NETFLIX, em: new Date(Date.UTC(2026, 9, 6)).toISOString(), dia: null }, createdAt: new Date(Date.UTC(2026, 9, 6)) });
    await rodar(dia(10, 11));
    expect(banco.pushes).toHaveLength(0);
    expect(banco.emails.map((e) => e.to)).toEqual(["bia@exemplo.test"]);
  });

  it("a cobrança não veio: pergunta Cancelou? uma vez", async () => {
    // O extrato da Ana chegou até o dia 14 e a Netflix não apareceu em outubro.
    banco.entradas.push({ userId: "ana", profileId: "p-ana", description: "Mercado", amount: 80, entryDate: dia(10, 14), year: 2026, month: 10, createdAt: dia(10, 14), importBatchId: "b1", externalId: null });
    await rodar(dia(10, 15));
    await rodar(dia(10, 16));
    expect(banco.pushes.map((p) => `${p.title}. ${p.body}`)).toEqual(["Netflix não cobrou este mês. Cancelou? Confirme no Raio-X."]);
  });

  it("dryRun mostra e não manda nada nem trava", async () => {
    const r = await rodar(dia(10, 11), { dryRun: true });
    expect(r.preview.map((p) => p.email).sort()).toEqual(["ana@exemplo.test", "bia@exemplo.test"]);
    expect(banco.pushes).toHaveLength(0);
    expect(banco.emails).toHaveLength(0);
    expect(banco.log).toHaveLength(0);
  });
});
