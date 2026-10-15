import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";
import type { CasaNaSessao } from "@/lib/casa/regras";

/**
 * "Responde aqui, vale lá" (15/10/2026): para cada par das três telas que mostram assinatura
 * (Raio-X do Decidir, Assinaturas de Recorrentes, Dinheiro perdido), uma resposta numa delas muda
 * as outras duas, e o Desfazer volta todas ao estado de antes. Num banco de mentira, com as mesmas
 * funções que as telas usam para montar a lista (raioXComARegraUnica, carregarDinheiroPerdido,
 * juntarAssinaturas + assinaturasComARegraUnica) e as mesmas ações dos botões.
 */

type Linha = Record<string, unknown> & { id: string; userId: string; profileId: string | null; createdAt: Date };
type Entrada = { userId: string; profileId: string; year: number; month: number; description: string; amount: number; category: "EXPENSE"; parentCategory: string; subcategory: string | null; doCasal: boolean | null; soMeu: boolean; entryDate: Date };
const banco = vi.hoisted(() => ({
  decisoes: [] as Linha[],
  achados: [] as Linha[],
  recusas: [] as Linha[],
  contas: [] as Linha[],
  entradas: [] as Entrada[],
  regrasDaCasa: [] as { userId: string; profileId: string; pattern: string; daCasa: boolean }[],
  seq: 0,
  sessao: null as unknown,
}));
const novoId = () => `x${String(++banco.seq).padStart(6, "0")}`;
// O relógio do banco de mentira: cada gravação um minuto depois da anterior.
const agoraDoBanco = () => new Date(Date.UTC(2026, 9, 15, 12, 0) + banco.seq * 60_000);

