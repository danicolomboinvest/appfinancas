import { describe, expect, it } from "vitest";
import { aceiteDeixaAviso, mensagemDoCriarNosDoisComCasa, mostraAvisoDoCasalNoPessoal, textosDoAvisoDoCasalNoPessoal } from "../aviso-casal-no-pessoal";

/**
 * Caso de 27/10/2026: o par aceitou, o que a titular montou no Casal foi para o Pessoal dela sem
 * aviso, e ela refez tudo num Nós dois novo. O aviso é uma vez, só para a titular, só quando o
 * aceite moveu algo.
 */
describe("quem vê o aviso e quando ele some", () => {
  it("a titular, no Pessoal dela na casa, enquanto a Decisao do aceite está sem resposta", () => {
    expect(mostraAvisoDoCasalNoPessoal({ naCasa: true, papel: "titular", pendente: true })).toBe(true);
  });
  it("depois do Entendi (resolvida) não volta", () => {
    expect(mostraAvisoDoCasalNoPessoal({ naCasa: true, papel: "titular", pendente: false })).toBe(false);
  });
  it("o par nunca vê (nada dele foi movido); fora da casa, na Empresa, também não", () => {
    expect(mostraAvisoDoCasalNoPessoal({ naCasa: true, papel: "par", pendente: true })).toBe(false);
    expect(mostraAvisoDoCasalNoPessoal({ naCasa: false, papel: null, pendente: true })).toBe(false);
  });
  it("o aceite só deixa o aviso quando levou alguma coisa do Casal para o Pessoal", () => {
    expect(aceiteDeixaAviso(128)).toBe(true);
    expect(aceiteDeixaAviso(1)).toBe(true);
    expect(aceiteDeixaAviso(0)).toBe(false);
  });
});

describe("o texto do cartão e a linha do Criar Nós dois", () => {
  it("duas frases, com o nome do par, dizendo onde está o que ela montou", () => {
    const tx = textosDoAvisoDoCasalNoPessoal("Lucas");
    expect(tx.titulo).toBe("Lucas entrou");
    expect(tx.texto).toContain("no seu Pessoal");
    expect(tx.texto).toContain("Lucas");
    expect(tx.texto.split(/\.\s/).length).toBeLessThanOrEqual(2);
    expect(tx.entendi).toBe("Entendi");
  });
  it("sem nome, fala em 'Seu par'", () => {
    expect(textosDoAvisoDoCasalNoPessoal("  ").titulo).toBe("Seu par entrou");
  });
  it("'Criar Nós dois' com a casa ligada explica em uma linha, sem 'já existe'", () => {
    const m = mensagemDoCriarNosDoisComCasa("Lucas");
    expect(m).toContain("Lucas");
    expect(m).toContain("Configurações › Casa");
    expect(m).not.toMatch(/já existe/);
  });
  it("sem travessão nem emoji", () => {
    const textos = [...Object.values(textosDoAvisoDoCasalNoPessoal("Lucas")), mensagemDoCriarNosDoisComCasa("Lucas")];
    for (const t of textos) {
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
