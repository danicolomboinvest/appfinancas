import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { semAcentoNemPontuacao } from "../comerciante";
import { comprasDosPrints, juntarPrints, lerData, lerPrint, semelhanca, type Segmento } from "../print-fatura";
import { categoriaDoBancoParaOApp } from "../categoria-do-banco";
import { segmentosDaLinha } from "../ocr-print";
import { escalaDoPrint, prepararPixels } from "../preparar-print";

const ENVIO = "2026-10-13"; // terça

/**
 * Monta um print de mentira: cada string é uma linha da tela, " | " separa o que fica à esquerda
 * do que fica à direita, e "" é o respiro entre um item e outro.
 */
function tela(...linhas: string[]): Segmento[] {
  const segs: Segmento[] = [];
  let y = 0;
  for (const linha of linhas) {
    if (linha === "") {
      y += 90;
      continue;
    }
    const partes = linha.split(" | ");
    partes.forEach((p, i) => {
      const x0 = i === 0 ? 50 : i === partes.length - 1 ? 1170 - 40 - p.length * 22 : 200 + i * 300;
      segs.push({ texto: p, x0, y0: y, x1: x0 + p.length * 22, y1: y + 40 });
    });
    y += 52;
  }
  return segs;
}

describe("lerData", () => {
  it("datas relativas pelo dia do envio", () => {
    expect(lerData("Hoje", ENVIO)?.data).toBe("2026-10-13");
    expect(lerData("ontem", ENVIO)?.data).toBe("2026-10-12");
    expect(lerData("Sábado", ENVIO)?.data).toBe("2026-10-10");
    expect(lerData("Sexta-feira", ENVIO)?.data).toBe("2026-10-09");
    expect(lerData("domingo, 11 out", ENVIO)?.data).toBe("2026-10-11");
  });
  it("datas escritas", () => {
    expect(lerData("12 OUT", ENVIO)?.data).toBe("2026-10-12");
    expect(lerData("SEX, 09 OUT", ENVIO)?.data).toBe("2026-10-09");
    expect(lerData("7 de outubro", ENVIO)?.data).toBe("2026-10-07");
    expect(lerData("28/09/2026", ENVIO)?.data).toBe("2026-09-28");
    expect(lerData("12/10", ENVIO)?.data).toBe("2026-10-12");
  });
  it("dezembro lido em janeiro é do ano passado", () => {
    expect(lerData("28 DEZ", "2027-01-05")?.data).toBe("2026-12-28");
  });
  it("erros comuns do OCR na data", () => {
    expect(lerData("13 our", ENVIO)?.data).toBe("2026-10-13");
    expect(lerData("terça-feira, O6 out", ENVIO)?.data).toBe("2026-10-06");
    expect(lerData("13/10.", ENVIO)?.data).toBe("2026-10-13");
    expect(lerData("11110", ENVIO)?.data).toBe("2026-10-11");
  });
  it("data no começo do nome devolve o resto com as letras como vieram", () => {
    expect(lerData("12/10 Supermercado Bom Preço", ENVIO, false)).toEqual({ data: "2026-10-12", resto: "Supermercado Bom Preço" });
  });
  it("não é data", () => {
    expect(lerData("Padaria", ENVIO)).toBeNull();
    expect(lerData("02/03", ENVIO)).toBeNull(); // parcela, não 2 de março (longe demais)
  });
});

