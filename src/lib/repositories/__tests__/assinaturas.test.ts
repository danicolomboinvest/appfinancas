import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";

/**
 * Assinatura posta à mão gravando de verdade (num banco de mentira): escolhendo dos lançamentos,
 * escrevendo, sem duplicar, a recusa guardada, e nunca outro perfil.
 */

type Conta = {
  id: string; userId: string; profileId: string; tipo: string | null; nome: string; valor: number | null; vencimento: Date; diaDoMes: number | null; repete: boolean; lembrar: boolean;
  chaveDoHistorico: string | null; editadaPelaPessoa: boolean; quitada: boolean; categoria: string | null; customCategoryId?: string | null; origem: string | null;
};
type Propria = { id: string; userId: string; profileId: string; name: string };
type Recusa = { userId: string; profileId: string; chave: string };
const banco = vi.hoisted(() => ({ contas: [] as Conta[], recusas: [] as Recusa[], proprias: [] as Propria[], lancamentos: new Map<string, LancamentoParaCacar[]>() }));
type Onde = Partial<Conta> & { userId: string; profileId: string; chave?: { startsWith: string } };
const casa = (w: Onde) => (c: Conta) =>
  (typeof w.chaveDoHistorico !== "object" || w.chaveDoHistorico === null || c.chaveDoHistorico !== null) &&
  c.userId === w.userId && c.profileId === w.profileId && (w.id === undefined || c.id === w.id) && (w.tipo === undefined || c.tipo === w.tipo) && (w.quitada === undefined || c.quitada === w.quitada) && (w.chaveDoHistorico === undefined || typeof w.chaveDoHistorico === "object" || c.chaveDoHistorico === w.chaveDoHistorico);

vi.mock("@/lib/auth/session", () => ({ doDono: (c: { userId: string; profileId: string }) => ({ userId: c.userId, profileId: c.profileId }) }));
vi.mock("@/lib/repositories/dinheiro-perdido.repo", () => ({ lancamentosParaCacar: vi.fn(async (ctx: { profileId: string }) => banco.lancamentos.get(ctx.profileId) ?? []) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    contaAPagar: {
      findMany: vi.fn(async ({ where }: { where: Onde }) => banco.contas.filter(casa(where))),
      findFirst: vi.fn(async ({ where }: { where: Onde }) => banco.contas.find(casa(where)) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<Conta> }) => {
        const c = { id: `c${banco.contas.length + 1}`, quitada: false, origem: null, chaveDoHistorico: null, categoria: null, diaDoMes: null, editadaPelaPessoa: false, tipo: null, ...data } as Conta;
        banco.contas.push(c);
        return c;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Onde; data: Partial<Conta> }) => {
        const alvo = banco.contas.filter(casa(where));
        alvo.forEach((c) => Object.assign(c, data));
        return { count: alvo.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Onde }) => {
        const antes = banco.contas.length;
        banco.contas = banco.contas.filter((c) => !casa(where)(c));
        return { count: antes - banco.contas.length };
      }),
    },
    contaRecusada: {
      findMany: vi.fn(async ({ where }: { where: Onde }) => banco.recusas.filter((r) => r.userId === where.userId && r.profileId === where.profileId && (!where.chave || r.chave.startsWith(where.chave.startsWith)))),
      createMany: vi.fn(async ({ data }: { data: Recusa[] }) => {
        for (const r of data) if (!banco.recusas.some((x) => x.userId === r.userId && x.profileId === r.profileId && x.chave === r.chave)) banco.recusas.push(r);
        return { count: data.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Omit<Recusa, "chave"> & { chave: { in: string[] } } }) => {
        const antes = banco.recusas.length;
        banco.recusas = banco.recusas.filter((r) => !(r.userId === where.userId && r.profileId === where.profileId && where.chave.in.includes(r.chave)));
        return { count: antes - banco.recusas.length };
      }),
    },
    transactionCategoryRule: { findMany: vi.fn(async () => []) },
    customCategory: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string; profileId: string } }) => banco.proprias.find((p) => p.id === where.id && p.userId === where.userId && p.profileId === where.profileId) ?? null),
    },
  },
}));

const repo = await import("../assinaturas.repo");
const { juntarAssinaturas } = await import("@/lib/contas/assinaturas");

const pessoal = { userId: "u1", profileId: "pessoal", profileKind: "PESSOAL" } as never;
const empresa = { userId: "u1", profileId: "empresa", profileKind: "EMPRESA" } as never;
const hoje = new Date(Date.UTC(2026, 9, 13));
let seq = 0;
const l = (descricao: string, valor: number, data: string): LancamentoParaCacar => ({ id: `l${++seq}`, descricao, valor, data, ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)), tipo: "EXPENSE", categoria: "OUTROS", subcategoria: null });

