import { describe, expect, it } from "vitest";
import { detectDocKind } from "../detect";
import { isSantanderConsolidatedStatement, parseSantanderConsolidatedStatement } from "../santander-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do "Extrato Consolidado Inteligente" do Santander em
 * PDF: palavras quebradas no meio, dia só no primeiro lançamento de cada dia, descrição descendo
 * por linhas, sinal de débito no fim do valor, saldo às vezes na mesma linha, cabeçalho de página
 * no meio da movimentação e o quadro de compras/comprovantes depois (que NÃO é movimento).
 */
const SANTANDER = [
  "EXT R ATO CO N S O LID AD O IN TE LIGE N TE",
  "janei r o / 2026",
  "E xtrato_P F _A4_Inteligente - 27 / 11 / 2024",
  "P agina: 1 / 3",
  "D epósitos / T r ansfe r ências \t50,00",
  "S alá r io e Pr oventos \t2.500,00",
  "Paga m entos / T r ansfe r ências \t1.330,00",
  "Movi m entação",
  "02 / 01 \tLIQ U ID O D E VE N CIME N TO EMP R ESA EXEMPLO \t010102 \t2.500,00",
  "PIX E N VIAD O",
  "Joana de Exe m plo",
  "- \t1.200,00-",
  "PIX E N VIAD O LOJA FICTICIA L T D A \t- \t30,00- \t1.270,00",
  "",
  "-- 1 of 3 --",
  "",
  "EXT R ATO CO N S O LID AD O IN TE LIGE N TE",
  "janei r o / 2026",
  "P agina: 2 / 3",
  "15 / 01 \tD EBITO VISA E L ECT R O N BR ASIL",
  "14 / 01 PADA R IA MODELO",
  "123456 \t100,00- \t1.170,00",
  "20 / 01 \tPIX R ECEBID O",
  "CA R LOS FICTICIO",
  "- \t50,00",
  "R EM UN E R ACAO APLICACAO AU TOMATICA \t- \t0,00 \t1.220,00",
  "S e você não tem L imite da Conta e a sua conta ficou com saldo devedor, terá sido prestado",
  "S aldos por Pe r íodo",
  "02 \t1.270,00 \t0,00 \t0,00 \t1.270,00",
  "Co m pr as com Ca r tão de D ébito",
  "14 / 01 \t1234.5678 \tPADA R IA MODELO \t100,00",
].join("\n");

describe("extrato consolidado do Santander (PDF)", () => {
  it("reconhece o arquivo mesmo com as palavras quebradas", () => {
    expect(isSantanderConsolidatedStatement(SANTANDER)).toBe(true);
    expect(isSantanderConsolidatedStatement("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
    expect(detectDocKind(SANTANDER).kind).toBe("extrato");
  });

  it("lê cada lançamento com o dia herdado, a descrição inteira e o sinal escrito", () => {
    const txns = parseSantanderConsolidatedStatement(SANTANDER);
    expect(txns).toEqual([
      { date: "2026-01-02", description: "LIQ U ID O D E VE N CIME N TO EMP R ESA EXEMPLO", amount: 2500 },
      { date: "2026-01-02", description: "PIX E N VIAD O Joana de Exe m plo", amount: -1200 },
      { date: "2026-01-02", description: "PIX E N VIAD O LOJA FICTICIA L T D A", amount: -30 },
      { date: "2026-01-15", description: "D EBITO VISA E L ECT R O N BR ASIL 14 / 01 PADA R IA MODELO", amount: -100 },
      { date: "2026-01-20", description: "PIX R ECEBID O CA R LOS FICTICIO", amount: 50 },
    ]);
  });

  it("fecha com o resumo do próprio extrato e ignora saldos e quadros depois da movimentação", () => {
    const txns = parseStatement(SANTANDER, "pdf", 2026);
    const entradas = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const saidas = txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
    expect(entradas).toBeCloseTo(2550, 2);
    expect(saidas).toBeCloseTo(1330, 2);
  });

  it("dia de dezembro num extrato de janeiro fica no ano anterior", () => {
    const virada = SANTANDER.replace("02 / 01 \tLIQ", "31 / 12 \tLIQ");
    expect(parseSantanderConsolidatedStatement(virada)[0].date).toBe("2025-12-31");
  });
});

/** Modelo "Básico" (FICTÍCIO): título só "Extrato Consolidado", rodapé Extrato_PF_A4_Basico,
 * saldo inicial e final na própria movimentação. */
const SANTANDER_BASICO = [
  "EXT R ATO CO N S O LID AD O",
  "sete m b r o / 2026",
  "E xtrato_P F _A4_B asico - 26 / 11 / 2024",
  "P agina: 1 / 3",
  "Prezada Fulana,",
  "",
  "-- 1 of 3 --",
  "",
  "E xtrato_P F _A4_B asico - 26 / 11 / 2024",
  "P agina: 2 / 3",
  "(=) \tS aldo de Conta Co rr ente e m 31 / 08 \t100,00",
  "Movi m entação",
  "SAL D O EM 31 / 08 \t100,00",
  "01 / 09 \tIOF IMPO S TO OPE R ACOE S FIN AN CEIR AS",
  "- \t0,04-",
  "17 / 09 \tD EBITO AU T. CO N TA D E TE L EFO N E",
  "OPERADORA EXEMPLO",
  "- \t150,00-",
  "R EM UN E R ACAO APLICACAO AU TOMATICA \t- \t0,01 \t50,03-",
  "21 / 09 \tPIX R ECEBID O",
  "Fulana de Exe m plo",
  "- \t200,00 \t149,97",
  "SAL D O EM 30 / 09 \t149,97",
  "S aldos por Pe r íodo",
  "01 \t99,96 \t0,00",
].join("\n");

describe("extrato consolidado do Santander, modelo Básico", () => {
  it("reconhece e fecha com o saldo inicial e final", () => {
    expect(isSantanderConsolidatedStatement(SANTANDER_BASICO)).toBe(true);
    const txns = parseStatement(SANTANDER_BASICO, "pdf");
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-09-01", -0.04],
      ["2026-09-17", -150],
      ["2026-09-17", 0.01],
      ["2026-09-21", 200],
    ]);
    const soma = txns.reduce((s, t) => s + t.amount, 0);
    expect(Math.round(soma * 100) / 100).toBe(49.97);
  });
});