/** O `where` do Prisma, no pedaço que estas consultas usam. */
function casa(where: Record<string, unknown> | undefined, l: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => casa(w, l));
    if (k === "AND") return (v as Record<string, unknown>[]).every((w) => casa(w, l));
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Record<string, unknown>;
      if ("in" in o) return (o.in as unknown[]).includes(l[k]);
      if ("startsWith" in o) return typeof l[k] === "string" && (l[k] as string).startsWith(o.startsWith as string);
      if ("endsWith" in o) return typeof l[k] === "string" && (l[k] as string).endsWith(o.endsWith as string);
      if ("not" in o) return l[k] !== o.not;
      return true;
    }
    return l[k] === v;
  });
}
const tabela = (nome: "decisoes" | "achados" | "recusas" | "contas") => ({
  findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => banco[nome].filter((l) => casa(where, l)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))),
  findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => banco[nome].find((l) => casa(where, l)) ?? null),
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const l = { id: novoId(), createdAt: agoraDoBanco(), ...data } as Linha;
    banco[nome].push(l);
    return l;
  }),
  createMany: vi.fn(async ({ data, skipDuplicates }: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => {
    for (const d of data) {
      if (skipDuplicates && banco[nome].some((l) => l.userId === d.userId && l.profileId === d.profileId && l.chave === d.chave)) continue;
      banco[nome].push({ id: novoId(), createdAt: agoraDoBanco(), ...d } as Linha);
    }
    return { count: data.length };
  }),
  deleteMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
    const antes = banco[nome].length;
    banco[nome] = banco[nome].filter((l) => !casa(where, l));
    return { count: antes - banco[nome].length };
  }),
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 9, 15, 9, 0) }));
vi.mock("@/lib/auth/session", () => ({
  getRequiredSession: vi.fn(async () => banco.sessao),
  doDono: (c: { userId: string; profileId: string }) => ({ userId: c.userId, profileId: c.profileId }),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    decisao: tabela("decisoes"),
    achadoDinheiroPerdido: tabela("achados"),
    contaRecusada: tabela("recusas"),
    contaAPagar: tabela("contas"),
    monthlyEntry: { findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => banco.entradas.filter((e) => e.userId === where.userId && e.profileId === where.profileId)) },
    regraDaCasa: { findMany: vi.fn(async ({ where }: { where: { userId: string; profileId: string } }) => banco.regrasDaCasa.filter((r) => r.userId === where.userId && r.profileId === where.profileId)) },
  },
}));
vi.mock("@/lib/repositories/decisao.repo", () => ({
  registrarDecisaoUnica: vi.fn(async (ctx: { userId: string; profileId: string }, d: { tipo: string; chave: string; valor?: number; descricao?: string }, tipos: string[] = [d.tipo]) => {
    banco.decisoes = banco.decisoes.filter((l) => !(l.userId === ctx.userId && l.profileId === ctx.profileId && l.chave === d.chave && tipos.includes(l.tipo as string)));
    const l = { id: novoId(), createdAt: agoraDoBanco(), userId: ctx.userId, profileId: ctx.profileId, tipo: d.tipo, chave: d.chave, valor: d.valor ?? null, descricao: d.descricao ?? null, dados: null };
    banco.decisoes.push(l);
    return l;
  }),
}));
vi.mock("@/lib/repositories/monthly-entry.repo", () => ({
  listEntriesForMonths: vi.fn(async (ctx: { userId: string; profileId: string }, meses: { year: number; month: number }[]) =>
    banco.entradas.filter((e) => e.userId === ctx.userId && e.profileId === ctx.profileId && meses.some((m) => m.year === e.year && m.month === e.month)),
  ),
}));
vi.mock("@/lib/repositories/assinaturas.repo", () => ({
  listarAssinaturasDela: vi.fn(async (ctx: { userId: string; profileId: string }) =>
    banco.contas.filter((c) => c.userId === ctx.userId && c.profileId === ctx.profileId && c.tipo === "assinatura").map((c) => ({ id: c.id, nome: c.nome as string, valor: c.valor as number, diaDoMes: null, chaveDoHistorico: (c.chaveDoHistorico as string) ?? null, categoria: null })),
  ),
  adicionarDosLancamentos: vi.fn(),
  escreverAssinatura: vi.fn(),
  listarParaEscolher: vi.fn(),
  removerAssinatura: vi.fn(async (ctx: { userId: string; profileId: string }, id: string) => {
    banco.contas = banco.contas.filter((c) => !(c.id === id && c.userId === ctx.userId));
    return true;
  }),
  sugerirCategoria: vi.fn(),
}));
vi.mock("@/lib/repositories/dinheiro-perdido.repo", () => {
  const lancamentos = async (ctx: { userId: string; profileId: string }): Promise<LancamentoParaCacar[]> =>
    banco.entradas
      .filter((e) => e.userId === ctx.userId && e.profileId === ctx.profileId)
      .map((e, i) => ({ id: `l${i}`, descricao: e.description, valor: e.amount, data: e.entryDate.toISOString().slice(0, 10), ano: e.year, mes: e.month, tipo: "EXPENSE", categoria: e.parentCategory, subcategoria: e.subcategory }));
  const guardados = async (ctx: { userId: string; profileId: string }) =>
    banco.achados
      .filter((a) => a.userId === ctx.userId && a.profileId === ctx.profileId)
      .map((a) => ({ chave: a.chave, tipo: a.tipo, nome: a.nome, mensal: a.mensal ?? null, unico: null, dados: a.dados ?? null, estado: a.estado, decididoEm: a.decididoEm ?? null, estornoEm: null, vistoEm: null, createdAt: a.createdAt }));
  return {
    lancamentosParaCacar: vi.fn(lancamentos),
    chavesDasAssinaturasDela: vi.fn(async () => new Set<string>()),
    listarAchadosGuardados: vi.fn(guardados),
    marcarAchadosVistos: vi.fn(),
    decidirAchado: vi.fn(async (ctx: { userId: string; profileId: string }, chave: string, estado: string, achado: { tipo: string; nome: string; mensal: number | null; comerciante: string; descricaoDoLogo: string } | null) => {
      const g = banco.achados.find((a) => a.userId === ctx.userId && a.profileId === ctx.profileId && a.chave === chave);
      const decididoEm = estado === "aberto" ? null : agoraDoBanco();
      if (g) Object.assign(g, { estado, decididoEm });
      else if (achado) banco.achados.push({ id: novoId(), createdAt: agoraDoBanco(), userId: ctx.userId, profileId: ctx.profileId, chave, tipo: achado.tipo, nome: achado.nome, mensal: achado.mensal, dados: { comerciante: achado.comerciante, descricaoDoLogo: achado.descricaoDoLogo }, estado, decididoEm });
      else return false;
      return true;
    }),
  };
});