describe("lerPrint", () => {
  it("cabeçalho de data, nome à esquerda, valor à direita, parcela embaixo", () => {
    const { linhas } = lerPrint(
      tela("Fatura atual", "R$ 4.338,49", "Limite disponível R$ 3.661,51", "", "Pagar fatura", "", "Hoje", "", "Padaria Pão Dourado | R$ 23,50", "", "Ontem", "", "Loja Casa Nova | R$ 150,00", "Parcela 2 de 3"),
      ENVIO,
    );
    expect(linhas).toEqual([
      { data: "2026-10-13", nome: "Padaria Pão Dourado", valor: 23.5, sinal: null, credito: false, parcela: null },
      { data: "2026-10-12", nome: "Loja Casa Nova", valor: 150, sinal: null, credito: false, parcela: { atual: 2, total: 3 } },
    ]);
  });
  it("coluna de data à esquerda e parcela no fim do nome", () => {
    const { linhas } = lerPrint(tela("13/10 | Eletro Ponto Com 01/10 | R$ 1.249,00", "", "12/10 | Spotify | R$ 21,90"), ENVIO);
    expect(linhas.map((l) => [l.data, l.nome, l.valor, l.parcela])).toEqual([
      ["2026-10-13", "Eletro Ponto Com", 1249, { atual: 1, total: 10 }],
      ["2026-10-12", "Spotify", 21.9, null],
    ]);
  });
  it("PARC 02/03 do Santander e valor sem R$", () => {
    const { linhas } = lerPrint(tela("05/10/2026", "", "LOJA CASA NOVA PARC 02/03 | 150,00"), ENVIO);
    expect(linhas[0]).toMatchObject({ data: "2026-10-05", nome: "LOJA CASA NOVA", valor: 150, parcela: { atual: 2, total: 3 } });
  });
  it("ignora total, limite, saldo, vencimento e o pagamento da fatura anterior", () => {
    const { linhas } = lerPrint(
      tela("Total da fatura | R$ 4.338,49", "", "Saldo | R$ 10,00", "", "Vencimento 20/11", "", "08/10/2026", "", "Pagamento recebido | -R$ 1.200,00", "", "Livraria Página Um | R$ 79,90"),
      ENVIO,
    );
    expect(linhas.map((l) => l.nome)).toEqual(["Livraria Página Um"]);
  });
  it("estorno é crédito; linha de baixo 'Compra' não vira nome", () => {
    const { linhas } = lerPrint(tela("10 OUT | Estorno Loja Esporte Max | - R$ 89,90", "Estorno", "", "10 OUT | Netflix.com | R$ 44,90", "Compra"), ENVIO);
    expect(linhas.map((l) => [l.nome, l.sinal, l.credito])).toEqual([
      ["Estorno Loja Esporte Max", "-", true],
      ["Netflix.com", null, false],
    ]);
  });
  it("vírgula comida pelo OCR com R$ na frente", () => {
    const { linhas } = lerPrint(tela("Hoje", "", "Padaria | R$ 2350"), ENVIO);
    expect(linhas[0].valor).toBe(23.5);
  });
  it("sem nenhum valor: nada", () => {
    expect(lerPrint(tela("Configurações", "", "Meus cartões"), ENVIO).linhas).toEqual([]);
  });
});

/**
 * O cartão do app BTG/EQI (14/10/2026): tipo, nome e ramo em linhas próprias, bem separadas (cada
 * uma vira um grupo), e o valor embaixo à direita, na altura do ramo. Geometria de um print de
 * 923 px de largura; nomes e valores inventados.
 */
function cartaoBtg(): Segmento[] {
  const s = (texto: string, x0: number, y0: number, x1: number, y1: number): Segmento => ({ texto, x0, y0, x1, y1 });
  return [
    s("Fatura", 61, 357, 210, 397),
    s("Resumo da Fatura", 60, 595, 393, 625),
    s("Compras e despesas", 58, 696, 412, 730),
    s("Total R$ 4.338,49", 57, 739, 313, 771),
    s("Fatura anterior e pagamentos", 59, 904, 552, 939),
    s("Total R$ 5.120,00", 57, 948, 313, 980),
    s("Atividades", 67, 1126, 267, 1156),
    s("Filtrar =", 715, 1127, 854, 1154),
    s("Hoje 13/Out", 70, 1257, 309, 1296),
    s("Compra no crédito", 190, 1396, 429, 1421),
    s("Papelaria Ponto Azul", 191, 1451, 455, 1477),
    s("Outra Categoria", 190, 1514, 392, 1539),
    s("- R$ 1.874,30", 640, 1512, 864, 1549),
    s("14/Set", 70, 1658, 198, 1692),
    s("Compra no crédito parcelada", 190, 1796, 562, 1822),
    s("Clinica Sorriso Bom (2/8)", 190, 1851, 640, 1883),
    s("Saúde", 190, 1915, 266, 1934),
    s("- R$ 845,60", 640, 1913, 864, 1949),
  ];
}

