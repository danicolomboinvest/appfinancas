import { describe, expect, it } from "vitest";
import { parseWizardNumber } from "../wizard-number";

describe("parseWizardNumber", () => {
  it("accepts comma and dot as the decimal separator", () => {
    expect(parseWizardNumber("10,5")).toBe(10.5);
    expect(parseWizardNumber("10.5")).toBe(10.5);
    expect(parseWizardNumber("0,8")).toBe(0.8);
    expect(parseWizardNumber("4.5")).toBe(4.5);
  });

  // No meio da digitação: "10," e "10." já valem 10 (não zeram o campo), e o que ainda não é
  // número volta null para o campo não gravar nada.
  it("keeps partial typing without turning it into zero", () => {
    expect(parseWizardNumber("10,")).toBe(10);
    expect(parseWizardNumber("10.")).toBe(10);
    expect(parseWizardNumber("0.")).toBe(0);
    expect(parseWizardNumber("")).toBeNull();
    expect(parseWizardNumber("  ")).toBeNull();
    expect(parseWizardNumber("-")).toBeNull();
    expect(parseWizardNumber(",")).toBeNull();
    expect(parseWizardNumber("abc")).toBeNull();
  });

  it("treats the dot as thousands only when there is also a comma", () => {
    expect(parseWizardNumber("1.234,5")).toBe(1234.5);
    expect(parseWizardNumber("1.234")).toBe(1.234);
  });

  it("accepts zero and negatives", () => {
    expect(parseWizardNumber("0")).toBe(0);
    expect(parseWizardNumber("-2,5")).toBe(-2.5);
  });
});