const { carregarRespostasDeAssinatura, desfazerAssinatura, estadoPara, itensDoRaioX, responderAssinatura } = await import("../respostas");
const { assinaturasComARegraUnica, raioXComARegraUnica, marcasDoAchado } = await import("../regra");
const { juntarAssinaturas, chaveDoComercianteDe } = await import("@/lib/contas/assinaturas");
const { carregarDinheiroPerdido } = await import("@/app/(app)/orcamento/contas/perdido/dados");
const perdidoActions = await import("@/app/(app)/orcamento/contas/perdido/actions");
const recorrentesActions = await import("@/app/(app)/orcamento/contas/assinaturas-actions");

type Ctx = { userId: string; profileId: string; profileKind: "PESSOAL"; profileTheme: string; casa?: CasaNaSessao | null };
const ANA: Ctx = { userId: "u-ana", profileId: "p-ana", profileKind: "PESSOAL", profileTheme: "padrao" };
const CAIO: Ctx = { userId: "u-caio", profileId: "p-caio", profileKind: "PESSOAL", profileTheme: "padrao" };

/** As assinaturas de sempre da Ana: maio a outubro, todo dia 1. */
function semear(ctx: Ctx, servicos: [string, number][] = [["Netflix", 55.9], ["Spotify", 21.9]], daCasa: boolean | null = null) {
  for (let mes = 5; mes <= 10; mes++)
    for (const [description, amount] of servicos)
      banco.entradas.push({ userId: ctx.userId, profileId: ctx.profileId, year: 2026, month: mes, description, amount, category: "EXPENSE", parentCategory: "LAZER", subcategory: "Streaming", doCasal: daCasa, soMeu: false, entryDate: new Date(Date.UTC(2026, mes - 1, 1)) });
}

/** As três telas, montadas como as páginas montam. */
async function telas(ctx: Ctx = ANA) {
  banco.sessao = ctx;
  const respostas = await carregarRespostasDeAssinatura(ctx as never);
  const estadoDe = (m: string[]) => estadoPara(respostas, m);
  const raiox = raioXComARegraUnica(await itensDoRaioX(ctx as never, 2026, 10), estadoDe);
  const perdido = await carregarDinheiroPerdido(ctx as never);
  const vivos = perdido.vivos.filter((a) => a.tipo === "assinatura" && a.mensal);
  const lista = assinaturasComARegraUnica(
    juntarAssinaturas({
      dela: banco.contas.filter((c) => c.userId === ctx.userId).map((c) => ({ id: c.id, nome: c.nome as string, valor: c.valor as number, diaDoMes: null, chaveDoHistorico: (c.chaveDoHistorico as string) ?? null, categoria: null })),
      achadas: [
        ...raiox.itens.map((i) => ({ chave: `rx:${i.chave}`, nome: i.nome, mensal: i.mensal })),
        ...vivos.map((a) => ({ chave: `dp:${a.chave}`, nome: a.nome, mensal: a.mensal as number, comerciante: a.comerciante.split("#")[0] })),
      ],
      contas: [],
      recusas: new Set(),
      lancamentosDoMes: [],
    }),
    { dela: banco.contas.filter((c) => c.userId === ctx.userId).map((c) => ({ id: c.id, nome: c.nome as string, chaveDoHistorico: (c.chaveDoHistorico as string) ?? null })), raiox: raiox.itens, achados: vivos },
    estadoDe,
  );
  const carta = (nome: string) => perdido.todas.find((c) => c.tipo === "assinatura" && c.nome === nome) ?? null;
  return {
    /** Raio-X: "aberto", "Manter", "Vou cancelar", "Cancelada" ou "fora" (não aparece). */
    raiox: (nome: string) => {
      const i = raiox.itens.find((x) => x.nome === nome);
      if (!i) return "fora";
      const d = raiox.decididos.get(i.chave)?.tipo;
      return d === "raiox_manter" ? "Manter" : d === "raiox_cancelar" ? (raiox.canceladas.has(i.chave) ? "Cancelada" : "Vou cancelar") : "aberto";
    },
    /** Recorrentes: "na lista", "para cancelar" ou "fora". */
    lista: (nome: string) => {
      const l = lista.find((x) => x.nome === nome);
      return !l ? "fora" : l.paraCancelar ? "para cancelar" : "na lista";
    },
    /** Dinheiro perdido: o estado da carta, ou "fora". */
    perdido: (nome: string) => carta(nome)?.estado ?? "fora",
    item: (nome: string) => raiox.itens.find((x) => x.nome === nome)!,
    linha: (nome: string) => lista.find((x) => x.nome === nome)!,
    carta: (nome: string) => carta(nome)!,
    ateAgora: perdido.ateAgora.porAno,
  };
}

