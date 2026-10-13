import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * O convite do par contra um banco de mentira, com as mesmas travas do banco de verdade: o código
 * só existe como hash, o aceite só passa se o convite ainda estiver aberto e no prazo naquele
 * instante (updateMany condicional), e os índices parciais da migration (um par ativo por perfil,
 * um Nós dois ativo por pessoa, um convite aberto por perfil) viram erro P2002 aqui também.
 */

type Convite = { id: string; profileId: string; userId: string; nomePar: string; letra: string; tokenHash: string; status: string; expiraEm: Date; aceitoEm: Date | null; aceitoPorId: string | null; canal: string | null; enviadoEm: Date | null; createdAt: Date; encerradoEm: Date | null };
type Membro = { id: string; profileId: string; userId: string; letra: string; saiuEm: Date | null; emUso: boolean; entrouEm: Date; bloqueadoEm: Date | null; termosVersao: string; termosAceitosEm: Date; motivoSaida?: string | null };
type Usuario = { id: string; email: string; name: string | null; role: string; onboardedAt: Date | null; passwordHash: string };

const db = vi.hoisted(() => ({
  convites: [] as Convite[],
  membros: [] as Membro[],
  usuarios: [] as Usuario[],
  perfis: [] as { id: string; userId: string; kind: string; casal: unknown; theme: string; isDefault?: boolean }[],
  seq: 0,
  limiteEstourado: false,
  acesso: "ativo" as string,
}));

vi.mock("@/lib/auth/limite-de-envio", () => ({ reservarEnvio: async () => !db.limiteEstourado }));
vi.mock("@/lib/repositories/allowedEmail.repo", () => ({
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
  situacaoDoAcesso: async () => db.acesso,
}));