beforeEach(() => {
  banco.contas = [];
  banco.recusas = [];
  banco.proprias = [
    { id: "cc-bemestar", userId: "u1", profileId: "pessoal", name: "Bem-estar" },
    { id: "cc-ferramentas", userId: "u1", profileId: "empresa", name: "Ferramentas" },
  ];
  banco.lancamentos = new Map([
    ["pessoal", [l("PG *MANYCHAT", 850, "2026-08-28"), l("PG *MANYCHAT", 899, "2026-09-28"), l("NETFLIX.COM", 59.9, "2026-10-08"), l("Padaria", 12, "2026-10-02")]],
    ["empresa", [l("HOSTINGER BR", 45, "2026-10-03")]],
  ]);
});

describe("adicionar escolhendo dos lançamentos", () => {
  it("vira assinatura com o último valor, o dia da última cobrança e o comerciante aprendido", async () => {
    const r = await repo.adicionarDosLancamentos(pessoal, "manychat", hoje);
    expect(r?.nome).toBe("Manychat");
    expect(banco.contas[0]).toMatchObject({ tipo: "assinatura", valor: 899, diaDoMes: 28, repete: true, lembrar: false, chaveDoHistorico: "manychat", editadaPelaPessoa: true, profileId: "pessoal" });
    // Some da lista para escolher.
    expect((await repo.listarParaEscolher(pessoal, hoje)).map((c) => c.chave)).not.toContain("manychat");
  });

  it("tocar duas vezes não duplica", async () => {
    await repo.adicionarDosLancamentos(pessoal, "m:netflix", hoje);
    await repo.adicionarDosLancamentos(pessoal, "m:netflix", hoje);
    expect(banco.contas).toHaveLength(1);
  });

  it("a conta do histórico do mesmo comerciante muda para Assinaturas em vez de duplicar", async () => {
    banco.contas.push({ id: "h1", userId: "u1", profileId: "pessoal", tipo: null, nome: "Netflix", valor: 59.9, vencimento: hoje, diaDoMes: 8, repete: true, lembrar: true, chaveDoHistorico: "m:netflix", editadaPelaPessoa: false, quitada: false, categoria: null, origem: "historico" });
    await repo.adicionarDosLancamentos(pessoal, "m:netflix", hoje);
    expect(banco.contas).toHaveLength(1);
    expect(banco.contas[0]).toMatchObject({ tipo: "assinatura", lembrar: false, editadaPelaPessoa: true });
  });

  it("a lista para escolher não traz o que já é conta (o aluguel, a luz)", async () => {
    banco.contas.push({ id: "h1", userId: "u1", profileId: "pessoal", tipo: null, nome: "Netflix", valor: 59.9, vencimento: hoje, diaDoMes: 8, repete: true, lembrar: true, chaveDoHistorico: "m:netflix", editadaPelaPessoa: false, quitada: false, categoria: null, origem: "historico" });
    expect((await repo.listarParaEscolher(pessoal, hoje)).map((c) => c.chave)).not.toContain("m:netflix");
  });

  it("comerciante que não está nos lançamentos dela não vira nada", async () => {
    expect(await repo.adicionarDosLancamentos(pessoal, "hostinger", hoje)).toBeNull();
    expect(banco.contas).toHaveLength(0);
  });
});

describe("adicionar escrevendo", () => {
  it("nome, valor, dia e categoria; o comerciante sai do nome", async () => {
    await repo.escreverAssinatura(pessoal, { nome: "Netflix", valor: 55.9, dia: 8, categoria: "LAZER" }, hoje);
    expect(banco.contas[0]).toMatchObject({ tipo: "assinatura", nome: "Netflix", valor: 55.9, diaDoMes: 8, categoria: "LAZER", chaveDoHistorico: "m:netflix", lembrar: false });
    expect(banco.contas[0].vencimento.toISOString().slice(0, 10)).toBe("2026-10-08");
  });

  it("sem dia vence no fim do mês; o mesmo nome atualiza em vez de duplicar", async () => {
    await repo.escreverAssinatura(pessoal, { nome: "Academia", valor: 99, dia: null, categoria: null }, hoje);
    expect(banco.contas[0].vencimento.toISOString().slice(0, 10)).toBe("2026-10-31");
    await repo.escreverAssinatura(pessoal, { nome: "ACADEMIA", valor: 109, dia: 5, categoria: "SAUDE" }, hoje);
    expect(banco.contas).toHaveLength(1);
    expect(banco.contas[0]).toMatchObject({ valor: 109, diaDoMes: 5 });
  });

  it("com a categoria personalizada dela: grava a personalizada e a padrão fica nula", async () => {
    await repo.escreverAssinatura(pessoal, { nome: "Pilates", valor: 180, dia: 10, categoria: "SAUDE", customCategoryId: "cc-bemestar" }, hoje);
    expect(banco.contas[0]).toMatchObject({ tipo: "assinatura", nome: "Pilates", categoria: null, customCategoryId: "cc-bemestar" });
    expect((await repo.listarAssinaturasDela(pessoal))[0]).toMatchObject({ categoria: null, customCategoryId: "cc-bemestar" });
    // Trocar de volta para uma padrão zera a personalizada.
    await repo.escreverAssinatura(pessoal, { nome: "Pilates", valor: 180, dia: 10, categoria: "SAUDE", customCategoryId: null }, hoje, banco.contas[0].id);
    expect(banco.contas[0]).toMatchObject({ categoria: "SAUDE", customCategoryId: null });
  });

  it("a personalizada de outro perfil (ou que não existe mais) não entra: fica a padrão", async () => {
    await repo.escreverAssinatura(pessoal, { nome: "Notion", valor: 40, dia: 1, categoria: "OUTROS", customCategoryId: "cc-ferramentas" }, hoje);
    expect(banco.contas[0]).toMatchObject({ categoria: "OUTROS", customCategoryId: null });
    await repo.escreverAssinatura(pessoal, { nome: "Canva", valor: 50, dia: 1, categoria: null, customCategoryId: "cc-apagada" }, hoje);
    expect(banco.contas[1]).toMatchObject({ categoria: null, customCategoryId: null });
  });

  it("editar só mexe na assinatura do perfil", async () => {
    const { id } = (await repo.escreverAssinatura(pessoal, { nome: "Spotify", valor: 21.9, dia: 3, categoria: null }, hoje))!;
    expect(await repo.escreverAssinatura(empresa, { nome: "Spotify", valor: 1, dia: 3, categoria: null }, hoje, id)).toBeNull();
    expect(banco.contas.find((c) => c.id === id)?.valor).toBe(21.9);
  });
});

