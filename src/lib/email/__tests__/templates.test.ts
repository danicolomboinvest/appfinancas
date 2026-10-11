import { describe, expect, it } from "vitest";
import { monthlyRecapEmail, monthlyNudgeEmail } from "../templates";
import { vozDoTema } from "@/lib/profiles/voice";

const padrao = vozDoTema("padrao").titulos;
const girly = vozDoTema("girly").titulos;
const manifestacao = vozDoTema("manifestacao").titulos;

const baseRecap = {
  name: "Dani",
  monthLabel: "setembro de 2026",
  income: 5000,
  expense: 3000,
  investment: 500,
  balance: 1500,
  expenseDelta: -0.12,
  topCategory: { label: "Moradia", value: 1200 },
  currency: "BRL" as const,
  appUrl: "https://app.test/mensal/2026/9",
  preferencesUrl: "https://app.test/configuracoes/notificacoes",
};

const baseNudge = {
  name: "Dani",
  newMonthLabel: "outubro",
  appUrl: "https://app.test/mensal",
  preferencesUrl: "https://app.test/configuracoes/notificacoes",
};

describe("monthlyRecapEmail: cada tema fala diferente sobre o mesmo mês", () => {
  it("o assunto diz a palavra e o número do mês (direção B, 11/10/2026)", () => {
    const { subject, html } = monthlyRecapEmail({ ...baseRecap, t: padrao });
    expect(subject).toBe("Sobrou R$ 1.500 em setembro");
    expect(html).toContain(">Sobrou<");
    expect(html).toContain("Ver o mês completo");
    expect(html).toContain("Setembro de 2026");
  });

  it("o Girly e o Manifestação escrevem coisas diferentes pro mesmo mês", () => {
    const p = monthlyRecapEmail({ ...baseRecap, t: padrao });
    const g = monthlyRecapEmail({ ...baseRecap, t: girly, tema: "girly" });
    const d = monthlyRecapEmail({ ...baseRecap, t: manifestacao, tema: "manifestacao" });
    // O assunto é o mesmo (a palavra e o número); a frase da comparação é do tema.
    expect(new Set([p.subject, g.subject, d.subject]).size).toBe(1);
    expect(g.html).toContain("Arrasou");
    expect(new Set([p.html, g.html, d.html]).size).toBe(3);
    // Sem emoji em tema nenhum desde a versão nova (11/10/2026).
    expect(g.html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(d.html).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("sem base de comparação (primeiro mês), cada tema ainda avisa isso, não quebra", () => {
    const { html } = monthlyRecapEmail({ ...baseRecap, expenseDelta: null, t: girly });
    expect(html).toContain(girly.emailRecapPrimeiroMes);
  });

  it("quem tem mais de um perfil vê de qual perfil são os números (e o nome não vira HTML)", () => {
    const { subject, html } = monthlyRecapEmail({ ...baseRecap, t: padrao, perfil: "Loja <b>" });
    expect(subject).toBe("Sobrou R$ 1.500 em setembro · Loja <b>");
    expect(html).toContain("Perfil Loja &lt;b&gt;");
    const semPerfil = monthlyRecapEmail({ ...baseRecap, t: padrao });
    expect(semPerfil.html).not.toContain("Perfil ");
  });

  it("mês negativo mostra a palavra de falta, não a de sobra", () => {
    const { subject, html } = monthlyRecapEmail({ ...baseRecap, balance: -200, t: padrao });
    expect(subject).toBe("Faltou R$ 200 em setembro");
    expect(html).toContain(">Faltou<");
    expect(html).not.toContain(">Sobrou<");
  });
});

describe("monthlyNudgeEmail: o convite pra quem não usou também muda de tom", () => {
  it("assunto novo, com a primeira letra maiúscula, e as frases do Padrão", () => {
    const { subject, html } = monthlyNudgeEmail({ ...baseNudge, t: padrao });
    expect(subject).toBe("Outubro começou. Um gasto, só um.");
    expect(html).toContain("Anote um gasto de hoje");
    expect(html).toContain("Anotar meu primeiro gasto");
  });

  it("Manifestação convida diferente do Padrão", () => {
    const { html } = monthlyNudgeEmail({ ...baseNudge, t: manifestacao, tema: "manifestacao" });
    expect(html).not.toBe(monthlyNudgeEmail({ ...baseNudge, t: padrao }).html);
    expect(html).toContain("Registrar meu primeiro passo");
  });
});
