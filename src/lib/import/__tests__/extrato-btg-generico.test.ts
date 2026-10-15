import { describe, expect, it } from "vitest";
import { parseTextLines } from "../statement-parser";
import { classifyDictionaryOnly } from "../classify";
import { categoriaDaLinha } from "../motor";
import { nomeNaTela } from "../nome-na-tela";
import { descricaoComparavel } from "@/lib/entries/recurrence";

// Extrato da conta corrente BTG lido pelo leitor genérico (colunas: Data e hora, Categoria,
// Transação, Descrição, Valor). Todos os nomes e valores são inventados.
const EXTRATO = [
  "Extrato da conta corrente",
  "Data e hora Categoria Transação Descrição Valor",
  "05/10/2026 10h51 Investimentos Transferência enviada Fulana Exemplo -R$ 1.000,00",
  "05/10/2026 10h50 Seguro Pix recebido Empresa Exemplo R$ 1.200,00",
  "01/10/2026 08h09 Impostos e",
  "Tributos IOF limite da conta BTG Pactual -R$ 1,75",
  "20/08/2026 09h12",
  "Lazer e",
  "Entretenimento Pix enviado Viacao Exemplo S A -R$ 230,10",
  "10/08/2026 22h21 Alimentação Compra no débito autorizada Restaurante Exemplo -R$ 80,00",
].join("\n");

describe("extrato BTG pelo leitor genérico: linha de cobrança com 'limite' ou 'saldo'", () => {
  it("não confunde juros e IOF de limite, nem seguro de saldo devedor, com linha de saldo", () => {
    const txns = parseTextLines(
      [
        "05/10/2026 Juros limite cheque especial -R$ 12,30",
        "07/10/2026 Seguro saldo devedor -R$ 45,00",
        "08/10/2026 Padaria Exemplo -R$ 10,00",
      ].join("\n"),
      2026,
    );
    expect(txns.map((t) => t.amount)).toEqual([-12.3, -45, -10]);
  });

  it("linha que começa por saldo ou limite continua sendo saldo, não lançamento", () => {
    const txns = parseTextLines(["05/10/2026 Saldo anterior R$ 500,00", "06/10/2026 Limite disponível R$ 2.000,00", "07/10/2026 Padaria Exemplo -R$ 10,00"].join("\n"), 2026);
    expect(txns).toHaveLength(1);
  });

  it("o IOF do extrato entra", () => {
    const txns = parseTextLines(EXTRATO, 2026);
    expect(txns.some((t) => /IOF/.test(t.description) && t.amount === -1.75)).toBe(true);
    expect(txns).toHaveLength(5);
  });
});

describe("extrato BTG: horário e rótulo do banco fora do nome", () => {
  const txns = parseTextLines(EXTRATO, 2026);
  const por = (trecho: string) => txns.find((t) => t.description.includes(trecho))!;

  it("tira o horário e o rótulo, mesmo quebrado em duas linhas", () => {
    expect(por("Fulana").description).toBe("Transferência enviada Fulana Exemplo");
    expect(por("IOF").description).toBe("IOF limite da conta BTG Pactual");
    expect(por("Viacao").description).toBe("Pix enviado Viacao Exemplo S A");
    expect(txns.every((t) => !/^\d{1,2}h\d{2}/.test(t.description))).toBe(true);
  });

  it("o nome na tela fica curto, com a etiqueta do meio", () => {
    expect(nomeNaTela(por("Viacao").description)).toMatchObject({ meio: "Pix enviado" });
    expect(nomeNaTela(por("Viacao").description).nome).toMatch(/^Viacao Exemplo/);
  });

  it("o rótulo de uma compra vira categoria do banco; o de Pix não", () => {
    expect(por("Restaurante").categoriaDoBanco).toBe("alimentacao");
    expect(por("IOF").categoriaDoBanco).toBe("impostos e tributos");
    expect(por("Viacao").categoriaDoBanco).toBeUndefined();
    expect(por("Empresa").categoriaDoBanco).toBeUndefined();
  });

  it("extrato já gravado com o horário continua batendo com o novo (não duplica)", () => {
    expect(descricaoComparavel("10h51 Investimentos Transferência enviada Fulana Exemplo")).toBe(descricaoComparavel("Transferência enviada Fulana Exemplo"));
  });
});

describe("rótulo 'Seguro' do banco não decide a categoria de um Pix", () => {
  it("Pix para pessoa com rótulo Seguro não vira Tarifas bancárias", () => {
    const r = categoriaDaLinha({ descricao: "00h14 Seguro Pix enviado Fulano De Tal", regras: [], gasto: true });
    expect(r.categoria?.subcategory).not.toBe("Tarifas bancárias");
    expect(r.confianca).not.toBe("alta");
  });

  it("o dicionário não vê o rótulo nem na linha já gravada com o horário", () => {
    expect(classifyDictionaryOnly("00h14 Seguro Pix enviado Fulano De Tal")?.subcategory).not.toBe("Tarifas bancárias");
    expect(classifyDictionaryOnly("Seguro saldo devedor")?.subcategory).toBe("Tarifas bancárias");
  });
});
