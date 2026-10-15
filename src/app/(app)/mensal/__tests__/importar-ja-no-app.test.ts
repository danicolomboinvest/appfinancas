import { beforeEach, describe, expect, it, vi } from "vitest";
import { bate } from "@/lib/casa/__tests__/avaliador";
import type { CasaNaSessao } from "@/lib/casa/regras";

/**
 * "Essa movimentação parece já estar no app. Importar mesmo assim?" (15/10/2026), do arquivo lido
 * até a pergunta, com o banco trocado por uma lista em memória que entende os filtros de verdade
 * (o avaliador da casa). Os três casos da cliente: o lançado à mão com gorjeta ou longe na data, a
 * mesma compra de outro banco em outro dia, e o casal com o mesmo cartão. E a privacidade: o "Só
 * meu" e a conta escondida do par nunca viram pergunta.
 */

type Lote = { docType: string; fileName: string | null; ocultoDoPar: boolean };
type Linha = {
  id: string;
  userId: string;
  profileId: string;
  year: number;
  month: number;
  entryDate: Date | null;
  amount: number;
  description: string | null;
  category: string;
  importBatchId: string | null;
  importBatch: Lote | null;
  externalId: string | null;
  soMeu: boolean;
};

const banco: Linha[] = [];
let proximoId = 0;
const sessao: { casa: CasaNaSessao | null } = { casa: null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "ana", profileId: "pessoal-ana", profileKind: "PESSOAL", casa: sessao.casa })) }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => banco.filter((e) => bate(e as unknown as Record<string, unknown>, where))),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    customCategory: { findMany: vi.fn(async () => []) },
    importBatch: { count: vi.fn(async () => 0) },
    user: { findUnique: vi.fn(async () => ({ name: "Ana" })) },
  },
}));
vi.mock("@/lib/repositories/import-batch.repo", () => ({
  createImportBatch: vi.fn(async () => ({ id: "lote-novo" })),
  deleteEmptyImportBatch: vi.fn(async () => {}),
  deleteImportBatchWithEntries: vi.fn(async () => 0),
}));
vi.mock("@/lib/repositories/profile.repo", () => ({ listProfiles: vi.fn(async () => [{ id: "pessoal-ana" }]) }));
vi.mock("@/lib/repositories/decisao.repo", () => ({ descricoesOriginais: vi.fn(async () => new Map()) }));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: vi.fn(async () => []), garantirCuidadoPessoal: vi.fn(async () => null) }));
vi.mock("@/lib/repositories/transaction-rule.repo", () => ({ listTransactionRules: vi.fn(async () => []), upsertTransactionRule: vi.fn(async () => {}), aplicarNosOutrosMeses: vi.fn(async () => {}) }));
vi.mock("@/lib/repositories/mover-perfil.repo", () => ({ regrasDePerfil: vi.fn(async () => []) }));
vi.mock("@/lib/repositories/import-diagnostic.repo", () => ({
  recordImportDiagnostic: vi.fn(async () => "diag"),
  isPartialRead: vi.fn(() => false),
  mensagemImplausivel: vi.fn(() => ""),
  safeHeader: vi.fn(() => ""),
  MARCA_CONFERIDO: "[conferido]",
  MARCA_NAO_FECHOU: "[não fechou]",
}));
vi.mock("@/lib/repositories/import-file.repo", () => ({ storeFailedImportFile: vi.fn(async () => {}) }));

const { parseStatementAction } = await import("../import-actions");

function lancar(description: string, amount: number, dia: string | null, extra: Partial<Linha> & { mes?: string } = {}) {
  const ym = dia ?? extra.mes!;
  banco.push({
    id: `e${++proximoId}`,
    userId: "ana",
    profileId: "pessoal-ana",
    year: Number(ym.slice(0, 4)),
    month: Number(ym.slice(5, 7)),
    entryDate: dia ? new Date(`${dia}T12:00:00`) : null,
    amount,
    description,
    category: "EXPENSE",
    importBatchId: null,
    importBatch: null,
    externalId: null,
    soMeu: false,
    ...extra,
  });
}
const doArquivo = (fileName: string, docType = "extrato", ocultoDoPar = false): Partial<Linha> => ({ importBatchId: `lote-${fileName}`, importBatch: { docType, fileName, ocultoDoPar } });
const doCaio = (extra: Partial<Linha> = {}): Partial<Linha> => ({ userId: "caio", profileId: "pessoal-caio", ...extra });

