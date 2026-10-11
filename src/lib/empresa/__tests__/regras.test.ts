import { describe, expect, it } from "vitest";
import {
  cadaCemReais,
  caixaEmDias,
  despesasQueCresceram,
  ehGuiaDoMei,
  ehMaquininha,
  faltaVender,
  foiRecebida,
  limiteDoMei,
  mesAntes,
  mesesFechadosComDado,
  pontoDeEquilibrio,
  porcentagensQueSomam100,
  prazoMedio,
  quantoCobrar,
  quemCompra,
  reciboDoMes,
  recebimentos,
  salarioSeguro,
  tipoDaSaida,
  vencimentoDaGuia,
  type LancamentoDaEmpresa,
} from "../regras";
import { lerConfigEmpresa, nomeDoNegocio, paraO } from "../config";

let n = 0;
function l(p: Partial<LancamentoDaEmpresa> & Pick<LancamentoDaEmpresa, "category" | "amount">): LancamentoDaEmpresa {
  return { id: `l${n++}`, year: 2026, month: 9, parentCategory: null, subcategory: null, description: null, entryDate: null, ...p };
}

// Setembro do Ateliê da Ana (ana-canonica.md, seção 10).
const setembro: LancamentoDaEmpresa[] = [
  l({ category: "INCOME", subcategory: "Vendas", amount: 5600, forma: "credito" }),
  l({ category: "INCOME", subcategory: "Vendas", amount: 1500, forma: "pix" }),
  l({ category: "INCOME", subcategory: "Vendas", amount: 1000, forma: "boleto" }),
  l({ category: "INCOME", subcategory: "Vendas", amount: 900, forma: "debito" }),
  l({ category: "EXPENSE", parentCategory: "ALIMENTACAO", subcategory: "Matéria-prima", amount: 2150 }),
  l({ category: "EXPENSE", parentCategory: "ALIMENTACAO", subcategory: "Embalagens", amount: 420 }),
  l({ category: "EXPENSE", parentCategory: "EDUCACAO", subcategory: "Anúncios", amount: 400 }),
  l({ category: "EXPENSE", parentCategory: "TRANSPORTE", subcategory: "Frete", amount: 310 }),
  l({ category: "EXPENSE", parentCategory: "EDUCACAO", subcategory: "Taxas de cartão/maquininha", amount: 198 }),
  l({ category: "EXPENSE", parentCategory: "MORADIA", subcategory: "Luz", description: "Gás e energia", amount: 240 }),
  l({ category: "EXPENSE", parentCategory: "MORADIA", subcategory: "Internet/Telefone", amount: 66 }),
  l({ category: "EXPENSE", parentCategory: "MORADIA", subcategory: "Software e assinaturas", description: "Site de encomendas", amount: 59 }),
  l({ category: "EXPENSE", parentCategory: "MORADIA", subcategory: "Software e assinaturas", description: "Canva", amount: 35 }),
  l({ category: "EXPENSE", parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)", amount: 86.05 }),
];

describe("recibo do mês (Ana, setembro)", () => {
  const r = reciboDoMes(setembro, { ano: 2026, mes: 9 });
  it("entrou 9.000, insumos e entregas 3.478, contas 400, guia 86,05, sobrou 5.036", () => {
    expect(r.entrou).toBe(9000);
    expect(r.nVendas).toBe(4);
    expect(r.variaveis).toBe(3478);
    expect(r.fixas).toBe(400);
    expect(r.impostos).toBe(86.05);
    expect(Math.round(r.sobrou)).toBe(5036);
    expect(r.maquininha).toBe(198);
    expect(r.porForma).toEqual({ credito: 5600, pix: 1500, boleto: 1000, debito: 900 });
  });
  it("o pró-labore é o salário: fica fora do Sobrou", () => {
    const com = reciboDoMes([...setembro, l({ category: "EXPENSE", parentCategory: "SAUDE", subcategory: "Pró-labore", amount: 4500 })], { ano: 2026, mes: 9 });
    expect(com.sobrou).toBe(r.sobrou);
    expect(com.salarioLancado).toBe(4500);
  });
  it("aplicação e pagamento de fatura não são gasto; rendimento do caixa não é venda", () => {
    const com = reciboDoMes(
      [
        ...setembro,
        l({ category: "EXPENSE", parentCategory: "OUTROS", description: "Aplicação CDB", amount: 1000 }),
        l({ category: "EXPENSE", parentCategory: "OUTROS", subcategory: "Investimento", amount: 500 }),
        l({ category: "INCOME", subcategory: "Rendimento do caixa", amount: 40 }),
      ],
      { ano: 2026, mes: 9 },
    );
    expect(com.sobrou).toBe(r.sobrou);
    expect(com.entrou).toBe(9000);
  });
  it("tipo de cada saída", () => {
    expect(tipoDaSaida(l({ category: "EXPENSE", parentCategory: "IMPOSTOS", amount: 1 }))).toBe("imposto");
    expect(tipoDaSaida(l({ category: "EXPENSE", parentCategory: "TRANSPORTE", amount: 1 }))).toBe("variavel");
    expect(tipoDaSaida(l({ category: "EXPENSE", parentCategory: null, amount: 1 }))).toBe("fixa");
    expect(tipoDaSaida(l({ category: "EXPENSE", customCategoryId: "x", parentCategory: "ALIMENTACAO", amount: 1 }))).toBe("fixa");
    expect(tipoDaSaida(l({ category: "INCOME", amount: 1 }))).toBe("fora");
  });
});

describe("salário seguro (plano 3.6, pendência 5.1.11: centena para baixo)", () => {
  it("Ana: min(5.240; 5.310; 5.036) × 0,9 = 4.532,40, que vira R$ 4.500", () => {
    expect(salarioSeguro([5240, 5310, 5036])).toBe(4500);
  });
  it("arredonda sempre para baixo até a centena", () => {
    expect(salarioSeguro([1111])).toBe(900);
    expect(salarioSeguro([1000])).toBe(900);
    expect(salarioSeguro([100])).toBe(0);
  });
  it("sem mês fechado não existe; prejuízo dá zero", () => {
    expect(salarioSeguro([])).toBeNull();
    expect(salarioSeguro([3000, -200])).toBe(0);
  });
});

describe("ponto de equilíbrio (para cima)", () => {
  const r = reciboDoMes(setembro, { ano: 2026, mes: 9 });
  it("Ana: (400 + 4.500) ÷ 60,4% = 8.112,58, que vira R$ 8.113; faltam R$ 5.213 com R$ 2.900 vendidos", () => {
    const pe = pontoDeEquilibrio(r, 4500)!;
    expect(pe).toBe(8113);
    expect(faltaVender(pe, 2900)).toBe(5213);
    expect(faltaVender(pe, 9000)).toBe(0);
  });
  it("sem venda ou com margem negativa, não existe", () => {
    expect(pontoDeEquilibrio({ entrou: 0, variaveis: 0, impostos: 0, fixas: 100 }, 0)).toBeNull();
    expect(pontoDeEquilibrio({ entrou: 100, variaveis: 120, impostos: 0, fixas: 100 }, 0)).toBeNull();
  });
});

describe("limite do MEI", () => {
  it("Ana: R$ 66.420 de R$ 81.000 = 82%, cabem R$ 14.580; no ritmo de R$ 9.000 passa em novembro", () => {
    const L = limiteDoMei({ faturado: 66420, teto: 81000, tolerancia: 97200, ritmo: 9000, hoje: { mes: 10, dia: 7, diasNoMes: 31 } });
    expect(Math.round(L.pct * 100)).toBe(82);
    expect(L.cabe).toBe(14580);
    expect(L.alerta).toBe(true);
    expect(L.faixa).toBe("mei");
    expect(L.passaEm).toBe(11);
  });
  it("alerta só a partir de 80%; ritmo que não passa este ano não marca mês", () => {
    const L = limiteDoMei({ faturado: 60000, teto: 81000, tolerancia: 97200, ritmo: 1000, hoje: { mes: 10, dia: 7, diasNoMes: 31 } });
    expect(L.alerta).toBe(false);
    expect(L.passaEm).toBeNull();
  });
  it("faixas: até 81 mil MEI, até 97,2 mil guia extra, acima fora", () => {
    const base = { teto: 81000, tolerancia: 97200, ritmo: null, hoje: { mes: 10, dia: 7, diasNoMes: 31 } };
    expect(limiteDoMei({ ...base, faturado: 81000 }).faixa).toBe("mei");
    expect(limiteDoMei({ ...base, faturado: 90000 }).faixa).toBe("guia-extra");
    expect(limiteDoMei({ ...base, faturado: 108000 }).faixa).toBe("fora");
  });
});

describe("quanto cobrar", () => {
  it("Ana, bolo de 2 kg: R$ 233", () => {
    const q = quantoCobrar({ materiais: 62, embalagem: 8, horas: 3, salario: 4500, horasPorMes: 120, contasPorUnidade: (400 + 86.05) / 60, taxaPct: 3.1, margemPct: 15 })!;
    expect(q.hora).toBe(37.5);
    expect(q.tempo).toBe(112.5);
    expect(q.preco).toBe(233);
    expect(Math.round(q.taxaELucro)).toBe(42);
    // Para pagar o mês: 35 bolos.
    expect(Math.ceil(8113 / q.preco)).toBe(35);
  });
  it("taxa e lucro que comem tudo não dão preço", () => {
    expect(quantoCobrar({ materiais: 1, embalagem: 0, horas: 1, salario: 0, horasPorMes: 120, contasPorUnidade: 0, taxaPct: 50, margemPct: 50 })).toBeNull();
  });
});

describe("porcentagens que somam 100", () => {
  it("Ana, quem compra: 21, 15, 4 e 60", () => {
    expect(porcentagensQueSomam100([5760, 3900, 1150, 16190])).toEqual([21, 15, 4, 60]);
  });
  it("cada R$ 100 de setembro: 37, 4, 2, 1, 50, 6", () => {
    const r = reciboDoMes(setembro, { ano: 2026, mes: 9 });
    expect(cadaCemReais(r, 4500)!.map((p) => p.cem)).toEqual([37, 4, 2, 1, 50, 6]);
  });
  it("prejuízo não tem os R$ 100", () => {
    expect(cadaCemReais({ ...reciboDoMes(setembro, { ano: 2026, mes: 9 }), sobrou: -1 }, 0)).toBeNull();
  });
});

describe("quem compra", () => {
  const vendas = [
    l({ category: "INCOME", amount: 5760, cliente: "Café Lume" }),
    l({ category: "INCOME", amount: 3900, cliente: "Buffet Sol" }),
    l({ category: "INCOME", amount: 1150, cliente: "carla mendes" }),
    l({ category: "INCOME", amount: 190, cliente: "Joana" }),
    l({ category: "INCOME", amount: 16000 }),
  ];
  it("os 3 maiores com nome e o resto junto com o balcão", () => {
    const q = quemCompra(vendas)!;
    expect(q.clientes.map((c) => c.nome)).toEqual(["Café Lume", "Buffet Sol", "carla mendes"]);
    expect(q.clientes.map((c) => c.pct)).toEqual([21, 15, 4]);
    expect(q.outros.pct).toBe(60);
    expect(q.dependente).toBeNull();
  });
  it("cliente acima de 30% acende a dependência; sem nome nenhum, não mostra", () => {
    expect(quemCompra([l({ category: "INCOME", amount: 400, cliente: "A" }), l({ category: "INCOME", amount: 600 })])!.dependente?.nome).toBe("A");
    expect(quemCompra([l({ category: "INCOME", amount: 600 })])).toBeNull();
  });
});

describe("recebimentos", () => {
  const hoje = "2026-10-11";
  it("cartão cai sozinho na data; boleto espera o Recebi", () => {
    expect(foiRecebida({ forma: "credito", recebeEm: "2026-10-10", recebidoEm: null }, hoje)).toBe(true);
    expect(foiRecebida({ forma: "boleto", recebeEm: "2026-10-10", recebidoEm: null }, hoje)).toBe(false);
    expect(foiRecebida({ forma: "boleto", recebeEm: "2026-10-10", recebidoEm: "2026-10-11" }, hoje)).toBe(true);
    expect(foiRecebida({ forma: "pix", recebeEm: null, recebidoEm: null }, hoje)).toBe(true);
  });
  it("semanas a partir de hoje e quem deve", () => {
    const r = recebimentos(
      [
        l({ category: "INCOME", amount: 1320, forma: "credito", recebeEm: "2026-10-13", cliente: "Carla" }),
        l({ category: "INCOME", amount: 960, forma: "credito", recebeEm: "2026-10-20" }),
        l({ category: "INCOME", amount: 640, forma: "credito", recebeEm: "2026-11-05" }),
        l({ category: "INCOME", amount: 450, forma: "pix", recebeEm: "2026-10-06", cliente: "Marina Costa", description: "Bolo de aniversário" }),
        l({ category: "INCOME", amount: 99, forma: "credito", recebeEm: "2026-12-30" }),
      ],
      hoje,
    );
    expect(r.semanas.map((s) => s.total)).toEqual([1320, 960, 0, 640]);
    expect(r.semanas[0].inicio).toBe("2026-10-11");
    expect(r.semanas[0].fim).toBe("2026-10-17");
    expect(r.devendo).toEqual([{ id: expect.any(String), cliente: "Marina Costa", valor: 450, dias: 5, descricao: "Bolo de aniversário" }]);
  });
  it("prazo médio só com as duas datas", () => {
    expect(prazoMedio([l({ category: "INCOME", amount: 1, entryDate: "2026-09-01", recebeEm: "2026-10-01" }), l({ category: "INCOME", amount: 1, entryDate: "2026-09-01", recebeEm: "2026-09-07" })])).toBe(18);
    expect(prazoMedio([l({ category: "INCOME", amount: 1 })])).toBeNull();
  });
});

describe("outras contas", () => {
  it("caixa em dias: R$ 6.800 pagam 41 dias de contas, guia e salário da Ana", () => {
    expect(caixaEmDias(6800, 400 + 86.05 + 4500)).toBe(41);
    expect(caixaEmDias(0, 100)).toBeNull();
  });
  it("vencimento da guia: dia 20, sem passar do fim do mês", () => {
    expect(vencimentoDaGuia({ ano: 2026, mes: 10 }, 20)).toBe("2026-10-20");
    expect(vencimentoDaGuia({ ano: 2026, mes: 2 }, 31)).toBe("2026-02-28");
  });
  it("reconhece a guia e a maquininha pelo extrato", () => {
    expect(ehGuiaDoMei({ category: "EXPENSE", parentCategory: null, subcategory: null, description: "PGMEI DAS 09/2026" })).toBe(true);
    expect(ehGuiaDoMei({ category: "EXPENSE", parentCategory: null, subcategory: null, description: "Dasa exames" })).toBe(false);
    expect(ehMaquininha({ category: "EXPENSE", subcategory: null, description: "Tarifa Stone" })).toBe(true);
    expect(ehMaquininha({ category: "EXPENSE", subcategory: null, description: "Pedra Stone decor" })).toBe(false);
  });
  it("meses fechados com dado e despesas que cresceram", () => {
    const ls = [...setembro, l({ category: "EXPENSE", month: 8, parentCategory: "ALIMENTACAO", subcategory: "Matéria-prima", amount: 2000 }), l({ category: "EXPENSE", month: 8, parentCategory: "MORADIA", subcategory: "Luz", amount: 300 })];
    expect(mesesFechadosComDado(ls, { ano: 2026, mes: 10 }, 3)).toEqual([{ ano: 2026, mes: 8 }, { ano: 2026, mes: 9 }]);
    expect(despesasQueCresceram(ls, { ano: 2026, mes: 9 }, { ano: 2026, mes: 8 })).toEqual([{ nome: "Insumos", valor: 2150, mais: 150 }]);
    expect(mesAntes({ ano: 2026, mes: 1 }, 1)).toEqual({ ano: 2025, mes: 12 });
  });
});

describe("configuração da empresa", () => {
  it("sem tipo, o assistente ainda não rodou", () => {
    expect(lerConfigEmpresa(null)).toBeNull();
    expect(lerConfigEmpresa({ faz: "doces" })).toBeNull();
  });
  it("lê com padrões seguros e não inventa taxa", () => {
    const c = lerConfigEmpresa({ tipo: "MEI", faz: "doces", formas: ["pix", "x"], prazoCredito: 30, salario: 4500 })!;
    expect(c.formas).toEqual(["pix"]);
    expect(c.taxas).toEqual({ credito: null, debito: null });
    expect(c.horasPorMes).toBe(120);
    expect(c.diaDoSalario).toBe(5);
    expect(c.lembreteDas).toBe(true);
  });
  it("o nome curto do negócio", () => {
    expect(paraO(nomeDoNegocio("Ateliê da Ana"))).toBe("para o ateliê");
    expect(paraO(nomeDoNegocio("Loja online"))).toBe("para a loja");
    expect(paraO(nomeDoNegocio("Minha firma"))).toBe("para a empresa");
  });
});
