import { describe, expect, it } from "vitest";
import base from "../base-comunitaria.json";
import {
  chaveParaABase,
  classificarPelaComunidade,
  indexarBase,
  montarBaseComunitaria,
  pareceNomeDePessoa,
  type BaseComunitaria,
  type Voto,
} from "../comunidade";
import { classify } from "../classify";
import { categoriaDaLinha } from "../motor";

// Votos FICTÍCIOS: cada linha é uma escolha de uma pessoa.
const v = (pessoa: string, descricao: string, categoria: Voto["categoria"], perfil: Voto["perfil"] = "pessoal"): Voto => ({ pessoa, perfil, descricao, categoria });
const pessoal = (votos: Voto[]) => indexarBase(montarBaseComunitaria(votos, "2026-10-12").pessoal);

describe("base comunitária: aprender com quem já usa", () => {
  it("3 pessoas diferentes concordando ensinam a próxima", () => {
    const indice = pessoal([v("a", "LOJA FICTICIA MODAS", "OUTROS"), v("b", "PAG*LOJA FICTICIA MODAS", "OUTROS"), v("c", "Loja Ficticia Modas", "OUTROS")]);
    expect(classificarPelaComunidade("COMPRA CARTAO LOJA FICTICIA MODAS SAO PAULO", "pessoal", indice)).toBe("OUTROS");
  });

  it("uma pessoa vale um voto, por mais que compre lá", () => {
    const indice = pessoal([v("a", "PADARIA EXEMPLO", "ALIMENTACAO"), v("a", "PADARIA EXEMPLO", "ALIMENTACAO"), v("b", "PADARIA EXEMPLO", "ALIMENTACAO")]);
    expect(classificarPelaComunidade("PADARIA EXEMPLO", "pessoal", indice)).toBeNull();
  });

  it("70% é o mínimo: loja que racha o voto continua com o dicionário ou a pergunta", () => {
    const votos = [v("a", "MEGALOJA", "LAZER"), v("b", "MEGALOJA", "OUTROS"), v("c", "MEGALOJA", "OUTROS")];
    expect(classificarPelaComunidade("MEGALOJA", "pessoal", pessoal(votos))).toBeNull(); // 67%
    expect(classificarPelaComunidade("MEGALOJA", "pessoal", pessoal([...votos, v("d", "MEGALOJA", "OUTROS")]))).toBe("OUTROS"); // 75%
  });

  it("empresa e pessoa física têm bases separadas", () => {
    const b = montarBaseComunitaria(["a", "b", "c"].map((p) => v(p, "MANYCHAT", "MORADIA", "empresa")), "2026-10-12");
    expect(b.pessoal).toHaveLength(0);
    expect(b.empresa).toEqual([{ comerciante: "manychat", categoria: "MORADIA", confianca: 1, pessoas: 3 }]);
  });
});

