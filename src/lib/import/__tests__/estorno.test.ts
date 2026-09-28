import { describe, expect, it } from "vitest";
import { pareceEstorno } from "../estorno";

describe("pareceEstorno", () => {
  it("reconhece os jeitos que os bancos escrevem estorno", () => {
    for (const d of ["ESTORNO COMPRA MAGAZINE", "Estorno de Pix", "Reembolso iFood", "DEVOLUÇÃO DE COMPRA", "Devolucao Mercado Livre", "Compra cancelada - Netflix", "CHARGEBACK AMAZON", "Crédito de compra"]) {
      expect(pareceEstorno(d)).toBe(true);
    }
  });
  it("não confunde entrada comum com estorno", () => {
    for (const d of ["Salário", "Pix recebido - Maria", "Crédito em conta", "Rendimento", "TED recebida", "Resgate RDB", null]) {
      expect(pareceEstorno(d)).toBe(false);
    }
  });
});