/** Os botões das telas, com o mesmo alvo que cada ação monta. */
const noRaioX = async (ctx: Ctx, nome: string, decisao: "raiox_manter" | "raiox_cancelar") => {
  const i = (await telas(ctx)).item(nome);
  await responderAssinatura(ctx as never, { raiox: i.chave, nome: i.nome, comerciante: chaveDoComercianteDe(i.descricao ?? i.nome), valorRaioX: i.anual }, decisao);
};
const desfazerNoRaioX = async (ctx: Ctx, nome: string) => {
  const i = (await telas(ctx)).item(nome);
  await desfazerAssinatura(ctx as never, { raiox: i.chave, nome: i.nome });
};
const noPerdido = async (ctx: Ctx, nome: string, estado: "uso" | "nao_uso" | "aberto") => {
  const c = (await telas(ctx)).carta(nome);
  banco.sessao = ctx;
  return perdidoActions.decidirAchadoAction({ chave: c.chave, estado });
};
const naoEAssinatura = async (ctx: Ctx, nome: string) => {
  const l = (await telas(ctx)).linha(nome);
  banco.sessao = ctx;
  await recorrentesActions.naoEAssinaturaAction({ nome: l.nome, marcas: l.marcas });
  return { nome: l.nome, marcas: l.marcas };
};

beforeEach(() => {
  banco.decisoes = [];
  banco.achados = [];
  banco.recusas = [];
  banco.contas = [];
  banco.entradas = [];
  banco.regrasDaCasa = [];
  banco.seq = 0;
  semear(ANA);
});

describe("sem resposta, as três telas mostram a Netflix aberta", () => {
  it("retrato de partida", async () => {
    const t = await telas();
    expect(t.raiox("Netflix")).toBe("aberto");
    expect(t.lista("Netflix")).toBe("na lista");
    expect(t.perdido("Netflix")).toBe("aberto");
  });
});

describe("responde no Dinheiro perdido, vale no Raio-X e em Recorrentes", () => {
  it("'Não uso' na carta da Netflix: Vou cancelar no Raio-X e o selo em Recorrentes (o exemplo da Dani)", async () => {
    expect((await noPerdido(ANA, "Netflix", "nao_uso")).ok).toBe(true);
    const t = await telas();
    expect(t.perdido("Netflix")).toBe("nao_uso");
    expect(t.raiox("Netflix")).toBe("Vou cancelar");
    expect(t.lista("Netflix")).toBe("para cancelar");
    // O Spotify não muda.
    expect(t.raiox("Spotify")).toBe("aberto");
    expect(t.lista("Spotify")).toBe("na lista");
  });

  it("'Uso' na carta: Manter no Raio-X", async () => {
    await noPerdido(ANA, "Netflix", "uso");
    const t = await telas();
    expect(t.raiox("Netflix")).toBe("Manter");
    expect(t.lista("Netflix")).toBe("na lista");
  });

  it("Desfazer na carta volta à resposta de antes, de outra tela, em todo lugar", async () => {
    await noRaioX(ANA, "Netflix", "raiox_manter");
    await noPerdido(ANA, "Netflix", "nao_uso");
    expect((await telas()).raiox("Netflix")).toBe("Vou cancelar");
    const r = await noPerdido(ANA, "Netflix", "aberto");
    // A tela recebe o estado de volta: a carta fica "Uso", não volta para a fila.
    expect(r).toEqual({ ok: true, estado: "uso" });
    const t = await telas();
    expect(t.perdido("Netflix")).toBe("uso");
    expect(t.raiox("Netflix")).toBe("Manter");
    expect(t.lista("Netflix")).toBe("na lista");
  });
});

