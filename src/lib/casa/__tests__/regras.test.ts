import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  casaAtiva,
  chaveDaConta,
  comFiltro,
  donoDoOrcamento,
  lancamentosDoAcertoDaCasa,
  lancamentosDosTotais,
  lancamentosParaVer,
  letraDoDono,
  quemGastou,
  type CasaNaSessao,
  type QuemLe,
} from "@/lib/casa/regras";
import { bate } from "./avaliador";

/**
 * O Casal simples num banco de mentira com todo tipo de linha: o Pessoal de cada um, o "Só meu"
 * de cada um, uma conta escondida de cada um, a Empresa da Ana e o perfil Casal antigo. Os filtros
 * de verdade (src/lib/casa/regras.ts) rodam aqui pelo avaliador.
 */

const ANA = "ana";
const LUCAS = "lucas";
const PESSOAL_ANA = "pessoal-ana";
const EMPRESA_ANA = "empresa-ana";
const CASAL = "casal-ana";
const PESSOAL_LUCAS = "pessoal-lucas";
const ESTRANHA = "estranha";

type Linha = { id: string; userId: string; profileId: string; category: "INCOME" | "EXPENSE"; soMeu: boolean; importBatchId: string | null; importBatch: { ocultoDoPar: boolean } | null };

const L = (id: string, o: Partial<Linha>): Linha => ({ id, userId: ANA, profileId: PESSOAL_ANA, category: "EXPENSE", soMeu: false, importBatchId: null, importBatch: null, ...o });
const loteVisivel = { importBatchId: "lote-nubank-ana", importBatch: { ocultoDoPar: false } };
const loteOculto = { importBatchId: "lote-inter-ana", importBatch: { ocultoDoPar: true } };

const BANCO: Linha[] = [
  L("ana-ifood", {}),
  L("ana-nubank-mercado", loteVisivel),
  L("ana-inter-escondido", loteOculto),
  L("ana-consulta-so-meu", { soMeu: true }),
  L("ana-salario", { category: "INCOME" }),
  L("ana-empresa-venda", { profileId: EMPRESA_ANA, category: "INCOME" }),
  L("ana-casal-antigo", { profileId: CASAL }),
  L("lucas-uber", { userId: LUCAS, profileId: PESSOAL_LUCAS }),
  L("lucas-itau-mercado", { userId: LUCAS, profileId: PESSOAL_LUCAS, importBatchId: "lote-itau-lucas", importBatch: { ocultoDoPar: false } }),
  L("lucas-c6-escondido", { userId: LUCAS, profileId: PESSOAL_LUCAS, importBatchId: "lote-c6-lucas", importBatch: { ocultoDoPar: true } }),
  L("lucas-presente-so-meu", { userId: LUCAS, profileId: PESSOAL_LUCAS, soMeu: true }),
  L("lucas-so-meu-no-casal-antigo", { userId: LUCAS, profileId: CASAL, soMeu: true }),
  L("de-outra-pessoa", { userId: ESTRANHA, profileId: "pessoal-estranha" }),
];

const CASA_DA_ANA: CasaNaSessao = {
  membroId: "m1",
  casalProfileId: CASAL,
  eu: { userId: ANA, profileId: PESSOAL_ANA, letra: "A", nome: "Ana", papel: "titular" },
  outro: { userId: LUCAS, profileId: PESSOAL_LUCAS, letra: "B", nome: "Lucas", papel: "par" },
};
const CASA_DO_LUCAS: CasaNaSessao = { ...CASA_DA_ANA, eu: CASA_DA_ANA.outro, outro: CASA_DA_ANA.eu };

const ANA_LOGADA: QuemLe = { userId: ANA, profileId: PESSOAL_ANA, casa: CASA_DA_ANA };
const LUCAS_LOGADO: QuemLe = { userId: LUCAS, profileId: PESSOAL_LUCAS, casa: CASA_DO_LUCAS };

