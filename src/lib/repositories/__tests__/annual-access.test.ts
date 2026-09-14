import { describe, it, expect } from "vitest";
import { addAccessPeriod, renewedExpiry } from "../allowedEmail.repo";

const d = (iso: string) => new Date(`${iso}T12:00:00`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("addAccessPeriod", () => {
  it("soma um ano na mesma data", () => {
    expect(iso(addAccessPeriod(d("2026-09-14")))).toBe("2027-09-14");
  });

  it("29/02 vira 28/02 (não pula pra 01/03, o que jogaria a renovação pro mês errado)", () => {
    expect(iso(addAccessPeriod(d("2028-02-29")))).toBe("2029-02-28");
  });
});

describe("renewedExpiry", () => {
  it("quem renova ANTES de vencer não perde os dias já pagos", () => {
    // Vence em 01/12/2026 e renova hoje (14/09): ganha até 01/12/2027, não até 14/09/2027.
    expect(iso(renewedExpiry(d("2026-12-01"), d("2026-09-14")))).toBe("2027-12-01");
  });

  it("quem renova DEPOIS de vencido recomeça de hoje, sem retroativo", () => {
    // Venceu em 01/03 e só renovou em 14/09: o ano conta de 14/09, não de 01/03.
    expect(iso(renewedExpiry(d("2026-03-01"), d("2026-09-14")))).toBe("2027-09-14");
  });

  it("primeira compra (sem prazo anterior) dá um ano a partir de hoje", () => {
    expect(iso(renewedExpiry(null, d("2026-09-14")))).toBe("2027-09-14");
  });

  it("renovação sempre empurra o vencimento pra frente, nunca pra trás", () => {
    const now = d("2026-09-14");
    for (const atual of [null, d("2026-01-01"), d("2026-09-14"), d("2027-06-30")]) {
      expect(renewedExpiry(atual, now).getTime()).toBeGreaterThan(now.getTime());
      if (atual) expect(renewedExpiry(atual, now).getTime()).toBeGreaterThan(atual.getTime());
    }
  });
});