describe("lerPrint: cartão de 4 linhas do BTG/EQI", () => {
  it("nome (não o tipo nem o ramo), valor de baixo, data do cabeçalho e parcela (2/8)", () => {
    const { linhas } = lerPrint(cartaoBtg(), "2026-10-14");
    expect(linhas).toEqual([
      { data: "2026-10-13", nome: "Papelaria Ponto Azul", valor: 1874.3, sinal: "-", credito: false, parcela: null },
      // A parcela fica com a data da compra ORIGINAL (o cabeçalho); a importação põe a 2/8 um mês depois.
      { data: "2026-09-14", nome: "Clinica Sorriso Bom", valor: 845.6, sinal: "-", credito: false, parcela: { atual: 2, total: 8 }, categoriaDoBanco: "Saúde" },
    ]);
  });
  it("o ramo conhecido vai como dica para o motor; o resumo da fatura não vira compra", () => {
    const compras = comprasDosPrints(lerPrint(cartaoBtg(), "2026-10-14").linhas, "2026-10-14");
    expect(compras).toEqual([
      { date: "2026-10-13", description: "Papelaria Ponto Azul", amount: 1874.3 },
      { date: "2026-09-14", description: "Clinica Sorriso Bom - Parcela 2/8", amount: 845.6, categoriaDoBanco: "Saúde" },
    ]);
  });
  it("datas do BTG/EQI: 'Hoje 13/Out' é o dia escrito, '14/Set' é setembro", () => {
    expect(lerData("Hoje 13/Out", "2026-10-14")?.data).toBe("2026-10-13");
    expect(lerData("Ontem 12/Out", ENVIO)?.data).toBe("2026-10-12");
    expect(lerData("14/Set", ENVIO)?.data).toBe("2026-09-14");
    expect(lerData("05/Ago", ENVIO)?.data).toBe("2026-08-05");
  });
});

describe("segmentosDaLinha", () => {
  it("o valor com confiança 0 do OCR fica (só o '-' sobrava)", () => {
    const w = (text: string, confidence: number, x0: number, x1: number) => ({ text, confidence, bbox: { x0, y0: 1512, x1, y1: 1549 } });
    const segs = segmentosDaLinha([w("-", 92, 640, 649), w("R$", 0, 662, 703), w("1.874,30", 0, 715, 864)]);
    expect(segs.map((s) => s.texto)).toEqual(["- R$ 1.874,30"]);
    expect(segmentosDaLinha([w("ruído", 5, 10, 60)])).toEqual([]);
  });
});

describe("juntarPrints", () => {
  const a = lerPrint(tela("Ontem", "", "Café Grão Fino | R$ 8,50", "", "Café Grão Fino | R$ 8,50", "", "Farmácia Vida Leve | R$ 64,90", "", "Domingo"), ENVIO);
  const b = lerPrint(tela("Café Grão Fino | R$ 8,50", "", "Farmácia Vida Leve | R$ 64,90", "", "Loja Casa Nova | R$ 150,00", "", "Sábado", "", "Netflix.com | R$ 44,90"), ENVIO);

  it("tira a sobreposição e mantém as duas compras iguais de verdade", () => {
    const juntas = juntarPrints([a, b]);
    expect(juntas.map((l) => l.nome)).toEqual(["Café Grão Fino", "Café Grão Fino", "Farmácia Vida Leve", "Loja Casa Nova", "Netflix.com"]);
  });
  it("o começo sem cabeçalho herda o cabeçalho que ficou no pé do print anterior", () => {
    const juntas = juntarPrints([a, b]);
    expect(juntas.find((l) => l.nome === "Loja Casa Nova")?.data).toBe("2026-10-11");
    expect(juntas.find((l) => l.nome === "Netflix.com")?.data).toBe("2026-10-10");
  });
  it("aguenta uma linha que o OCR não leu no pedaço repetido", () => {
    const x = lerPrint(tela("Hoje", "", "A Loja | R$ 1,00", "", "B Loja | R$ 2,00", "", "C Loja | R$ 3,00", "", "D Loja | R$ 4,00"), ENVIO);
    const y = lerPrint(tela("B Loja | R$ 2,00", "", "D Loja | R$ 4,00", "", "E Loja | R$ 5,00"), ENVIO);
    expect(juntarPrints([x, y]).map((l) => l.nome)).toEqual(["A Loja", "B Loja", "C Loja", "D Loja", "E Loja"]);
  });
  it("o mesmo print duas vezes não dobra nada", () => {
    expect(juntarPrints([a, a])).toHaveLength(3);
  });
  it("prints sem nada em comum só se somam", () => {
    const x = lerPrint(tela("Hoje", "", "A Loja | R$ 1,00"), ENVIO);
    const y = lerPrint(tela("Ontem", "", "B Loja | R$ 2,00"), ENVIO);
    expect(juntarPrints([x, y])).toHaveLength(2);
  });
});

