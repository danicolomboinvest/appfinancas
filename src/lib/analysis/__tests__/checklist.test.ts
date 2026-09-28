import { describe, expect, it } from "vitest";
import { notaGuardandoObservacao } from "../checklist";

describe("checklist: não apaga a Observação escrita à mão", () => {
  it("texto antigo na Observação vai pro Comentário antes do toque gravar por cima", () => {
    expect(notaGuardandoObservacao("Família Setubal, sem histórico ruim", null)).toBe("Família Setubal, sem histórico ruim");
    expect(notaGuardandoObservacao("12", "")).toBe("12");
  });

  it("junta com o Comentário que já existia, o texto antigo na frente", () => {
    expect(notaGuardandoObservacao("Família Setubal", "Olhar de novo em 2027")).toBe("Família Setubal\n\nOlhar de novo em 2027");
  });

  it("resposta do checklist ou campo vazio não mexe na nota", () => {
    expect(notaGuardandoObservacao("tranquilo", "qualquer")).toBeUndefined();
    expect(notaGuardandoObservacao(null, "qualquer")).toBeUndefined();
    expect(notaGuardandoObservacao("   ", null)).toBeUndefined();
  });

  it("não duplica o texto se ele já foi guardado na nota", () => {
    expect(notaGuardandoObservacao("Família Setubal", "Família Setubal\n\nOlhar de novo")).toBeUndefined();
  });
});
