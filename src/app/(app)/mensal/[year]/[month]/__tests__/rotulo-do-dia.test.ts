import { describe, expect, it } from "vitest";
import { rotuloDoDia } from "../rotulo-do-dia";

describe("rotuloDoDia", () => {
  it("dia do mês da lista: só o dia", () => expect(rotuloDoDia("2026-10-12", "2026-10-14", "2026-10")).toBe("Segunda 12"));
  it("compra de 29/09 na lista de outubro leva o mês", () => expect(rotuloDoDia("2026-09-29", "2026-10-14", "2026-10")).toBe("Terça 29 de setembro"));
  it("dezembro na lista de janeiro leva o ano", () => expect(rotuloDoDia("2025-12-30", "2026-01-14", "2026-01")).toBe("Terça 30 de dezembro de 2025"));
  it("a vencer continua igual", () => expect(rotuloDoDia("2026-10-25", "2026-10-14", "2026-10")).toBe("Domingo 25, a vencer"));
});
