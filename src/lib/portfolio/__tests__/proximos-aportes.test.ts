import { describe, expect, it } from "vitest";
import { dividirProximoAporte } from "../proximos-aportes";

const NOMES = { RENDA_FIXA_POS_FIXADA: "Renda fixa pós", RENDA_FIXA_IPCA: "IPCA+", PREFIXADO: "Prefixado", ACOES_BRASIL: "Ações", FIIS: "FIIs", EXTERIOR: "Exterior", OUTROS: "Outros" };
/** A carteira da Ana com a estratégia Moderada. */
const ANA = [
  { assetClass: "RENDA_FIXA_POS_FIXADA" as const, currentValue: 13929, targetPercent: 0.35 },
  { assetClass: "RENDA_FIXA_IPCA" as const, currentValue: 6180, targetPercent: 0.2 },
  { assetClass: "PREFIXADO" as const, currentValue: 0, targetPercent: 0.05 },
  { assetClass: "ACOES_BRASIL" as const, currentValue: 6832, targetPercent: 0.15 },
  { assetClass: "FIIS" as const, currentValue: 7978, targetPercent: 0.15 },
  { assetClass: "EXTERIOR" as const, currentValue: 6650.51, targetPercent: 0.1 },
  { assetClass: "OUTROS" as const, currentValue: 0, targetPercent: 0 },
];
const soma = (d: ReturnType<typeof dividirProximoAporte>) => Math.round((d.reserva + d.classes.reduce((s, c) => s + c.valor, 0)) * 100) / 100;

describe("Seus próximos aportes", () => {
  it("reserva primeiro: com menos de 3 meses (Ana, 0,6 mês), os R$ 900 vão todos para a reserva", () => {
    const d = dividirProximoAporte({ valor: 900, posicoes: ANA, mesesDeReserva: 0.6, reservaCompleta: false, nomes: NOMES });
    expect(d.reserva).toBe(900);
    expect(d.classes).toEqual([]);
    expect(d.porque).toBe("Sua reserva cobre 0,6 mês. Até 3 meses, todo aporte vai para ela.");
  });

  it("reserva completa: vai para as classes mais abaixo do alvo, sem vender nada", () => {
    const d = dividirProximoAporte({ valor: 900, posicoes: ANA, mesesDeReserva: 6, reservaCompleta: true, nomes: NOMES });
    expect(d.reserva).toBe(0);
    expect(soma(d)).toBe(900);
    expect(d.classes.every((c) => c.valor > 0)).toBe(true);
    // Exterior e FIIs estão acima do alvo: não recebem.
    expect(d.classes.map((c) => c.classe)).not.toContain("EXTERIOR");
    expect(d.classes.map((c) => c.classe)).not.toContain("FIIS");
    expect(d.porque).toBe("IPCA+ está 5 pontos abaixo do seu alvo.");
    // Só recebe quem está abaixo do alvo.
    for (const c of d.classes) expect(c.hoje).toBeLessThan(c.alvo);
  });

  it("de 3 meses até a meta: 70% reserva, 30% para as classes", () => {
    const d = dividirProximoAporte({ valor: 1000, posicoes: ANA, mesesDeReserva: 4, reservaCompleta: false, nomes: NOMES });
    expect(d.reserva).toBe(700);
    expect(soma(d)).toBe(1000);
  });

  it("já no alvo: divide pelos pesos do alvo", () => {
    const noAlvo = ANA.map((p) => ({ ...p, currentValue: p.targetPercent * 10000 }));
    const d = dividirProximoAporte({ valor: 1000, posicoes: noAlvo, mesesDeReserva: 6, reservaCompleta: true, nomes: NOMES });
    expect(soma(d)).toBe(1000);
    const pos = d.classes.find((c) => c.classe === "RENDA_FIXA_POS_FIXADA")!.valor;
    expect(pos).toBeGreaterThanOrEqual(340);
    expect(pos).toBeLessThanOrEqual(360);
    expect(d.porque).toBe("Tudo no alvo: o aporte segue os pesos da sua estratégia.");
  });

  it("soma sempre igual ao aporte e nunca negativa, para vários valores", () => {
    for (const valor of [0, 1, 37.5, 250, 999.99, 12345]) {
      for (const meses of [0.5, 3.5, 7]) {
        const d = dividirProximoAporte({ valor, posicoes: ANA, mesesDeReserva: meses, reservaCompleta: meses >= 7, nomes: NOMES });
        expect(soma(d)).toBe(Math.round(valor * 100) / 100);
        expect(d.reserva).toBeGreaterThanOrEqual(0);
        for (const c of d.classes) expect(c.valor).toBeGreaterThan(0);
      }
    }
  });
});
