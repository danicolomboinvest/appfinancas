import { describe, expect, it } from "vitest";
import {
  VALIDADE_DO_CONVITE_MS,
  decidirTela,
  diasRestantes,
  estadoDoConvite,
  frasesDosTermos,
  letraDoPar,
  limparNomeDoPar,
  mensagemDoConvite,
  prazoDoConvite,
  telaDeixaAceitar,
  type DadosDaTela,
} from "../regras";
import { gerarTokenDoConvite, hashDoToken, limparToken, tokenTemFormato } from "../token";

const CRIADO = new Date("2026-10-11T17:00:00Z");
const PRAZO = prazoDoConvite(CRIADO);

describe("o código do link", () => {
  it("tem 43 caracteres seguros para URL, e cada um é diferente", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { token, hash } = gerarTokenDoConvite();
      expect(tokenTemFormato(token)).toBe(true);
      expect(hash).toBe(hashDoToken(token));
      expect(hash).not.toContain(token);
      vistos.add(token);
    }
    expect(vistos.size).toBe(200);
  });

  it("recusa código cortado, comprido demais ou com caractere estranho", () => {
    const { token } = gerarTokenDoConvite();
    expect(tokenTemFormato(token.slice(0, 30))).toBe(false);
    expect(tokenTemFormato(`${token}a`)).toBe(false);
    expect(tokenTemFormato(`${token.slice(0, 42)}+`)).toBe(false);
    expect(tokenTemFormato(undefined)).toBe(false);
  });

  it("limpa a sujeira que vem no copiar e colar (espaço, ponto final, aspas) sem consertar código errado", () => {
    const { token } = gerarTokenDoConvite();
    expect(limparToken(` ${token}. `)).toBe(token);
    expect(limparToken(`"${token}"`)).toBe(token);
    expect(limparToken(encodeURIComponent(token))).toBe(token);
    expect(tokenTemFormato(limparToken("abc%"))).toBe(false);
  });
});

describe("o prazo de 7 dias", () => {
  it("vale até o instante do prazo; no prazo e depois, venceu", () => {
    expect(PRAZO.getTime() - CRIADO.getTime()).toBe(VALIDADE_DO_CONVITE_MS);
    expect(estadoDoConvite({ status: "aberto", expiraEm: PRAZO }, new Date(PRAZO.getTime() - 1))).toBe("aberto");
    expect(estadoDoConvite({ status: "aberto", expiraEm: PRAZO }, PRAZO)).toBe("vencido");
    expect(estadoDoConvite({ status: "aberto", expiraEm: PRAZO }, new Date(PRAZO.getTime() + 86_400_000))).toBe("vencido");
  });

  it("aceito, cancelado e trocado não viram 'vencido' com o tempo; status estranho conta como cancelado", () => {
    const depois = new Date(PRAZO.getTime() + 1);
    expect(estadoDoConvite({ status: "aceito", expiraEm: PRAZO }, depois)).toBe("aceito");
    expect(estadoDoConvite({ status: "cancelado", expiraEm: PRAZO }, depois)).toBe("cancelado");
    expect(estadoDoConvite({ status: "substituido", expiraEm: PRAZO }, depois)).toBe("substituido");
    expect(estadoDoConvite({ status: "???", expiraEm: PRAZO }, CRIADO)).toBe("cancelado");
  });

  it("dias que faltam: 7 logo depois de criar, 1 no último dia, 0 vencido", () => {
    expect(diasRestantes(PRAZO, new Date(CRIADO.getTime() + 60_000))).toBe(7);
    expect(diasRestantes(PRAZO, new Date(PRAZO.getTime() - 3_600_000))).toBe(1);
    expect(diasRestantes(PRAZO, PRAZO)).toBe(0);
  });
});

const BASE: DadosDaTela = {
  convite: { status: "aberto", expiraEm: PRAZO, userId: "ana", profileId: "casal", aceitoPorId: null },
  agora: new Date(CRIADO.getTime() + 3_600_000),
  casalValendo: true,
  parAtivoDoPerfil: null,
  visitante: null,
};

