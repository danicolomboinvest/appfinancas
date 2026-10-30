import { describe, it, expect } from "vitest";
import {
  decideRecapEmail,
  escolherPerfilDoResumo,
  MAX_NUDGES,
  mesFechadoDaPessoa,
  podeEnviarResumoHoje,
  type RecapCandidate,
} from "../recap-audience";

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

describe("podeEnviarResumoHoje", () => {
  it("envia só nos dias 1 a 3 (o cron roda todo dia)", () => {
    expect(podeEnviarResumoHoje(1, { dryRun: false })).toBe(true);
    expect(podeEnviarResumoHoje(3, { dryRun: false })).toBe(true);
    expect(podeEnviarResumoHoje(4, { dryRun: false })).toBe(false);
    // O caso do deploy no dia 30: não pode mandar o resumo do mês retrasado.
    expect(podeEnviarResumoHoje(30, { dryRun: false, onlyEmail: null })).toBe(false);
  });

  it("dryRun e onlyEmail (teste manual) passam em qualquer dia", () => {
    expect(podeEnviarResumoHoje(20, { dryRun: true })).toBe(true);
    expect(podeEnviarResumoHoje(20, { dryRun: false, onlyEmail: "a@b.com" })).toBe(true);
  });
});

describe("mesFechadoDaPessoa", () => {
  it("sem dia escolhido (nulo ou 1): o mês anterior ao de hoje, e o dia é o do calendário, como sempre", () => {
    for (const dia of [null, 1]) {
      const r = mesFechadoDaPessoa(new Date(2026, 10, 2, 12), dia);
      expect([r.year, r.month, r.monthKey, r.dia]).toEqual([2026, 10, "2026-10", 2]);
      expect([r.periodo.inicioIso, r.periodo.fimIso]).toEqual(["2026-10-01", "2026-10-31"]);
      expect(r.agora).toEqual({ year: 2026, month: 11 });
      expect(r.periodo.inicio).toEqual(new Date(2026, 9, 1));
    }
    // Virada do ano.
    expect(mesFechadoDaPessoa(new Date(2027, 0, 1, 12), null)).toMatchObject({ year: 2026, month: 12, monthKey: "2026-12", dia: 1 });
    // Dia 15 do calendário: fora dos dias 1 a 3.
    expect(podeEnviarResumoHoje(mesFechadoDaPessoa(new Date(2026, 10, 15, 12), null).dia, { dryRun: false })).toBe(false);
  });

  it("dia 15: em 15/11 fechou outubro (15/10 a 14/11) e é o dia 1 do novembro dela; em 02/11 ainda é o dia 19 de outubro", () => {
    const r = mesFechadoDaPessoa(new Date(2026, 10, 15, 12), 15);
    expect([r.year, r.month, r.monthKey, r.dia]).toEqual([2026, 10, "2026-10", 1]);
    expect([r.periodo.inicioIso, r.periodo.fimIso]).toEqual(["2026-10-15", "2026-11-14"]);
    expect(r.agora).toEqual({ year: 2026, month: 11 });
    expect(podeEnviarResumoHoje(r.dia, { dryRun: false })).toBe(true);
    expect(podeEnviarResumoHoje(mesFechadoDaPessoa(new Date(2026, 10, 17, 12), 15).dia, { dryRun: false })).toBe(true);
    expect(podeEnviarResumoHoje(mesFechadoDaPessoa(new Date(2026, 10, 18, 12), 15).dia, { dryRun: false })).toBe(false);
    // Dia 1 do calendário não é virada para ela: setembro dela (15/09 a 14/10) já saiu em 15/10.
    const em2 = mesFechadoDaPessoa(new Date(2026, 10, 2, 12), 15);
    expect([em2.year, em2.month, em2.dia]).toEqual([2026, 9, 19]);
    expect(podeEnviarResumoHoje(em2.dia, { dryRun: false })).toBe(false);
  });
});
