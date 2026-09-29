import { describe, it, expect } from "vitest";
import { decideRecapEmail, escolherPerfilDoResumo, MAX_NUDGES, type RecapCandidate } from "../recap-audience";

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

describe("escolherPerfilDoResumo", () => {
  it("perfil ativo com lançamento no mês é o do resumo", () => {
    expect(escolherPerfilDoResumo([{ profileId: "pessoal", lancamentos: 3 }, { profileId: "empresa", lancamentos: 40 }], "pessoal")).toBe("pessoal");
  });

  it("lançou tudo no Pessoal e terminou o mês na Empresa vazia: o resumo é do Pessoal, não zerado", () => {
    expect(escolherPerfilDoResumo([{ profileId: "pessoal", lancamentos: 25 }], "empresa")).toBe("pessoal");
  });

  it("perfil ativo vazio e dois com movimento: vence o que tem mais lançamentos", () => {
    expect(
      escolherPerfilDoResumo([{ profileId: "casal", lancamentos: 4 }, { profileId: "pessoal", lancamentos: 12 }, { profileId: "empresa", lancamentos: 0 }], "empresa"),
    ).toBe("pessoal");
  });

  it("sem movimento em perfil nenhum (ou só lançamento antigo sem perfil): não há resumo", () => {
    expect(escolherPerfilDoResumo([], "pessoal")).toBeNull();
    expect(escolherPerfilDoResumo([{ profileId: null, lancamentos: 7 }], "pessoal")).toBeNull();
  });
});
