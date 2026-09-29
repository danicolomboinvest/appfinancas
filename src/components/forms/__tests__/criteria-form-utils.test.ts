import { describe, expect, it } from "vitest";
import { mergeSuggestionsIntoResponses, respostasAlteradas, type ResponseState } from "../criteria-form-utils";

describe("mergeSuggestionsIntoResponses", () => {
  it("fills an empty field with the suggested value", () => {
    const responses: Record<string, ResponseState> = {
      "crit-1": { value: "", score: "", note: "" },
    };
    const { responses: next, newlyFilled } = mergeSuggestionsIntoResponses(responses, [
      { criterionId: "crit-1", value: "12,5%" },
    ]);
    expect(next["crit-1"].value).toBe("12,5%");
    expect(newlyFilled).toEqual(["crit-1"]);
  });

  it("never overwrites a field the user already filled", () => {
    const responses: Record<string, ResponseState> = {
      "crit-1": { value: "valor já preenchido pelo usuário", score: "", note: "" },
    };
    const { responses: next, newlyFilled } = mergeSuggestionsIntoResponses(responses, [
      { criterionId: "crit-1", value: "sugestão da IA" },
    ]);
    expect(next["crit-1"].value).toBe("valor já preenchido pelo usuário");
    expect(newlyFilled).toEqual([]);
  });

  it("ignores suggestions for criteria that don't exist in the current responses", () => {
    const responses: Record<string, ResponseState> = {};
    const { responses: next, newlyFilled } = mergeSuggestionsIntoResponses(responses, [
      { criterionId: "unknown-id", value: "x" },
    ]);
    expect(next).toEqual({});
    expect(newlyFilled).toEqual([]);
  });

  it("applies multiple suggestions in one pass, only where empty", () => {
    const responses: Record<string, ResponseState> = {
      "crit-1": { value: "", score: "", note: "" },
      "crit-2": { value: "já tem valor", score: "", note: "" },
      "crit-3": { value: "", score: "", note: "" },
    };
    const { responses: next, newlyFilled } = mergeSuggestionsIntoResponses(responses, [
      { criterionId: "crit-1", value: "A" },
      { criterionId: "crit-2", value: "B" },
      { criterionId: "crit-3", value: "C" },
    ]);
    expect(next["crit-1"].value).toBe("A");
    expect(next["crit-2"].value).toBe("já tem valor");
    expect(next["crit-3"].value).toBe("C");
    expect(newlyFilled.sort()).toEqual(["crit-1", "crit-3"]);
  });
});

describe("respostasAlteradas", () => {
  const r = (value = "", score = "", note = "") => ({ value, score, note });

  it("não reenvia o que ela não mexeu (o checklist de três toques não volta atrás)", () => {
    // O checklist gravou "vi_algo" no banco; a tela ainda tem o "tranquilo" do carregamento.
    const base = { a: r("tranquilo"), b: r() };
    const atual = { a: r("tranquilo"), b: r("", "7") };
    expect(respostasAlteradas(atual, base, ["a", "b"])).toEqual([{ criterionId: "b", score: 7 }]);
  });

  it("campo apagado vai como null, pra limpar no banco", () => {
    const base = { a: r("Família Setubal", "3", "olhar de novo") };
    const atual = { a: r("", "", "") };
    expect(respostasAlteradas(atual, base, ["a"])).toEqual([{ criterionId: "a", value: null, score: null, note: null }]);
  });

  it("só o campo alterado entra, e nota 0 é nota", () => {
    const base = { a: r("x", "5", "n") };
    expect(respostasAlteradas({ a: r("x", "0", "n") }, base, ["a"])).toEqual([{ criterionId: "a", score: 0 }]);
    expect(respostasAlteradas({ a: r("x ", "5", "n") }, base, ["a"])).toEqual([]);
  });
});
