import { describe, expect, it } from "vitest";
import type { ParentCategory } from "@prisma/client";
import { classify, normalizeMerchant, padraoAprendivel, type LearnedRule } from "../classify";
import { CATEGORIAS_EMPRESA } from "@/lib/profiles/empresa";

// Descrições FICTÍCIAS no formato dos bancos, nada de extrato de cliente.
const pix = (nome: string, banco: string) =>
  `Transferência enviada pelo Pix - ${nome} - •••.123.456-•• - ${banco} (0290) Agência: 1 Conta: 12345-6`;

describe("classify: palavra inteira, não pedaço de texto", () => {
  it("imposto não vira combustível (\"posto\" dentro de \"imposto\")", () => {
    for (const d of ["PAGAMENTO IMPOSTO DE RENDA", "DARF IMPOSTO", "Pagamento de boleto efetuado IMPOSTO SIMPLES"]) {
      expect(classify(d)?.parentCategory).toBe("IMPOSTOS");
    }
    expect(classify("POSTO IPIRANGA 123")?.subcategory).toBe("Combustível");
    expect(classify("AUTO POSTOS BR")?.subcategory).toBe("Combustível");
  });

  it("nome de gente e de lugar não cai em categoria por acaso", () => {
    expect(classify(pix("CAMILA SOUZA", "NU PAGAMENTOS - IP"))).toBeNull();
    expect(classify(pix("FAMILIA HAMILTON", "NU PAGAMENTOS - IP"))).toBeNull();
    expect(classify(pix("JOAO PACHECO", "BCO DA AMAZONIA S.A."))).toBeNull();
    expect(classify("HOTEL PRAIA GRANDE")).toEqual({ parentCategory: "LAZER", subcategory: "Viagens" });
    expect(classify("LOJAS RENNER UBERLANDIA")).toBeNull();
    expect(classify("CHURRASCARIA BOI GORDO")).toBeNull();
    expect(classify("CARTAO 1299 LOJA")).toBeNull();
  });

  it("o banco do outro lado do Pix não vira categoria", () => {
    expect(classify(pix("JOAO SILVA", "MERCADO PAGO IP LTDA"))).toBeNull();
    expect(classify(pix("MARIA LIMA", "PAGSEGURO INTERNET IP"))).toBeNull();
    // Sem CPF mascarado, só o "(0000) Agência" no fim.
    expect(classify("Transferência enviada pelo Pix - JOAO - PAGSEGURO INTERNET IP (0290) Agência: 1 Conta: 2")).toBeNull();
    expect(classify("MERCADOLIVRE*LOJA")).toBeNull();
    expect(classify("MERCADO LIVRE COMPRA")).toBeNull();
  });

  it("continua reconhecendo quem é de verdade", () => {
    expect(classify("DROGA RAIA 123")?.subcategory).toBe("Farmácia");
    expect(classify("DROGASIL1234")?.subcategory).toBe("Farmácia");
    expect(classify("AMIL ASSISTENCIA MEDICA")?.subcategory).toBe("Plano de saúde");
    expect(classify("SUPERMERCADO EXEMPLO")?.subcategory).toBe("Supermercado");
    expect(classify("MERCADO DO BAIRRO")?.subcategory).toBe("Supermercado");
    expect(classify("99APP *CORRIDA")?.subcategory).toBe("Aplicativo");
    expect(classify("UBER *UBER *TRIP")?.subcategory).toBe("Aplicativo");
    expect(classify("UBER *EATS")).toEqual({ parentCategory: "ALIMENTACAO", subcategory: "Delivery" });
    expect(classify("BAR DO ZE")?.subcategory).toBe("Restaurante");
    expect(classify("BARBEARIA DO ZE")).toBeNull();
    expect(classify("OI FIBRA")?.subcategory).toBe("Internet");
    expect(classify("Pagamento de fatura CLARO")?.subcategory).toBe("Internet");
  });
});

