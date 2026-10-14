import { describe, expect, it } from "vitest";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { NAV_SECTIONS, secoesDoPrimeiroDia, secoesVisiveis, usaMenuDoPrimeiroDia } from "@/components/shell/nav-sections";
import { CAMINHO_GENERICO, caminhoDoExtrato } from "../bancos";
import {
  BANCOS_DO_COMECO,
  BANCO_OUTRO,
  CAMINHO_DO_EXTRATO,
  PRINCIPAIS_DO_COMECO,
  ATALHOS_DO_GASTO,
  bancoDoComeco,
  bancoQueFalta,
  buscarBancos,
  caminhoDoEvento,
  EVENTOS_DO_COMECO,
  juntarComeco,
  mostrarPerguntaDoSegundoDia,
  passoAnterior,
  proximoPasso,
  terminarComLancamento,
} from "../comeco";
import { MAX_PERGUNTAS_DO_COMECO, perguntasDeMaiorValor, valorDaPergunta, type LinhaDaConferencia } from "../conferencia-inicial";

/** Leva 1 do "Primeiro uso mais leve" (aprovada pela dona em 14/10/2026). */

describe("o começo enxuto", () => {
  it("até o envio do extrato são 4 telas: Boas-vindas, Porta, Banco e Como baixar", () => {
    expect(CAMINHO_DO_EXTRATO).toEqual(["b1", "porta", "banco", "tutorial"]);
    expect(proximoPasso("b1")).toBe("porta");
    expect(proximoPasso("porta")).toBe("banco");
    expect(proximoPasso("banco")).toBe("tutorial");
    expect(proximoPasso("tutorial")).toBeNull();
  });
  it("sem as outras boas-vindas, sem perguntas: a porta volta direto para as boas-vindas", () => {
    expect(passoAnterior("porta")).toBe("b1");
    expect(passoAnterior("falar")).toBe("porta");
    expect(proximoPasso("b2" as never)).toBeNull();
  });
  it("o banco é um toque: grava um banco só", () => {
    const c = juntarComeco(null, { banco: "neon", bancos: ["neon"] });
    expect(c.banco).toBe("neon");
    expect(c.bancos).toEqual(["neon"]);
  });
  it("o primeiro gasto digitado tem atalhos de categoria, como na proposta", () => {
    expect(ATALHOS_DO_GASTO.map((a) => a.categoria)).toEqual(["ALIMENTACAO", "TRANSPORTE", "LAZER"]);
  });
});

describe("Qual é o seu banco? (mais bancos e o que não está aqui)", () => {
  const pedidos = ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Caixa", "Santander", "Inter", "C6", "BTG", "XP", "Rico", "Mercado Pago", "PicPay", "Sicoob", "Sicredi", "Neon", "PagBank", "Original", "Banrisul", "BRB", "Safra", "Will Bank", "Next", "Ame", "Banco Pan", "BV", "Agibank", "Itaú Personnalité"];
  it.each(pedidos)("%s está na lista e a busca acha", (nome) => {
    expect(buscarBancos(nome).length).toBeGreaterThan(0);
  });
  it("tem os 28 bancos pedidos e mais os que já existiam, sem repetir chave", () => {
    expect(BANCOS_DO_COMECO.length).toBeGreaterThanOrEqual(28);
    expect(new Set(BANCOS_DO_COMECO.map((b) => b.chave)).size).toBe(BANCOS_DO_COMECO.length);
  });
  it("cada banco tem logo do catálogo ou a sigla", () => {
    for (const b of BANCOS_DO_COMECO) {
      if (b.marca) expect(marcaDaDescricao(b.marca), b.nome).not.toBeNull();
      else expect(b.sigla, b.nome).toBeTruthy();
    }
  });
  it("a grade mostra os 12 principais; o resto fica no Ver mais bancos", () => {
    expect(PRINCIPAIS_DO_COMECO).toBe(12);
    expect(BANCOS_DO_COMECO.slice(0, 3).map((b) => b.nome)).toEqual(["Nubank", "Itaú", "Bradesco"]);
  });
  it("busca sem acento, pelo começo da palavra e pelos apelidos", () => {
    expect(buscarBancos("ita").map((b) => b.chave)).toEqual(["itau", "personnalite"]);
    expect(buscarBancos("cef").map((b) => b.chave)).toEqual(["caixa"]);
    expect(buscarBancos("votorantim").map((b) => b.chave)).toEqual(["bv"]);
    expect(buscarBancos("PERSONNALITE").map((b) => b.chave)).toEqual(["personnalite"]);
    expect(buscarBancos("banco topazio")).toEqual([]);
    expect(buscarBancos("  ")).toHaveLength(BANCOS_DO_COMECO.length);
  });
  it("banco sem passo a passo oficial cai no caminho genérico, com o texto da dona", () => {
    expect(caminhoDoExtrato("banrisul")).toBe(CAMINHO_GENERICO);
    expect(CAMINHO_GENERICO.nota).toBe("No app do seu banco, procure Extrato ou Fatura › Exportar › PDF ou CSV.");
    expect(JSON.stringify(CAMINHO_GENERICO)).not.toMatch(/[—–]/);
  });
  it("Meu banco não está aqui: o genérico, sem logo", () => {
    expect(bancoDoComeco("outro")).toBe(BANCO_OUTRO);
    expect(BANCO_OUTRO.marca).toBe("");
  });
  it("o nome que ela escreve vira evento sem número nem nada dela", () => {
    expect(bancoQueFalta("Banco Topázio")).toBe("banco-topazio");
    expect(bancoQueFalta("Cora 1234-5")).toBe("cora");
    expect(bancoQueFalta("123.456.789-00")).toBeNull();
    expect(bancoQueFalta("")).toBeNull();
    expect(bancoQueFalta(null)).toBeNull();
    expect(bancoQueFalta("Banco Cooperativo do Interior Paulista")!.length).toBeLessThanOrEqual(24);
    const nome = bancoQueFalta("Banco Cooperativo do Interior Paulista");
    expect(caminhoDoEvento(EVENTOS_DO_COMECO.faltaBanco, nome)).toBe(`/comecar/falta_banco/${nome}`);
  });
});