vi.mock("@/lib/db/prisma", async () => {
  const { Prisma } = await import("@prisma/client");
  const unico = (alvo: string) => new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x", meta: { target: alvo } });
  const id = () => `id${++db.seq}`;
  const casa = (o: Record<string, unknown>, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const c = v as { gt?: Date; lt?: Date; equals?: string; mode?: string };
        if (c.gt) return (o[k] as Date).getTime() > c.gt.getTime();
        if (c.lt) return (o[k] as Date).getTime() < c.lt.getTime();
        if (c.equals !== undefined) return String(o[k]).toLowerCase() === c.equals.toLowerCase();
      }
      return o[k] === v;
    });
  const perfilDe = (profileId: string) => {
    const p = db.perfis.find((x) => x.id === profileId)!;
    const u = db.usuarios.find((x) => x.id === p.userId)!;
    return { ...p, user: { name: u.name, email: u.email } };
  };
  const conviteCasal = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      const c = db.convites.find((x) => x.tokenHash === where.tokenHash);
      return c ? { ...c, profile: perfilDe(c.profileId) } : null;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => db.convites.filter((c) => casa(c, where)).at(-1) ?? null,
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Convite> }) => {
      const alvo = db.convites.filter((c) => casa(c, where));
      alvo.forEach((c) => Object.assign(c, data));
      return { count: alvo.length };
    },
    create: async ({ data }: { data: Omit<Convite, "id" | "status" | "aceitoEm" | "aceitoPorId" | "canal" | "enviadoEm" | "encerradoEm"> }) => {
      if (db.convites.some((c) => c.profileId === data.profileId && c.status === "aberto")) throw unico("ConviteCasal_um_aberto_por_perfil");
      const c: Convite = { status: "aberto", aceitoEm: null, aceitoPorId: null, canal: null, enviadoEm: null, encerradoEm: null, ...data, id: id() };
      db.convites.push(c);
      return c;
    },
  };
  const membroCasal = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => db.membros.find((m) => casa(m, where)) ?? null,
    create: async ({ data }: { data: Omit<Membro, "id" | "saiuEm" | "emUso" | "bloqueadoEm"> }) => {
      if (db.membros.some((m) => m.profileId === data.profileId && !m.saiuEm)) throw unico("MembroCasal_um_par_ativo_por_perfil");
      if (db.membros.some((m) => m.userId === data.userId && !m.saiuEm)) throw unico("MembroCasal_um_casal_ativo_por_pessoa_userId");
      const m: Membro = { saiuEm: null, emUso: true, bloqueadoEm: null, ...data, id: id() };
      db.membros.push(m);
      return m;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Membro> }) => {
      const alvo = db.membros.filter((m) => casa(m, where));
      alvo.forEach((m) => Object.assign(m, data));
      return { count: alvo.length };
    },
  };
  const user = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const u = db.usuarios.find((x) => x.id === where.id);
      return u ? { ...u, membrosCasal: db.membros.filter((m) => m.userId === u.id && !m.saiuEm).map((m) => ({ profileId: m.profileId })) } : null;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => db.usuarios.find((u) => casa(u, where)) ?? null,
    create: async ({ data }: { data: Omit<Usuario, "id" | "role"> }) => {
      const u: Usuario = { role: "CLIENT", ...data, id: id() };
      db.usuarios.push(u);
      return u;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Usuario> }) => {
      const alvo = db.usuarios.filter((u) => casa(u, where));
      alvo.forEach((u) => Object.assign(u, data));
      return { count: alvo.length };
    },
  };
  const financialProfile = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      db.perfis.find((p) => Object.entries(where).every(([k, v]) => (p as Record<string, unknown>)[k] === v || (k === "isDefault" && v === false && !(p as Record<string, unknown>)[k]))) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const p = { id: `perfil${++db.seq}`, casal: null, theme: "padrao", ...data } as (typeof db.perfis)[number];
      db.perfis.push(p);
      return { id: p.id };
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const alvo = db.perfis.filter((p) => Object.entries(where).every(([k, v]) => (p as Record<string, unknown>)[k] === v));
      alvo.forEach((p) => Object.assign(p, data));
      return { count: alvo.length };
    },
    findUnique: async ({ where }: { where: { id: string } }) => perfilDe(where.id),
    update: async ({ where, data }: { where: { id: string }; data: { casal: unknown } }) => Object.assign(db.perfis.find((p) => p.id === where.id)!, data),
  };
  const tx = { conviteCasal, membroCasal, user, financialProfile };
  // Transação de mentira com volta atrás: se der erro no meio, nada do que ela fez fica.
  const $transaction = async (arg: unknown) => {
    const copia = JSON.parse(JSON.stringify({ c: db.convites, m: db.membros, u: db.usuarios }), (k, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
    try {
      if (typeof arg === "function") return await (arg as (t: typeof tx) => Promise<unknown>)(tx);
      return await Promise.all(arg as Promise<unknown>[]);
    } catch (e) {
      db.convites = copia.c;
      db.membros = copia.m;
      db.usuarios = copia.u;
      throw e;
    }
  };
  return { prisma: { ...tx, $transaction } };
});

import { aceitarConvite, cancelarConvite, criarConvite, lerConviteParaTela, removerPar } from "../casal-login.repo";
import { hashDoToken } from "@/lib/casal-login/token";

const AGORA = new Date("2026-10-11T17:00:00Z");
const ANA_CTX: AuthContext = { userId: "ana", role: "CLIENT", profileId: "casal", profileTheme: "girly", profileKind: "CASAL" };

beforeEach(() => {
  db.convites = [];
  db.membros = [];
  db.seq = 0;
  db.limiteEstourado = false;
  db.acesso = "ativo";
  db.usuarios = [
    { id: "ana", email: "ana@exemplo.test", name: "Ana Souza", role: "CLIENT", onboardedAt: AGORA, passwordHash: "x" },
    { id: "beto", email: "beto@exemplo.test", name: "Beto", role: "CLIENT", onboardedAt: null, passwordHash: "x" },
  ];
  db.perfis = [
    { id: "casal", userId: "ana", kind: "CASAL", casal: { nomeA: "Ana", nomeB: "Pessoa 2", divisao: "renda", acertos: [] }, theme: "girly" },
    { id: "pessoal", userId: "ana", kind: "PESSOAL", casal: null, theme: "padrao" },
  ];
});

const lucas = { nome: "Lucas", email: "Lucas@Exemplo.test", senha: "senha-forte-1" };