describe("responde no Raio-X, vale em Recorrentes e no Dinheiro perdido", () => {
  it("'Cancelar' no Raio-X: Não uso na carta (soma no Até agora) e o selo em Recorrentes", async () => {
    await noRaioX(ANA, "Netflix", "raiox_cancelar");
    const t = await telas();
    expect(t.raiox("Netflix")).toBe("Vou cancelar");
    expect(t.perdido("Netflix")).toBe("nao_uso");
    expect(t.ateAgora).toBeCloseTo(55.9 * 12, 2);
    expect(t.lista("Netflix")).toBe("para cancelar");
  });

  it("'Manter' no Raio-X depois do 'Não uso': a última vale", async () => {
    await noPerdido(ANA, "Netflix", "nao_uso");
    await noRaioX(ANA, "Netflix", "raiox_manter");
    const t = await telas();
    expect(t.perdido("Netflix")).toBe("uso");
    expect(t.lista("Netflix")).toBe("na lista");
    expect(t.raiox("Netflix")).toBe("Manter");
  });

  it("Desfazer no Raio-X volta todas as telas para aberta", async () => {
    await noRaioX(ANA, "Netflix", "raiox_cancelar");
    await desfazerNoRaioX(ANA, "Netflix");
    const t = await telas();
    expect(t.raiox("Netflix")).toBe("aberto");
    expect(t.perdido("Netflix")).toBe("aberto");
    expect(t.lista("Netflix")).toBe("na lista");
  });

  it("'Cancelei mesmo' (a confirmação do Raio-X): sai de Recorrentes, Cancelada no Raio-X, Não uso na carta", async () => {
    await noRaioX(ANA, "Netflix", "raiox_cancelar");
    await responderAssinatura(ANA as never, { raiox: "netflix" }, "raiox_cancelei");
    const t = await telas();
    expect(t.raiox("Netflix")).toBe("Cancelada");
    expect(t.perdido("Netflix")).toBe("nao_uso");
    expect(t.lista("Netflix")).toBe("fora");
  });
});

describe("responde em Recorrentes, vale no Raio-X e no Dinheiro perdido", () => {
  it("'Não é assinatura': some das três", async () => {
    await naoEAssinatura(ANA, "Netflix");
    const t = await telas();
    expect(t.lista("Netflix")).toBe("fora");
    expect(t.raiox("Netflix")).toBe("fora");
    expect(t.perdido("Netflix")).toBe("fora");
    expect(t.lista("Spotify")).toBe("na lista");
  });

  it("Desfazer o 'Não é assinatura' volta à resposta de antes (o 'Não uso' da carta)", async () => {
    await noPerdido(ANA, "Netflix", "nao_uso");
    const alvo = await naoEAssinatura(ANA, "Netflix");
    await recorrentesActions.desfazerNaoEAssinaturaAction(alvo);
    const t = await telas();
    expect(t.lista("Netflix")).toBe("para cancelar");
    expect(t.raiox("Netflix")).toBe("Vou cancelar");
    expect(t.perdido("Netflix")).toBe("nao_uso");
  });

  it("'+ Adicionar' depois do 'Não uso': ela diz que é assinatura e fica, Manter no Raio-X e Uso na carta", async () => {
    await noPerdido(ANA, "Netflix", "nao_uso");
    await responderAssinatura(ANA as never, { comerciante: "m:netflix", nome: "Netflix" }, "lista_adicionar");
    const t = await telas();
    expect(t.lista("Netflix")).toBe("na lista");
    expect(t.raiox("Netflix")).toBe("Manter");
    expect(t.perdido("Netflix")).toBe("uso");
  });
});

