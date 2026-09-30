import { describe, expect, it } from "vitest";
import { boasVindasEmail, lembreteContaDia1Email, lembreteContaDia4Email, vazioDia2Email, vazioDia5Email } from "../boas-vindas";

const todos = [
  lembreteContaDia1Email({ email: "camila@exemplo.com", registerUrl: "https://app.test/register" }),
  lembreteContaDia4Email({ email: "camila@exemplo.com", registerUrl: "https://app.test/register" }),
  boasVindasEmail({ name: "Camila Souza", appUrl: "https://app.test/mensal", guiaUrl: "https://app.test/guia" }),
  vazioDia2Email({ name: "Camila", appUrl: "https://app.test/mensal" }),
  vazioDia5Email({ name: "Camila", appUrl: "https://app.test/mensal" }),
];

describe("e-mails de boas-vindas: o texto que a Dani aprovou em 30/09/2026", () => {
  it("assuntos aprovados", () => {
    expect(todos.map((e) => e.subject)).toEqual([
      "Seu SPI Finance está esperando você",
      "Falta só um passo para você entrar",
      "Seu primeiro minuto no SPI Finance",
      "Um gasto. Só um.",
      "Posso te ajudar a começar?",
    ]);
  });
  it("sem travessão (é a voz dela) e sem falar de garantia ou reembolso", () => {
    for (const e of todos) {
      expect(e.html).not.toMatch(/—/);
      expect(e.html.toLowerCase()).not.toMatch(/garantia|reembolso|devolv/);
    }
  });
  it("chama pelo primeiro nome, e sem nome não quebra", () => {
    expect(todos[2].html).toContain("Oi, Camila!");
    expect(boasVindasEmail({ name: null, appUrl: "u", guiaUrl: "g" }).html).toContain("Oi!");
    expect(todos[4].html).toContain("Oi, Camila.");
  });
  it("o lembrete de conta mostra o e-mail que está liberado e leva ao cadastro", () => {
    expect(todos[0].html).toContain("camila@exemplo.com");
    expect(todos[0].html).toContain("https://app.test/register");
  });
  it("nome e e-mail que vêm de fora não viram HTML", () => {
    const e = boasVindasEmail({ name: '<a href="x">Golpe</a>', appUrl: "u", guiaUrl: "g" });
    expect(e.html).not.toContain('<a href="x">');
    const c = lembreteContaDia1Email({ email: "<b>x</b>@y.com", registerUrl: "r" });
    expect(c.html).not.toContain("<b>x</b>");
  });
});