async function lerExtrato(linhas: string[], arquivo = "nubank-outubro.csv") {
  const form = new FormData();
  form.set("file", new File([["Data;Descrição;Valor", ...linhas].join("\n")], arquivo));
  form.set("encoding", "text");
  form.set("docType", "extrato");
  const r = await parseStatementAction(form);
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

const casaDaAna: CasaNaSessao = {
  membroId: "m1",
  casalProfileId: "casal",
  eu: { userId: "ana", profileId: "pessoal-ana", letra: "A", nome: "Ana", papel: "titular" },
  outro: { userId: "caio", profileId: "pessoal-caio", letra: "B", nome: "Caio", papel: "par" },
};

beforeEach(() => {
  banco.length = 0;
  sessao.casa = null;
});

describe("a) o lançado à mão", () => {
  it("com a gorjeta de 10% vira a pergunta, com o id para acertar o valor", async () => {
    lancar("Outback", 100, "2026-10-10");
    const [it] = await lerExtrato(["10/10/2026;OUTBACK STEAKHOUSE;-110,00"]);
    expect(it.jaNoApp).toBeFalsy();
    expect(it.possivelDuplicata).toMatchObject({ altaChance: true, descricao: "Outback", valor: 100, importado: false });
    expect(it.possivelDuplicata?.id).toBeTruthy();
  });

  it("5 dias longe, mesmo valor e nome, vira a pergunta", async () => {
    lancar("Enel", 213.29, "2026-10-05");
    const [it] = await lerExtrato(["10/10/2026;ENEL DISTRIBUICAO;-213,29"]);
    expect(it.possivelDuplicata).toMatchObject({ altaChance: true });
  });

  it("o quase certo de antes continua resolvendo sozinho (sem pergunta)", async () => {
    lancar("Netflix", 55.9, "2026-10-09");
    const [it] = await lerExtrato(["10/10/2026;NETFLIX.COM;-55,90"]);
    expect(it.jaNoApp).toBeTruthy();
    expect(it.possivelDuplicata).toBeFalsy();
  });
});

describe("b) a mesma compra de outro banco, outro dia", () => {
  it("o débito no Itaú dois dias depois da compra no Nubank vira a pergunta", async () => {
    lancar("MERCADOLIVRE COMPRA", 249.9, "2026-10-10", doArquivo("itau-outubro.pdf"));
    const [it] = await lerExtrato(["08/10/2026;MERCADOLIVRE*LOJA;-249,90"]);
    expect(it.possivelDuplicata).toMatchObject({ altaChance: true, importado: true, data: "2026-10-10" });
    expect(it.possivelDuplicata?.id).toBeUndefined();
  });

  it("na mesma conta, outro dia é outra compra", async () => {
    lancar("MERCADOLIVRE*LOJA", 249.9, "2026-10-10", doArquivo("nubank-setembro.csv"));
    const [it] = await lerExtrato(["08/10/2026;MERCADOLIVRE*LOJA;-249,90"]);
    expect(it.possivelDuplicata).toBeFalsy();
  });

  it("ônibus, metrô e café repetidos no arquivo nunca viram pergunta", async () => {
    lancar("SPTRANS ONIBUS", 4.4, "2026-10-07", doArquivo("itau-outubro.pdf"));
    const items = await lerExtrato([
      "08/10/2026;SPTRANS ONIBUS;-4,40",
      "08/10/2026;SPTRANS ONIBUS;-4,40",
      "09/10/2026;SPTRANS ONIBUS;-4,40",
      "09/10/2026;METRO SP;-5,40",
      "09/10/2026;METRO SP;-5,40",
    ]);
    expect(items.filter((i) => i.possivelDuplicata)).toHaveLength(0);
  });
});

describe("c) o casal com o mesmo cartão", () => {
  it("a compra que o Caio já subiu vira a pergunta para a Ana", async () => {
    sessao.casa = casaDaAna;
    lancar("IFOOD *RESTAURANTE", 64.9, "2026-10-08", doCaio(doArquivo("nubank-caio.csv")));
    const [it] = await lerExtrato(["08/10/2026;IFOOD *RESTAURANTE;-64,90"]);
    expect(it.possivelDuplicata).toMatchObject({ altaChance: true, importado: true });
    // O lançamento é do Caio: nunca vai o id (só quem gastou mexe nele).
    expect(it.possivelDuplicata?.id).toBeUndefined();
  });

  it("a fatura do Caio gravada sem dia, no mês do vencimento, também", async () => {
    sessao.casa = casaDaAna;
    lancar("IFOOD *RESTAURANTE", 64.9, null, { ...doCaio(doArquivo("nubank-caio.csv", "fatura")), mes: "2026-10" });
    const [it] = await lerExtrato(["08/10/2026;IFOOD *RESTAURANTE;-64,90"]);
    expect(it.possivelDuplicata).toMatchObject({ altaChance: true });
  });

  it("o 'Só meu' do Caio nunca vira pergunta (não revela o lançamento)", async () => {
    sessao.casa = casaDaAna;
    lancar("FARMACIA SAO JOAO", 89.9, "2026-10-08", doCaio({ ...doArquivo("nubank-caio.csv"), soMeu: true }));
    const [it] = await lerExtrato(["08/10/2026;FARMACIA SAO JOAO;-89,90"]);
    expect(it.possivelDuplicata).toBeFalsy();
    expect(JSON.stringify(it)).not.toContain("caio");
  });

  it("a conta que o Caio escondeu também não", async () => {
    sessao.casa = casaDaAna;
    lancar("FARMACIA SAO JOAO", 89.9, "2026-10-08", doCaio(doArquivo("nubank-caio.csv", "extrato", true)));
    const [it] = await lerExtrato(["08/10/2026;FARMACIA SAO JOAO;-89,90"]);
    expect(it.possivelDuplicata).toBeFalsy();
  });

  it("fora de uma casa, o lançamento de outra pessoa nunca entra na busca", async () => {
    lancar("IFOOD *RESTAURANTE", 64.9, "2026-10-08", doCaio(doArquivo("nubank-caio.csv")));
    const [it] = await lerExtrato(["08/10/2026;IFOOD *RESTAURANTE;-64,90"]);
    expect(it.possivelDuplicata).toBeFalsy();
  });
});