describe("criar, mandar de novo e cancelar", () => {
  it("o banco guarda só o hash; o link sai uma vez", async () => {
    const { token, expiraEm } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    expect(db.convites).toHaveLength(1);
    expect(db.convites[0].tokenHash).toBe(hashDoToken(token));
    expect(JSON.stringify(db.convites)).not.toContain(token);
    expect(expiraEm.getTime() - AGORA.getTime()).toBe(7 * 86_400_000);
  });

  it("'Mandar de novo' mata o link anterior: ele passa a mostrar 'trocado'", async () => {
    const primeiro = await criarConvite(ANA_CTX, "Lucas", AGORA);
    const segundo = await criarConvite(ANA_CTX, "Lucas", AGORA);
    expect((await lerConviteParaTela(primeiro.token, null, AGORA)).tela).toBe("substituido");
    expect((await lerConviteParaTela(segundo.token, null, AGORA)).tela).toBe("entrar");
    expect(db.convites.filter((c) => c.status === "aberto")).toHaveLength(1);
  });

  it("cancelar fecha o link com a tela própria", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    await cancelarConvite(ANA_CTX, AGORA);
    expect((await lerConviteParaTela(token, null, AGORA)).tela).toBe("cancelado");
    expect((await aceitarConvite({ token, novaConta: lucas }, AGORA)).ok).toBe(false);
  });

  it("limite de envios estourado: não cria", async () => {
    db.limiteEstourado = true;
    await expect(criarConvite(ANA_CTX, "Lucas", AGORA)).rejects.toThrow(/Muitos convites/);
    expect(db.convites).toHaveLength(0);
  });

  it("o par não convida, e fora do perfil Casal não há convite", async () => {
    await expect(criarConvite({ ...ANA_CTX, par: { membroId: "m", letra: "B", donoId: "ana", nomeTitular: "Ana", mostrarRenda: false, bloqueadoEm: null } }, "X", AGORA)).rejects.toThrow();
    await expect(criarConvite({ ...ANA_CTX, profileKind: "PESSOAL", profileId: "pessoal" }, "X", AGORA)).rejects.toThrow();
  });

  it("Casal da titular parado: não convida, e o link mostra 'pausado'", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    db.acesso = "vencido";
    await expect(criarConvite(ANA_CTX, "Lucas", AGORA)).rejects.toThrow(/Libere o Casal/);
    expect((await lerConviteParaTela(token, null, AGORA)).tela).toBe("casal-inativo");
  });
});

