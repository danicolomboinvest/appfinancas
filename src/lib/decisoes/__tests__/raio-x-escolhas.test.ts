import { describe, expect, it } from "vitest";
import { resumoDasEscolhas, type RaioXItem } from "../raio-x";

const item = (chave: string, mensal: number, tipo: RaioXItem["tipo"] = "assinatura"): RaioXItem => ({ chave, nome: chave, mensal, anual: mensal * 12, meses: 5, tipo, vezesPorMes: 1 });
/** As três assinaturas da Ana: R$ 82,70 por mês, R$ 992 por ano (ana-canonica.md). */
const ana = [item("netflix", 55.9), item("spotify", 21.9), item("icloud", 4.9)];

describe("Raio-X: Cancelar e Manter (rodada 38 C)", () => {
  it("sem escolha: tudo aberto, R$ 992 por ano juntos", () => {
    const r = resumoDasEscolhas(ana, {});
    expect(Math.round(r.totalAnual)).toBe(992);
    expect(r.abertos).toHaveLength(3);
    expect(r.economiaAnual).toBe(0);
    expect(r.pronto).toBe(false);
  });

  it("1 cancelado e 1 mantido: economiza só o cancelado, o mantido sai dos abertos", () => {
    const r = resumoDasEscolhas(ana, { netflix: "raiox_cancelar", spotify: "raiox_manter" });
    expect(Math.round(r.economiaAnual)).toBe(671);
    expect(r.cortados.map((i) => i.chave)).toEqual(["netflix"]);
    expect(r.mantidos.map((i) => i.chave)).toEqual(["spotify"]);
    expect(r.abertos.map((i) => i.chave)).toEqual(["icloud"]);
    expect(Math.round(r.economiaEmCincoAnos)).toBeGreaterThan(671 * 5);
  });

  it("todos decididos: pronto, e a economia soma os cancelados (cortar pela metade conta metade)", () => {
    const r = resumoDasEscolhas([...ana, item("ifood", 120, "habito")], { netflix: "raiox_cancelar", spotify: "raiox_cancelar", icloud: "raiox_manter", ifood: "raiox_metade" });
    expect(r.pronto).toBe(true);
    expect(Math.round(r.economiaAnual)).toBe(Math.round((55.9 + 21.9) * 12 + 60 * 12));
  });

  it("Desfazer volta o item para os abertos", () => {
    const escolhas: Record<string, "raiox_cancelar" | undefined> = { netflix: "raiox_cancelar" };
    delete escolhas.netflix;
    expect(resumoDasEscolhas(ana, escolhas).abertos).toHaveLength(3);
  });
});