describe("o que você quer agora vira o próximo passo do segundo dia", () => {
  const fim = terminarComLancamento(null, "extrato", {}, new Date("2026-10-14T23:30:00Z")); // 20h30 em Brasília
  it("não aparece no mesmo dia, aparece no dia seguinte", () => {
    expect(mostrarPerguntaDoSegundoDia(fim, "2026-10-14")).toBe(false);
    expect(mostrarPerguntaDoSegundoDia(fim, "2026-10-15")).toBe(true);
  });
  it("some quando ela responde, e nunca aparece para quem não passou pelo começo", () => {
    expect(mostrarPerguntaDoSegundoDia({ ...fim, quer: "dividas" }, "2026-10-20")).toBe(false);
    expect(mostrarPerguntaDoSegundoDia(null, "2026-10-20")).toBe(false);
    expect(mostrarPerguntaDoSegundoDia({ ...fim, terminouEm: null }, "2026-10-20")).toBe(false);
  });
});

describe("conferência do primeiro extrato: no máximo 3 perguntas", () => {
  const linha = (key: number, description: string, amount: number, porLoja = true): LinhaDaConferencia => ({ key, description, amount, profileId: null, porLoja });
  it("o limite é 3", () => {
    expect(MAX_PERGUNTAS_DO_COMECO).toBe(3);
  });
  it("fica com as 3 de maior valor, na ordem da fila", () => {
    const pendentes = [linha(1, "Pix para Maria Souza", 80, false), linha(2, "LOJA ABC", 30), linha(3, "MERCADOPAGO *LOJA", 230), linha(4, "PADARIA X", 12), linha(5, "Pix para Banco Inter", 500, false), linha(6, "FARMACIA Y", 45)];
    const fila = [1, 5, 2, 3, 4, 6];
    expect(perguntasDeMaiorValor(fila, pendentes)).toEqual([1, 5, 3]);
  });
  it("a pergunta de categoria vale pela loja inteira", () => {
    const pendentes = [linha(1, "UBER TRIP", 20), linha(2, "UBER TRIP", 25), linha(3, "UBER TRIP", 30), linha(4, "LOJA GRANDE", 60), linha(5, "SAPATARIA", 10), linha(6, "LIVRARIA", 15)];
    expect(valorDaPergunta(1, pendentes)).toBe(75);
    expect(perguntasDeMaiorValor([1, 4, 5, 6], pendentes)).toEqual([1, 4, 6]);
  });
  it("com 3 ou menos, nada muda", () => {
    expect(perguntasDeMaiorValor([7, 8], [linha(7, "A", 1), linha(8, "B", 2)])).toEqual([7, 8]);
  });
});

describe("menu do primeiro dia", () => {
  it("até o primeiro extrato: Visão geral, Metas, Dívidas e Configurações", () => {
    const pessoal = secoesVisiveis(NAV_SECTIONS, { empresa: false, casal: false });
    expect(secoesDoPrimeiroDia(pessoal).map((s) => s.label)).toEqual(["Visão geral", "Metas", "Dívidas", "Configurações"]);
  });
  it("nada some do app: as outras áreas continuam na lista completa", () => {
    const pessoal = secoesVisiveis(NAV_SECTIONS, { empresa: false, casal: false });
    expect(pessoal.map((s) => s.label)).toEqual(expect.arrayContaining(["Carteira", "Decidir", "Análises", "Como funciona"]));
  });
  it("só para quem passou pelo começo novo, fora da Empresa", () => {
    expect(usaMenuDoPrimeiroDia({ passo: "porta" }, "PESSOAL")).toBe(true);
    expect(usaMenuDoPrimeiroDia({ passo: "porta" }, "CASAL")).toBe(true);
    expect(usaMenuDoPrimeiroDia({ passo: "porta" }, "EMPRESA")).toBe(false);
    expect(usaMenuDoPrimeiroDia(null, "PESSOAL")).toBe(false);
  });
});