describe("classify: perfil Empresa", () => {
  it("não usa o mapa da pessoa física (almoço não é mercadoria, farmácia não é folha)", () => {
    for (const d of ["IFOOD *IFD SAO PAULO", "UBER *EATS", "RESTAURANTE EXEMPLO", "SUPERMERCADO EXEMPLO", "DROGASIL 123", "NETFLIX.COM", "HOTEL CENTRO", "AMAZON MARKETPLACE", "CURSO ONLINE"]) {
      expect(classify(d, [], "EMPRESA")).toBeNull();
    }
  });

  it("classifica o que quer dizer a mesma coisa, com subcategoria do plano de contas dela", () => {
    const casos: [string, ParentCategory][] = [
      ["PGTO DAS SIMPLES NACIONAL", "IMPOSTOS"],
      ["DAS MEI 09/2026", "IMPOSTOS"],
      ["ISS PREFEITURA", "IMPOSTOS"],
      ["ICMS SEFAZ", "IMPOSTOS"],
      ["TAXA ALVARA", "IMPOSTOS"],
      ["DARF IRPJ", "IMPOSTOS"],
      ["TARIFA PACOTE SERVICOS", "IMPOSTOS"],
      ["JUROS CHEQUE ESPECIAL", "IMPOSTOS"],
      ["SEGURO EMPRESARIAL", "OUTROS"],
      ["PARCELA EMPRESTIMO", "OUTROS"],
      ["ALUGUEL SALA", "MORADIA"],
      ["CONDOMINIO EDIFICIO", "MORADIA"],
      ["ENEL SP", "MORADIA"],
      ["SABESP", "MORADIA"],
      ["VIVO FIBRA", "MORADIA"],
      ["UBER *TRIP", "TRANSPORTE"],
      ["POSTO SHELL", "TRANSPORTE"],
      ["ESTAPAR", "TRANSPORTE"],
      ["CORREIOS AGENCIA", "TRANSPORTE"],
    ];
    for (const [d, esperado] of casos) {
      const c = classify(d, [], "EMPRESA");
      expect(c?.parentCategory, d).toBe(esperado);
      if (c?.subcategory) expect(CATEGORIAS_EMPRESA[c.parentCategory].subcategorias, d).toContain(c.subcategory);
    }
    // "das" como preposição não é o DAS do Simples.
    expect(classify("LOJA DAS FLORES", [], "EMPRESA")).toBeNull();
  });

  it("a regra aprendida no perfil vale igual", () => {
    const rules: LearnedRule[] = [{ pattern: "restaurante exemplo", parentCategory: "LAZER", subcategory: "Consultoria" }];
    expect(classify("RESTAURANTE EXEMPLO", rules, "EMPRESA")).toEqual({ parentCategory: "LAZER", subcategory: "Consultoria" });
  });
});

describe("regras aprendidas: palavra inteira e nada genérico", () => {
  const regra = (descricao: string, parentCategory: ParentCategory = "LAZER"): LearnedRule => ({
    pattern: normalizeMerchant(descricao),
    parentCategory,
  });

  it("não aprende padrão feito só de meio de pagamento ou curto demais", () => {
    for (const d of ["Compra no débito", "PIX ENVIADO", "Pix - Enviado", "Pagamento de boleto efetuado", "BAR", "Transferência enviada pelo Pix"]) {
      expect(padraoAprendivel(normalizeMerchant(d)), d).toBe(false);
    }
    expect(padraoAprendivel(normalizeMerchant("Pix - MARIA"))).toBe(true);
    expect(padraoAprendivel(normalizeMerchant("XPTO LTDA 12/05"))).toBe(true);
  });

  it("regra genérica que já está no banco não contamina mais nada", () => {
    const rules = [regra("Compra no débito"), regra("PIX ENVIADO"), regra("BAR")];
    expect(classify("Compra no débito - PADARIA PAO DOURADO", rules)).toEqual({ parentCategory: "ALIMENTACAO", subcategory: "Restaurante" });
    expect(classify("PIX ENVIADO IFOOD", rules)).toEqual({ parentCategory: "ALIMENTACAO", subcategory: "Delivery" });
    expect(classify("BARBEARIA DO ZE", rules)).toBeNull();
  });

  it("casa por palavra inteira: MARIA não pega MARIANA", () => {
    const rules = [regra("Pix - Enviado MARIA", "EDUCACAO")];
    expect(classify("Pix - Enviado MARIANA COSTA", rules)).toBeNull();
    expect(classify("Pix - Enviado MARIA 12/05", rules)?.parentCategory).toBe("EDUCACAO");
  });
});
