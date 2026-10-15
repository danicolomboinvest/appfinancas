import { describe, expect, it } from "vitest";
import { casarComPaguei, compararComPaguei, confirmaOPaguei, origemCombina, type LinhaParaPaguei, type PagueiNoApp } from "../paguei-no-extrato";

/**
 * O extrato que traz um "Paguei" (decisão da Dani em 15/10/2026): mesmo valor (ou até 2% na conta
 * que varia), até 5 dias, a mesma origem quando houver. O quase certo junta sozinho; o resto
 * pergunta. Nada sai sem ela ver.
 */

const aluguel = (x: Partial<PagueiNoApp> = {}): PagueiNoApp => ({
  id: "p-aluguel",
  contaAPagarId: "c-aluguel",
  nomeDaConta: "Aluguel",
  amount: 1800,
  date: "2026-10-15",
  origem: "conta:nubank",
  varia: false,
  ...x,
});
const luz = (x: Partial<PagueiNoApp> = {}): PagueiNoApp => ({
  id: "p-luz",
  contaAPagarId: "c-luz",
  nomeDaConta: "Luz",
  amount: 182.4,
  date: "2026-10-18",
  origem: "conta:nubank",
  varia: true,
  ...x,
});
const linha = (description: string, valor: number, date = "2026-10-16", key = 1): LinhaParaPaguei => ({ key, date, description, valor, category: "EXPENSE" });

describe("origem", () => {
  it("a mesma conta é 'mesma'; outro banco não casa; conta e cartão não se misturam", () => {
    expect(origemCombina("conta:nubank", "conta:nubank")).toBe("mesma");
    expect(origemCombina("conta:nubank", "conta:itau")).toBeNull();
    expect(origemCombina("conta:nubank", "cartao:nubank")).toBeNull();
    expect(origemCombina("cartao:nubank", "cartao:nubank")).toBe("mesma");
  });

  it("o genérico casa com o mesmo tipo; o arquivo sem banco no nome também; dinheiro nunca", () => {
    expect(origemCombina("conta", "conta:itau")).toBe("tipo");
    expect(origemCombina("cartao", "conta:itau")).toBeNull();
    expect(origemCombina("conta:nubank", "conta")).toBe("tipo");
    expect(origemCombina(null, "conta:itau")).toBe("tipo");
    expect(origemCombina("dinheiro", "conta:itau")).toBeNull();
  });
});

describe("um Paguei e uma linha", () => {
  it("o aluguel na mesma conta, com o mesmo valor, um dia depois: quase certo", () => {
    expect(compararComPaguei(linha("PIX ENVIADO IMOBILIARIA CENTRO", 1800), aluguel(), "conta:nubank")).toBe("certo");
  });

  it("até 5 dias vale; 6 já é outro pagamento", () => {
    expect(compararComPaguei(linha("PIX ENVIADO IMOBILIARIA", 1800, "2026-10-20"), aluguel(), "conta:nubank")).toBe("certo");
    expect(compararComPaguei(linha("PIX ENVIADO IMOBILIARIA", 1800, "2026-10-21"), aluguel(), "conta:nubank")).toBeNull();
  });

  it("conta fixa: R$ 1 de diferença já não é o mesmo pagamento", () => {
    expect(compararComPaguei(linha("PIX ENVIADO IMOBILIARIA", 1801), aluguel(), "conta:nubank")).toBeNull();
  });

  it("conta que varia: até 2% casa (com o nome da conta, quase certo; sem, pergunta)", () => {
    expect(compararComPaguei(linha("PAGAMENTO CONTA LUZ ENEL", 185.0, "2026-10-19"), luz(), "conta:nubank")).toBe("certo");
    expect(compararComPaguei(linha("ENEL SP", 185.0, "2026-10-19"), luz(), "conta:nubank")).toBe("duvida");
    expect(compararComPaguei(linha("ENEL SP", 182.4, "2026-10-19"), luz(), "conta:nubank")).toBe("certo");
  });

  it("conta que varia: 3% de diferença não casa", () => {
    expect(compararComPaguei(linha("CONTA LUZ", 187.9, "2026-10-19"), luz(), "conta:nubank")).toBeNull();
  });

  it("outro banco não casa; o genérico com o mesmo valor pergunta (sem o nome)", () => {
    expect(compararComPaguei(linha("PIX ENVIADO IMOBILIARIA", 1800), aluguel(), "conta:itau")).toBeNull();
    expect(compararComPaguei(linha("PIX ENVIADO IMOBILIARIA", 1800), aluguel({ origem: "conta" }), "conta:itau")).toBe("duvida");
    expect(compararComPaguei(linha("ALUGUEL OUTUBRO", 1800), aluguel({ origem: "conta" }), "conta:itau")).toBe("certo");
  });

  it("entrada, estorno ou valor zerado não casam com Paguei", () => {
    expect(compararComPaguei({ ...linha("PIX RECEBIDO", 1800), category: "INCOME" }, aluguel(), "conta:nubank")).toBeNull();
    expect(compararComPaguei(linha("ESTORNO", -1800), aluguel(), "conta:nubank")).toBeNull();
  });
});

describe("o arquivo inteiro", () => {
  it("cada Paguei casa com uma linha só, a mais perto", () => {
    const r = casarComPaguei([linha("PIX ENVIADO IMOBILIARIA", 1800, "2026-10-19", 1), linha("PIX ENVIADO IMOBILIARIA", 1800, "2026-10-15", 2)], [aluguel()], "conta:nubank");
    expect([...r.keys()]).toEqual([2]);
    // Duas linhas possíveis para o mesmo Paguei: ela escolhe.
    expect(r.get(2)?.tipo).toBe("duvida");
  });

  it("dois Paguei e duas linhas: cada um com a sua", () => {
    const r = casarComPaguei(
      [linha("PIX ENVIADO IMOBILIARIA", 1800, "2026-10-15", 1), linha("PAGAMENTO LUZ", 182.4, "2026-10-18", 2), linha("PADARIA", 12, "2026-10-16", 3)],
      [aluguel(), luz()],
      "conta:nubank",
    );
    expect(r.get(1)).toMatchObject({ tipo: "certo", paguei: { id: "p-aluguel" } });
    expect(r.get(2)).toMatchObject({ tipo: "certo", paguei: { id: "p-luz" } });
    expect(r.has(3)).toBe(false);
  });
});

describe("conferência na gravação", () => {
  it("aceita o que casa e recusa um id trocado", () => {
    expect(confirmaOPaguei({ date: "2026-10-17", valor: 1800 }, aluguel())).toBe(true);
    expect(confirmaOPaguei({ date: "2026-10-17", valor: 900 }, aluguel())).toBe(false);
    expect(confirmaOPaguei({ date: "2026-11-17", valor: 1800 }, aluguel())).toBe(false);
    expect(confirmaOPaguei({ date: "2026-10-19", valor: 185 }, luz())).toBe(true);
  });
});
