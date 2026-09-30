import { describe, expect, it } from "vitest";
import {
  accessGrantedEmail,
  alertEmail,
  confirmEmailEmail,
  monthlyNudgeEmail,
  monthlyRecapEmail,
  passwordResetEmail,
  welcomeEmail,
} from "../templates";
import { vozDoTema } from "@/lib/profiles/voice";

/**
 * Nome e textos digitados pela pessoa não viram HTML no e-mail. O cadastro não confirmava o
 * e-mail: alguém punha um link de golpe no nome e ele chegava na caixa de outra pessoa, saindo
 * do remetente do app.
 */
const golpe = '<a href="https://golpe.com">Clique aqui</a>';
const t = vozDoTema("girly").titulos;

describe("templates escapam o que a pessoa digitou", () => {
  // Boas-vindas e senha também usam só o primeiro nome: a frase do golpe nem chega ao e-mail.
  it("boas-vindas", () => {
    const html = welcomeEmail({ name: golpe, appUrl: "https://app.test/login" }).html;
    expect(html).not.toContain("golpe.com");
    expect(html).toContain("Bem-vinda, &lt;a!");
  });

  it("recuperação de senha", () => {
    const html = passwordResetEmail({ name: golpe, resetUrl: "https://app.test/r" }).html;
    expect(html).not.toContain("golpe.com");
    expect(html).toContain("Oi, &lt;a!");
  });

  it("confirmação de e-mail, com o link de confirmar", () => {
    // Só o primeiro nome vai na saudação: o que sobra do golpe é "<a", que tem que sair escapado.
    const { subject, html } = confirmEmailEmail({ name: golpe, confirmUrl: "https://app.test/confirmar-email?t=abc.def" });
    expect(html).not.toContain("golpe.com");
    expect(html).toContain("Oi, &lt;a!");
    expect(subject).toContain("Confirme seu e-mail");
    expect(html).toContain('href="https://app.test/confirmar-email?t=abc.def"');
  });

  it("acesso liberado (e-mail vem do Hubla)", () => {
    const { html } = accessGrantedEmail({ email: '"><b>x</b>@a.com', registerUrl: "https://app.test/register" });
    expect(html).not.toContain("<b>x</b>");
  });

  it("avisos: saudação, título e texto (nome de meta é digitado)", () => {
    const { html } = alertEmail({
      name: `${golpe.replace(/ /g, "")} Silva`,
      alerts: [{ title: `Meta ${golpe} atrasada`, body: `Falta pouco pra ${golpe}`, url: "https://app.test/metas" }],
      preferencesUrl: "https://app.test/configuracoes/notificacoes",
    });
    expect(html).not.toContain("https://golpe.com\">");
    expect(html).toContain("&lt;a");
  });

  it("resumo do mês: saudação e categoria", () => {
    const { html } = monthlyRecapEmail({
      name: "<img src=x>",
      monthLabel: "setembro de 2026",
      income: 1,
      expense: 1,
      investment: 0,
      balance: 0,
      expenseDelta: null,
      topCategory: { label: "<script>x</script>", value: 1 },
      currency: "BRL",
      appUrl: "https://app.test",
      preferencesUrl: "https://app.test/p",
      t,
    });
    expect(html).not.toContain("<img src=x>");
    expect(html).not.toContain("<script>");
  });

  it("convite do mês: saudação", () => {
    const { html } = monthlyNudgeEmail({ name: "<img src=x>", newMonthLabel: "outubro", appUrl: "https://app.test", preferencesUrl: "https://app.test/p", t });
    expect(html).not.toContain("<img src=x>");
  });
});