describe("base comunitária: privacidade", () => {
  it("Pix, transferência e 'recebido de' nunca entram", () => {
    for (const d of [
      "Transferência enviada pelo Pix - EMPRESA FICTICIA LTDA - 12.345.678/0001-90 - BANCO (0001) Agência: 1 Conta: 2",
      "PIX ENVIADO LOJA FICTICIA",
      "TED RECEBIDA LOJA FICTICIA",
      "Recebido de Loja Ficticia",
    ]) {
      expect(chaveParaABase(d), d).toBeNull();
    }
    const b = montarBaseComunitaria(["a", "b", "c"].map((p) => v(p, "PIX ENVIADO PADARIA FICTICIA", "ALIMENTACAO")));
    expect(b.pessoal).toHaveLength(0);
  });

  it("nome de gente fica de fora, até no MEI com nome de pessoa", () => {
    for (const nome of ["maria silva", "joao pereira doces", "ana", "souza santos"]) expect(pareceNomeDePessoa(nome), nome).toBe(true);
    for (const loja of ["manychat", "grupo madero", "drogasil", "padaria tupi"]) expect(pareceNomeDePessoa(loja), loja).toBe(false);
    const b = montarBaseComunitaria(["a", "b", "c"].map((p) => v(p, "MARIA SILVA DOCES", "ALIMENTACAO")));
    expect(b.pessoal).toHaveLength(0);
  });

  it("descrição com CPF ou CNPJ fica de fora", () => {
    expect(chaveParaABase("LOJA FICTICIA 123.456.789-00")).toBeNull();
    expect(chaveParaABase("LOJA FICTICIA •••.456.789-••")).toBeNull();
  });

  it("o resultado só tem comerciante, categoria, confiança e pessoas", () => {
    const b = montarBaseComunitaria(["a", "b", "c"].map((p) => v(p, "LOJA FICTICIA", "OUTROS")));
    expect(Object.keys(b.pessoal[0]).sort()).toEqual(["categoria", "comerciante", "confianca", "pessoas"]);
    expect(JSON.stringify(b)).not.toMatch(/"a"|"b"|"c"/);
  });

  it("o arquivo versionado segue as regras: 3+ pessoas, só os quatro campos, nenhum nome de gente", () => {
    const arquivo = base as BaseComunitaria;
    for (const e of [...arquivo.pessoal, ...arquivo.empresa]) {
      expect(Object.keys(e).sort()).toEqual(["categoria", "comerciante", "confianca", "pessoas"]);
      expect(e.pessoas).toBeGreaterThanOrEqual(3);
      expect(pareceNomeDePessoa(e.comerciante), e.comerciante).toBe(false);
      expect(e.comerciante).not.toMatch(/\b(pix|ted|transferencia)\b|@|\d{3}\.\d{3}/);
    }
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

describe("base gerada com o jeito antigo de montar o nome da loja (21/10/2026)", () => {
  it("\"99food\" do arquivo ainda vale para \"99 FOOD\", em vez de cair no \"99\" das corridas", () => {
    const indice = indexarBase([
      { comerciante: "99", categoria: "TRANSPORTE", confianca: 0.85, pessoas: 39 },
      { comerciante: "99food", categoria: "ALIMENTACAO", confianca: 0.95, pessoas: 19 },
    ]);
    expect(classificarPelaComunidade("99 FOOD", "pessoal", indice)).toBe("ALIMENTACAO");
    expect(classificarPelaComunidade("99 RIDE", "pessoal", indice)).toBe("TRANSPORTE");
  });

  it("toda loja do arquivo versionado é achada pela própria descrição", () => {
    const arquivo = base as BaseComunitaria;
    const indice = indexarBase(arquivo.pessoal);
    for (const e of arquivo.pessoal.filter((x) => x.pessoas >= 3 && x.confianca >= 0.7)) {
      expect(classificarPelaComunidade(e.comerciante, "pessoal", indice), e.comerciante).not.toBeNull();
    }
  });
});

describe("lojas que as clientes têm e o dicionário não conhecia (21/10/2026)", () => {
  it.each([
    ["KEETABR", "ALIMENTACAO"],
    ["SMILES CLUBE SMILES", "LAZER"],
  ])("%s → %s", (descricao, categoria) => {
    expect(classify(descricao)?.parentCategory).toBe(categoria);
  });
});

describe("erro do próprio app que a base aprendeu (21/10/2026)", () => {
  it("Cacau Show é comida, não Lazer, mesmo que a base gerada de novo traga os votos antigos", () => {
    const votos = ["a", "b", "c", "d"].map((p) => v(p, "CACAU SHOW SHOPPING", "LAZER"));
    expect(montarBaseComunitaria(votos).pessoal).toEqual([]);
    expect(classificarPelaComunidade("CACAU SHOW", "pessoal", indexarBase([{ comerciante: "cacau show", categoria: "LAZER", confianca: 0.79, pessoas: 14 }]))).toBeNull();
    expect(categoriaDaLinha({ descricao: "CACAU SHOW", regras: [], gasto: true }).categoria?.parentCategory).toBe("ALIMENTACAO");
  });
});