describe("cada situação do link tem a sua tela", () => {
  it("sem login: entrar", () => expect(decidirTela(BASE)).toBe("entrar"));
  it("código que não existe", () => expect(decidirTela({ ...BASE, convite: null })).toBe("invalido"));
  it("vencido", () => expect(decidirTela({ ...BASE, agora: PRAZO })).toBe("vencido"));
  it("já usado", () => expect(decidirTela({ ...BASE, convite: { ...BASE.convite!, status: "aceito", aceitoPorId: "lucas" } })).toBe("usado"));
  it("cancelado pela titular", () => expect(decidirTela({ ...BASE, convite: { ...BASE.convite!, status: "cancelado" } })).toBe("cancelado"));
  it("trocado no Mandar de novo", () => expect(decidirTela({ ...BASE, convite: { ...BASE.convite!, status: "substituido" } })).toBe("substituido"));
  it("Casal da titular parado", () => expect(decidirTela({ ...BASE, casalValendo: false })).toBe("casal-inativo"));
  it("o Nós dois já tem par", () => expect(decidirTela({ ...BASE, parAtivoDoPerfil: "outro" })).toBe("ja-tem-par"));
  it("a própria titular abriu o link", () => expect(decidirTela({ ...BASE, visitante: { userId: "ana", casalAtivoProfileId: null } })).toBe("e-a-titular"));
  it("logado com outra conta: aceitar com ela (ou trocar)", () => expect(decidirTela({ ...BASE, visitante: { userId: "beto", casalAtivoProfileId: null } })).toBe("aceitar-logado"));
  it("logado com quem já é par em outro casal", () => expect(decidirTela({ ...BASE, visitante: { userId: "beto", casalAtivoProfileId: "outro-casal" } })).toBe("em-outro-casal"));
  it("quem já entrou e abre o link de novo vai direto", () => {
    expect(decidirTela({ ...BASE, convite: { ...BASE.convite!, status: "aceito" }, parAtivoDoPerfil: "lucas", visitante: { userId: "lucas", casalAtivoProfileId: "casal" } })).toBe("ja-esta-aqui");
    // Mesmo com o link vencido depois de ter entrado.
    expect(decidirTela({ ...BASE, agora: PRAZO, parAtivoDoPerfil: "lucas", visitante: { userId: "lucas", casalAtivoProfileId: "casal" } })).toBe("ja-esta-aqui");
  });
  it("só 'entrar' e 'aceitar logado' deixam aceitar", () => {
    expect(telaDeixaAceitar("entrar")).toBe(true);
    expect(telaDeixaAceitar("aceitar-logado")).toBe(true);
    for (const t of ["vencido", "usado", "cancelado", "substituido", "invalido", "ja-tem-par", "e-a-titular", "em-outro-casal", "casal-inativo"] as const) expect(telaDeixaAceitar(t)).toBe(false);
  });
});

describe("nomes e textos", () => {
  it("a letra do par é a do nome que a titular já escreveu; sem nome, o B", () => {
    expect(letraDoPar({ nomeA: "Ana", nomeB: "Lucas" }, "Lucas")).toBe("B");
    expect(letraDoPar({ nomeA: "Lucas", nomeB: "Ana" }, " lucas ")).toBe("A");
    expect(letraDoPar({ nomeA: "Pessoa 1", nomeB: "Pessoa 2" }, "Lucas")).toBe("B");
  });

  it("o nome do par é limpo e cabe em 30 letras", () => {
    expect(limparNomeDoPar("  Lucas   Souza ")).toBe("Lucas Souza");
    expect(limparNomeDoPar("x".repeat(50))).toHaveLength(30);
    expect(limparNomeDoPar(42)).toBe("");
  });

  it("sem travessão nem emoji na mensagem e nos termos", () => {
    const textos = [mensagemDoConvite("Lucas", "https://financas.danicolombo.com.br/par/x"), ...frasesDosTermos("Ana", "Lucas")];
    for (const t of textos) {
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(mensagemDoConvite("Lucas", "L")).toContain("7 dias");
  });
});