describe("não duplica com a detectada e 'Não é assinatura'", () => {
  it("a cadastrada vence a achada do mesmo comerciante", async () => {
    await repo.adicionarDosLancamentos(pessoal, "m:netflix", hoje);
    const dela = await repo.listarAssinaturasDela(pessoal);
    const r = juntarAssinaturas({ dela, achadas: [{ chave: "dp:x", nome: "Netflix", mensal: 55.9, comerciante: "m:netflix" }], contas: [], recusas: await repo.listarRecusasDeAssinatura(pessoal), lancamentosDoMes: [] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ origem: "sua", mensal: 59.9 });
  });

  it("'Não é assinatura' guarda a recusa e esconde para sempre (só neste perfil)", async () => {
    await repo.recusarAssinatura(pessoal, "Spotify");
    const achadas = [{ chave: "rx:spotify", nome: "Spotify", mensal: 21.9 }];
    expect(juntarAssinaturas({ dela: [], achadas, contas: [], recusas: await repo.listarRecusasDeAssinatura(pessoal), lancamentosDoMes: [] })).toEqual([]);
    expect(juntarAssinaturas({ dela: [], achadas, contas: [], recusas: await repo.listarRecusasDeAssinatura(empresa), lancamentosDoMes: [] })).toHaveLength(1);
  });

  it("Desfazer do 'Não é assinatura' traz ela de volta, só neste perfil", async () => {
    await repo.recusarAssinatura(pessoal, "Spotify");
    await repo.recusarAssinatura(empresa, "Spotify");
    await repo.desfazerRecusaDeAssinatura(pessoal, "Spotify");
    const achadas = [{ chave: "rx:spotify", nome: "Spotify", mensal: 21.9 }];
    expect(juntarAssinaturas({ dela: [], achadas, contas: [], recusas: await repo.listarRecusasDeAssinatura(pessoal), lancamentosDoMes: [] })).toHaveLength(1);
    expect(juntarAssinaturas({ dela: [], achadas, contas: [], recusas: await repo.listarRecusasDeAssinatura(empresa), lancamentosDoMes: [] })).toEqual([]);
  });

  it("remover a dela apaga e a achada igual não volta no lugar", async () => {
    const { id } = (await repo.escreverAssinatura(pessoal, { nome: "Spotify", valor: 21.9, dia: 3, categoria: null }, hoje))!;
    expect(await repo.removerAssinatura(empresa, id)).toBe(false);
    expect(await repo.removerAssinatura(pessoal, id)).toBe(true);
    expect(banco.contas).toHaveLength(0);
    const r = juntarAssinaturas({ dela: [], achadas: [{ chave: "rx:spotify", nome: "Spotify", mensal: 21.9 }], contas: [], recusas: await repo.listarRecusasDeAssinatura(pessoal), lancamentosDoMes: [] });
    expect(r).toEqual([]);
  });
});

describe("isolamento por perfil", () => {
  it("a Empresa escolhe dos lançamentos dela e não vê as assinaturas do Pessoal", async () => {
    await repo.adicionarDosLancamentos(pessoal, "manychat", hoje);
    expect(await repo.adicionarDosLancamentos(empresa, "manychat", hoje)).toBeNull();
    expect((await repo.listarParaEscolher(empresa, hoje)).map((c) => c.chave)).toEqual(["hostinger"]);
    await repo.adicionarDosLancamentos(empresa, "hostinger", hoje);
    expect((await repo.listarAssinaturasDela(empresa)).map((a) => a.nome)).toEqual(["Hostinger"]);
    expect((await repo.listarAssinaturasDela(pessoal)).map((a) => a.nome)).toEqual(["Manychat"]);
  });
});