describe("comprasDosPrints", () => {
  it("compra positiva, crédito negativo e parcela no jeito do app", () => {
    const { linhas } = lerPrint(tela("Hoje", "", "Loja | R$ 10,00", "Parcela 2/3", "", "Estorno Loja | -R$ 5,00"), ENVIO);
    expect(comprasDosPrints(linhas, ENVIO)).toEqual([
      { date: "2026-10-13", description: "Loja - Parcela 2/3", amount: 10 },
      { date: "2026-10-13", description: "Estorno Loja", amount: -5 },
    ]);
  });
  it("app que escreve toda compra com menos: o menos é compra, o mais é crédito", () => {
    const { linhas } = lerPrint(tela("Hoje", "", "Loja A | -R$ 10,00", "", "Loja B | -R$ 20,00", "", "Loja C | +R$ 5,00"), ENVIO);
    expect(comprasDosPrints(linhas, ENVIO).map((c) => c.amount)).toEqual([10, 20, -5]);
  });
  it("sem data nenhuma: o dia do envio", () => {
    const { linhas } = lerPrint(tela("A Loja | R$ 10,00"), ENVIO);
    expect(comprasDosPrints(linhas, ENVIO)[0].date).toBe(ENVIO);
  });
});

/**
 * Prints de teste dos nove layouts (scripts/prints-de-fatura/gerar.mjs), lidos pelo OCR de
 * verdade (medir.ts) e guardados como os pedaços que o OCR devolveu. Nenhum dado de cliente.
 */
describe("prints de teste: nove layouts de banco", () => {
  const pasta = path.join(__dirname, "fixtures", "prints-fatura");
  const gabarito = JSON.parse(fs.readFileSync(path.join(pasta, "gabarito.json"), "utf8")) as {
    envio: string;
    compras: Esperada[];
    bancos: Record<string, Esperada[]>;
  };
  type Esperada = { d: string; nome: string; valor: number; parcela?: [number, number]; credito?: boolean; pagamento?: boolean; ramo?: string };
  const esperadasDe = (banco: string) =>
    (gabarito.bancos[banco] ?? gabarito.compras)
      .filter((c) => !c.pagamento)
      .map((c) => ({
        date: c.d,
        description: semAcentoNemPontuacao(c.parcela ? `${c.nome} - Parcela ${c.parcela[0]}/${c.parcela[1]}` : c.nome),
        amount: c.credito ? -Math.abs(c.valor) : c.valor,
        // O ramo do cartão (BTG/EQI) só vai junto quando o app conhece ("Saúde" sim, "Outra Categoria" não).
        ...(c.ramo && categoriaDoBancoParaOApp(c.ramo) ? { categoriaDoBanco: c.ramo } : {}),
      }));
  for (const banco of ["nubank", "itau", "inter", "c6", "btg", "santander", "bradesco", "xp", "btg-cartao"]) {
    const esperadas = esperadasDe(banco);
    it(`${banco}: 3 prints sobrepostos viram as ${esperadas.length} linhas certas`, () => {
      const prints = [1, 2, 3].map((n) => lerPrint(JSON.parse(fs.readFileSync(path.join(pasta, `${banco}-${n}.json`), "utf8")) as Segmento[], gabarito.envio));
      const lidas = comprasDosPrints(juntarPrints(prints), gabarito.envio).map((c) => ({ ...c, description: semAcentoNemPontuacao(c.description) }));
      expect(lidas).toEqual(esperadas);
    });
  }
});

describe("semelhanca", () => {
  it("uma letra trocada ainda parece", () => {
    expect(semelhanca("farmaciavidaleve", "farmaclavidaleve")).toBeGreaterThan(0.9);
    expect(semelhanca("padaria", "uber")).toBeLessThan(0.3);
  });
});

describe("prepararPixels", () => {
  it("tela escura vira clara, com contraste esticado", () => {
    // 10 pixels: 9 de fundo quase preto, 1 de texto cinza claro.
    const rgba = new Uint8ClampedArray(40);
    for (let i = 0; i < 10; i++) rgba.set(i === 0 ? [200, 200, 200, 255] : [15, 15, 15, 255], i * 4);
    const r = prepararPixels(rgba, 10, 1);
    expect(r.escuro).toBe(true);
    expect(r.pixels[0]).toBe(0); // o texto ficou preto
    expect(r.pixels[4]).toBe(255); // o fundo ficou branco
  });
  it("escala: print pequeno aumenta, foto grande diminui, iPhone fica", () => {
    expect(escalaDoPrint(720)).toBeCloseTo(1100 / 720);
    expect(escalaDoPrint(3024)).toBeCloseTo(1600 / 3024);
    expect(escalaDoPrint(1179)).toBe(1);
  });
});