describe("aceitar: uso único, prazo e cada caso de borda", () => {
  it("cria o login do par sem perfil próprio, já fora do começo, e liga ao Nós dois", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    const r = await aceitarConvite({ token, novaConta: lucas }, AGORA);
    expect(r.ok).toBe(true);
    const u = db.usuarios.find((x) => x.email === "lucas@exemplo.test")!;
    expect(u.onboardedAt).toEqual(AGORA);
    expect(db.membros).toEqual([expect.objectContaining({ profileId: "casal", userId: u.id, letra: "B", termosVersao: expect.any(String) })]);
    expect(db.convites[0]).toMatchObject({ status: "aceito", aceitoPorId: u.id });
    // O nome de fábrica "Pessoa 2" vira o nome do convite.
    expect((db.perfis[0].casal as { nomeB: string }).nomeB).toBe("Lucas");
  });

  it("o convite novo já nasce no Casal simples: Pessoal do par criado e o da titular ligado", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    expect((await aceitarConvite({ token, novaConta: lucas }, AGORA)).ok).toBe(true);
    const u = db.usuarios.find((x) => x.email === "lucas@exemplo.test")!;
    const pessoalDoLucas = db.perfis.find((p) => p.userId === u.id && p.kind === "PESSOAL");
    const pessoalDaAna = db.perfis.find((p) => p.userId === "ana" && p.kind === "PESSOAL");
    expect(pessoalDoLucas?.isDefault).toBe(true);
    expect(db.membros[0]).toMatchObject({ modelo: "simples", perfilParId: pessoalDoLucas!.id, perfilTitularId: pessoalDaAna!.id });
  });

  it("o mesmo link não entra duas vezes", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    expect((await aceitarConvite({ token, novaConta: lucas }, AGORA)).ok).toBe(true);
    const segunda = await aceitarConvite({ token, novaConta: { ...lucas, email: "outro@x.test" } }, AGORA);
    expect(segunda).toEqual({ ok: false, tela: "usado" });
    expect(db.usuarios.some((u) => u.email === "outro@x.test")).toBe(false);
  });

  it("dois aceites ao mesmo tempo: um vence, o outro não deixa conta solta", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    const [a, b] = await Promise.all([aceitarConvite({ token, novaConta: lucas }, AGORA), aceitarConvite({ token, userId: "beto" }, AGORA)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(db.membros).toHaveLength(1);
    if (!a.ok) expect(db.usuarios.some((u) => u.email === "lucas@exemplo.test")).toBe(false);
  });

  it("vencido: não aceita, nem cria conta", async () => {
    const { token } = await criarConvite(ANA_CTX, "Lucas", AGORA);
    const depois = new Date(AGORA.getTime() + 7 * 86_400_000);
    expect(await aceitarConvite({ token, novaConta: lucas }, depois)).toEqual({ ok: false, tela: "vencido" });
    expect(db.usuarios).toHaveLength(2);
  });

  it("código errado ou mexido: inválido", async () => {
    expect(await aceitarConvite({ token: "a".repeat(43), novaConta: lucas }, AGORA)).toEqual({ ok: false, tela: "invalido" });
    expect(await aceitarConvite({ token: "curto", novaConta: lucas }, AGORA)).toEqual({ ok: false, tela: "invalido" });
  });

  it("e-mail que já tem conta: pede para entrar com ela", async () => {
    const { token } = await criarConvite(ANA_CTX, "Beto", AGORA);
    expect(await aceitarConvite({ token, novaConta: { nome: "Beto", email: "BETO@exemplo.test", senha: "12345678" } }, AGORA)).toEqual({ ok: false, tela: "email-em-uso" });
    expect(db.convites[0].status).toBe("aberto");
  });

  it("logada com outra conta: entra com ela; a titular não aceita o próprio convite", async () => {
    const { token } = await criarConvite(ANA_CTX, "Beto", AGORA);
    expect(await aceitarConvite({ token, userId: "ana" }, AGORA)).toEqual({ ok: false, tela: "e-a-titular" });
    expect((await lerConviteParaTela(token, "beto", AGORA)).tela).toBe("aceitar-logado");
    expect((await aceitarConvite({ token, userId: "beto" }, AGORA)).ok).toBe(true);
    // Quem já tinha conta e nunca passou pelo começo cai direto no Nós dois.
    expect(db.usuarios.find((u) => u.id === "beto")!.onboardedAt).toEqual(AGORA);
  });

  it("um par por vez: com o par dentro, outro link mostra 'já tem par'", async () => {
    const { token } = await criarConvite(ANA_CTX, "Beto", AGORA);
    await aceitarConvite({ token, userId: "beto" }, AGORA);
    await expect(criarConvite(ANA_CTX, "Outro", AGORA)).rejects.toThrow(/já tem um par/);
  });

  it("removido pela titular: sai na hora, e ela pode chamar outro", async () => {
    const { token } = await criarConvite(ANA_CTX, "Beto", AGORA);
    await aceitarConvite({ token, userId: "beto" }, AGORA);
    expect(await removerPar(ANA_CTX, AGORA)).toBe(1);
    expect(db.membros[0]).toMatchObject({ saiuEm: AGORA, motivoSaida: "removido" });
    const novo = await criarConvite(ANA_CTX, "Lucas", AGORA);
    expect((await lerConviteParaTela(novo.token, null, AGORA)).tela).toBe("entrar");
  });

  it("quem já entrou e abre o link de novo vai direto pro Nós dois", async () => {
    const { token } = await criarConvite(ANA_CTX, "Beto", AGORA);
    await aceitarConvite({ token, userId: "beto" }, AGORA);
    expect((await lerConviteParaTela(token, "beto", AGORA)).tela).toBe("ja-esta-aqui");
  });
});