const ids = (where: Prisma.MonthlyEntryWhereInput) =>
  BANCO.filter((l) => bate(l as unknown as Record<string, unknown>, where as Record<string, unknown>))
    .map((l) => l.id)
    .sort();

describe("Casal simples: o que cada login vê", () => {
  it("a Ana vê tudo dela (com o que escondeu) e só o visível do Lucas", () => {
    expect(ids(lancamentosParaVer(ANA_LOGADA))).toEqual(
      ["ana-ifood", "ana-nubank-mercado", "ana-inter-escondido", "ana-consulta-so-meu", "ana-salario", "lucas-uber", "lucas-itau-mercado"].sort(),
    );
  });

  it("o Lucas vê tudo dele e só o visível da Ana: nem o Só meu, nem o Inter desligado, nem a Empresa", () => {
    const visto = ids(lancamentosParaVer(LUCAS_LOGADO));
    expect(visto).toEqual(["lucas-uber", "lucas-itau-mercado", "lucas-c6-escondido", "lucas-presente-so-meu", "ana-ifood", "ana-nubank-mercado", "ana-salario"].sort());
    for (const proibido of ["ana-consulta-so-meu", "ana-inter-escondido", "ana-empresa-venda", "ana-casal-antigo"]) expect(visto).not.toContain(proibido);
  });

  it("os totais seguem a mesma regra: o escondido do outro nunca soma", () => {
    expect(ids(lancamentosDosTotais(LUCAS_LOGADO))).not.toContain("ana-consulta-so-meu");
    expect(ids(lancamentosDosTotais(LUCAS_LOGADO))).not.toContain("ana-inter-escondido");
    expect(ids(lancamentosDosTotais(ANA_LOGADA))).not.toContain("lucas-presente-so-meu");
    expect(ids(lancamentosDosTotais(ANA_LOGADA))).not.toContain("lucas-c6-escondido");
  });

  it("o acerto é o mesmo nos dois logins e não tem nada escondido de ninguém", () => {
    const daAna = ids(lancamentosDoAcertoDaCasa(CASA_DA_ANA));
    const doLucas = ids(lancamentosDoAcertoDaCasa(CASA_DO_LUCAS));
    expect(daAna).toEqual(doLucas);
    expect(daAna).toEqual(["ana-ifood", "ana-nubank-mercado", "ana-salario", "lucas-uber", "lucas-itau-mercado"].sort());
  });

  it("comFiltro não deixa o mês apagar a regra da casa (os dois têm OR)", () => {
    const onde = comFiltro(lancamentosParaVer(LUCAS_LOGADO), { OR: [{ category: "EXPENSE" }] });
    expect(ids(onde)).not.toContain("ana-consulta-so-meu");
    expect(ids(onde)).not.toContain("ana-salario");
  });

  it("sem casa é exatamente o filtro de sempre (userId + profileId)", () => {
    expect(lancamentosParaVer({ userId: ANA, profileId: PESSOAL_ANA })).toEqual({ userId: ANA, profileId: PESSOAL_ANA });
    expect(ids(lancamentosParaVer({ userId: LUCAS, profileId: PESSOAL_LUCAS }))).not.toContain("ana-ifood");
  });

  it("na Empresa a casa não vale: a Empresa continua só da Ana", () => {
    const naEmpresa: QuemLe = { userId: ANA, profileId: EMPRESA_ANA, casa: CASA_DA_ANA };
    expect(casaAtiva(naEmpresa)).toBeNull();
    expect(ids(lancamentosParaVer(naEmpresa))).toEqual(["ana-empresa-venda"]);
  });

  it("uma casa que não é de quem está logado não abre nada", () => {
    const estranha: QuemLe = { userId: ESTRANHA, profileId: "pessoal-estranha", casa: CASA_DA_ANA };
    expect(casaAtiva(estranha)).toBeNull();
    expect(ids(lancamentosParaVer(estranha))).toEqual(["de-outra-pessoa"]);
  });
});

