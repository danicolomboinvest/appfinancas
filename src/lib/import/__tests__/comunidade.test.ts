import { describe, expect, it } from "vitest";
import { chaveDaLoja, classificarPelaComunidade, montarRegrasDaComunidade, type Voto } from "../comunidade";
import { classify } from "../classify";

// Votos FICTÍCIOS: cada linha é a regra que uma cliente ensinou ao app.
const v = (userId: string, pattern: string, parentCategory: Voto["parentCategory"]): Voto => ({ userId, pattern, parentCategory });

describe("aprender com as outras clientes", () => {
  it("3 clientes diferentes concordando ensinam a próxima", () => {
    const regras = montarRegrasDaComunidade([
      v("a", "loja ficticia modas", "OUTROS"),
      v("b", "loja ficticia modas centro", "OUTROS"),
      v("c", "ficticia modas", "OUTROS"),
    ]);
    expect(classificarPelaComunidade("LOJA FICTICIA MODAS SHOPPING", regras)).toBe("OUTROS");
  });

  it("uma cliente só vale um voto, por mais regras que tenha", () => {
    const regras = montarRegrasDaComunidade([v("a", "padaria exemplo", "ALIMENTACAO"), v("a", "padaria exemplo centro", "ALIMENTACAO"), v("b", "padaria exemplo", "ALIMENTACAO")]);
    expect(classificarPelaComunidade("PADARIA EXEMPLO", regras)).toBeNull();
  });

  it("loja que racha o voto (vende de tudo) continua indo pra revisão", () => {
    const regras = montarRegrasDaComunidade([
      v("a", "megaloja online", "LAZER"),
      v("b", "megaloja online", "EDUCACAO"),
      v("c", "megaloja online", "OUTROS"),
      v("d", "megaloja online", "OUTROS"),
    ]);
    expect(classificarPelaComunidade("MEGALOJA ONLINE", regras)).toBeNull();
  });

  it("Pix e transferência nunca entram: ali o nome é de uma pessoa", () => {
    expect(chaveDaLoja("Transferência enviada pelo Pix - FULANA DE TAL")).toBeNull();
    const regras = montarRegrasDaComunidade(["a", "b", "c"].map((u) => v(u, "pix fulana tal", "ALIMENTACAO")));
    expect(regras.size).toBe(0);
  });

  it("intermediário de pagamento não vira a loja", () => {
    expect(chaveDaLoja("PAG*LojaExemplo")).toBe("lojaexemplo");
    expect(chaveDaLoja("EBN*CANVA")).toBe("canva");
  });
});

describe("palavras que as clientes ensinaram (out/2026)", () => {
  it.each([
    ["SEM PARAR", "TRANSPORTE"],
    ["PSICOLOGA FULANA", "SAUDE"],
    ["PIZZA DO BAIRRO", "ALIMENTACAO"],
    ["SIMPLES NACIONAL", "IMPOSTOS"],
  ])("%s → %s", (descricao, categoria) => {
    expect(classify(descricao)?.parentCategory).toBe(categoria);
  });
});
