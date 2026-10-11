import { describe, expect, it } from "vitest";
import { decidirSaida } from "../cancelamento";

const agora = new Date("2026-10-11T12:00:00Z");

describe("saída sem reembolso: o acesso fica até o vencimento", () => {
  it("com prazo no futuro, mantém (o cron desliga depois)", () => {
    expect(decidirSaida({ active: true, expiresAt: new Date("2027-03-15T03:00:00Z") }, agora)).toBe("manter");
  });
  it("já vencida ou sem prazo, desliga na hora", () => {
    expect(decidirSaida({ active: true, expiresAt: new Date("2026-10-01T03:00:00Z") }, agora)).toBe("desligar");
    expect(decidirSaida({ active: true, expiresAt: null }, agora)).toBe("desligar");
  });
  it("já desligada, nada muda", () => {
    expect(decidirSaida({ active: false, expiresAt: new Date("2027-03-15T03:00:00Z") }, agora)).toBe("nada");
  });
});