describe("as respostas de antes desta regra", () => {
  it("o 'Manter' antigo do Raio-X já aparece nas outras telas, e o Desfazer depois da primeira resposta volta para ele", async () => {
    banco.decisoes.push({ id: "antigo1", userId: ANA.userId, profileId: ANA.profileId, tipo: "raiox_manter", chave: "netflix", descricao: "Netflix", valor: 0, dados: null, createdAt: new Date(Date.UTC(2026, 8, 20)) });
    let t = await telas();
    expect(t.raiox("Netflix")).toBe("Manter");
    expect(t.perdido("Netflix")).toBe("uso");
    await noPerdido(ANA, "Netflix", "nao_uso");
    t = await telas();
    expect(t.raiox("Netflix")).toBe("Vou cancelar");
    await noPerdido(ANA, "Netflix", "aberto");
    t = await telas();
    expect(t.raiox("Netflix")).toBe("Manter");
    expect(t.perdido("Netflix")).toBe("uso");
  });

  it("os lugares antigos ficam iguais ao estado único (o Money Reset e o cancelar leem de lá)", async () => {
    await noPerdido(ANA, "Netflix", "nao_uso");
    expect(banco.decisoes.filter((d) => d.tipo === "raiox_cancelar").map((d) => d.chave)).toEqual(["netflix"]);
    await naoEAssinatura(ANA, "Netflix");
    expect(banco.decisoes.some((d) => d.tipo === "raiox_cancelar" || d.tipo === "raiox_manter")).toBe(false);
    expect(banco.recusas.map((r) => r.chave)).toContain("nao-assinatura:netflix");
    expect(banco.achados.find((a) => (a.chave as string).startsWith("assinatura:m:netflix"))?.estado).toBe("aberto");
  });
});

describe("Casal simples: o que é da casa vale para os dois, e nada do outro vaza", () => {
  const casaDa = (eu: Ctx, outro: Ctx): CasaNaSessao => ({
    membroId: "m1",
    casalProfileId: "p-casal",
    eu: { userId: eu.userId, profileId: eu.profileId, letra: "A", nome: "Eu", papel: eu === ANA ? "titular" : "par" },
    outro: { userId: outro.userId, profileId: outro.profileId, letra: "B", nome: "Outro", papel: outro === ANA ? "titular" : "par" },
  });
  const anaNaCasa = { ...ANA, casa: casaDa(ANA, CAIO) };
  const caioNaCasa = { ...CAIO, casa: casaDa(CAIO, ANA) };

  it("a Netflix da casa: o 'Não uso' do Caio vale no app da Ana", async () => {
    banco.entradas = [];
    semear(ANA, [["Netflix", 55.9], ["Spotify", 21.9]], true);
    semear(CAIO, [["Netflix", 55.9]], true);
    await noPerdido(caioNaCasa, "Netflix", "nao_uso");
    const t = await telas(anaNaCasa);
    expect(t.raiox("Netflix")).toBe("Vou cancelar");
    expect(t.lista("Netflix")).toBe("para cancelar");
    expect(t.perdido("Netflix")).toBe("nao_uso");
  });

  it("a Netflix dele não é da casa: a resposta dele não mexe na dela", async () => {
    banco.entradas = [];
    semear(ANA, [["Netflix", 55.9]], true);
    semear(CAIO, [["Netflix", 55.9]], false);
    await noPerdido(caioNaCasa, "Netflix", "nao_uso");
    const t = await telas(anaNaCasa);
    expect(t.raiox("Netflix")).toBe("aberto");
    expect(t.lista("Netflix")).toBe("na lista");
  });

  it("o que é só dele nunca aparece para ela: a assinatura dele não entra nas telas dela", async () => {
    banco.entradas = [];
    semear(ANA, [["Netflix", 55.9]], true);
    semear(CAIO, [["Netflix", 55.9], ["Deezer", 33.9]], true);
    await noPerdido(caioNaCasa, "Deezer", "uso");
    const t = await telas(anaNaCasa);
    expect(t.raiox("Deezer")).toBe("fora");
    expect(t.lista("Deezer")).toBe("fora");
    expect(t.perdido("Deezer")).toBe("fora");
    // E ninguém grava nada no perfil do outro.
    expect(banco.decisoes.filter((d) => d.userId === ANA.userId)).toEqual([]);
    expect(banco.achados.filter((d) => d.userId === ANA.userId)).toEqual([]);
  });

  it("sem casa, a resposta de outra pessoa nunca é lida", async () => {
    semear(CAIO, [["Netflix", 55.9]], true);
    await noPerdido(CAIO, "Netflix", "nao_uso");
    const t = await telas(ANA);
    expect(t.raiox("Netflix")).toBe("aberto");
    expect(marcasDoAchado(t.carta("Netflix"))).toContain("c:m:netflix");
  });
});
