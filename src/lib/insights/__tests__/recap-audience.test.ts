import { describe, it, expect } from "vitest";
import { decideRecapEmail, MAX_NUDGES, type RecapCandidate } from "../recap-audience";

const base: RecapCandidate = {
  hasActivityInMonth: false,
  alreadySentThisMonth: false,
  wantsEmail: true,
  nudgeCount: 0,
  existedBeforeMonth: true,
};
const decide = (p: Partial<RecapCandidate>) => decideRecapEmail({ ...base, ...p });

describe("decideRecapEmail", () => {
  it("usou o app no mês → recebe o resumo", () => {
    expect(decide({ hasActivityInMonth: true })).toBe("resumo");
  });

  it("não usou → recebe o convite pra começar", () => {
    expect(decide({})).toBe("convite");
  });

  it("quem desligou o e-mail não recebe nada, nem resumo nem convite", () => {
    expect(decide({ wantsEmail: false, hasActivityInMonth: true })).toBe("nada");
    expect(decide({ wantsEmail: false })).toBe("nada");
  });

  it("nunca manda duas vezes no mesmo mês (cron pode repetir)", () => {
    expect(decide({ alreadySentThisMonth: true, hasActivityInMonth: true })).toBe("nada");
    expect(decide({ alreadySentThisMonth: true })).toBe("nada");
  });

  it("conta criada dentro do mês não leva cobrança de um mês que ela mal viu", () => {
    expect(decide({ existedBeforeMonth: false })).toBe("nada");
  });

  it("para de insistir depois do limite de convites", () => {
    expect(decide({ nudgeCount: MAX_NUDGES - 1 })).toBe("convite");
    expect(decide({ nudgeCount: MAX_NUDGES })).toBe("nada");
    expect(decide({ nudgeCount: MAX_NUDGES + 5 })).toBe("nada");
  });

  it("quem passou a usar volta a receber resumo, mesmo tendo esgotado os convites", () => {
    expect(decide({ nudgeCount: 99, hasActivityInMonth: true })).toBe("resumo");
  });
});