describe("Casal simples: orçamento, dono e conta", () => {
  it("o orçamento é um só, o da titular, nos dois logins", () => {
    expect(donoDoOrcamento(ANA_LOGADA)).toEqual({ userId: ANA, profileId: PESSOAL_ANA });
    expect(donoDoOrcamento(LUCAS_LOGADO)).toEqual({ userId: ANA, profileId: PESSOAL_ANA });
    expect(donoDoOrcamento({ userId: LUCAS, profileId: PESSOAL_LUCAS })).toEqual({ userId: LUCAS, profileId: PESSOAL_LUCAS });
  });

  it("quem gastou é o dono do registro", () => {
    expect(quemGastou(LUCAS_LOGADO, { userId: ANA })).toBe("outro");
    expect(quemGastou(LUCAS_LOGADO, { userId: LUCAS })).toBe("eu");
    expect(quemGastou({ userId: ANA, profileId: PESSOAL_ANA }, { userId: ANA })).toBeNull();
    expect(letraDoDono(CASA_DO_LUCAS, ANA)).toBe("A");
    expect(letraDoDono(CASA_DO_LUCAS, ESTRANHA)).toBeNull();
  });

  it("a conta é o tipo e o banco do arquivo, como na tela Contas e cartões", () => {
    expect(chaveDaConta("extrato", "Nubank-outubro.pdf")).toBe("conta:nubank");
    expect(chaveDaConta("extrato", "nubank_setembro.csv")).toBe("conta:nubank");
    expect(chaveDaConta("fatura", "nubank-fatura.pdf")).toBe("cartao:nubank");
    expect(chaveDaConta("openfinance", "Itaú · 12/10/2026")).toBe("conta:itau");
    expect(chaveDaConta("extrato", null)).toBe("conta:extrato");
  });
});

import { daCasaAutomatico, ehDaCasa } from "@/lib/casa/regras";

describe("Da casa", () => {
  const g = (o: Partial<Parameters<typeof ehDaCasa>[0]>) => ({ category: "EXPENSE", parentCategory: null, subcategory: null, description: null, doCasal: null, soMeu: false, ...o });
  it("automático: Moradia inteira e o supermercado (pela subcategoria ou pelo nome)", () => {
    for (const d of ["Aluguel", "Condomínio", "IPTU", "Enel", "Sabesp", "Comgás", "Vivo Fibra"]) expect(daCasaAutomatico({ parentCategory: "MORADIA", subcategory: null, description: d })).toBe(true);
    expect(ehDaCasa(g({ parentCategory: "ALIMENTACAO", subcategory: "Supermercado" }))).toBe(true);
    expect(ehDaCasa(g({ parentCategory: "ALIMENTACAO", description: "PAO DE ACUCAR-1234" }))).toBe(true);
    expect(ehDaCasa(g({ parentCategory: "ALIMENTACAO", description: "Mercado" }))).toBe(true);
    expect(ehDaCasa(g({ parentCategory: "ALIMENTACAO", description: "iFood" }))).toBe(false);
    expect(ehDaCasa(g({ parentCategory: "VESTUARIO", description: "Renner" }))).toBe(false);
  });
  it("a escolha do lançamento manda, depois o aprendido; Só meu e entrada nunca", () => {
    expect(ehDaCasa(g({ parentCategory: "MORADIA", doCasal: false }))).toBe(false);
    expect(ehDaCasa(g({ parentCategory: "VESTUARIO", doCasal: true }))).toBe(true);
    expect(ehDaCasa(g({ parentCategory: "MORADIA", soMeu: true }))).toBe(false);
    expect(ehDaCasa(g({ category: "INCOME", parentCategory: "MORADIA" }))).toBe(false);
    const aprendidas = new Map([["renner", true]]);
    expect(ehDaCasa(g({ parentCategory: "VESTUARIO", description: "RENNER" }), aprendidas)).toBe(true);
  });
});
