import { describe, expect, it } from "vitest";
import {
  anoSo,
  atalhosDeDatas,
  dentroDoPeriodo,
  lerGrupo,
  lerPeriodo,
  mesesDoPeriodo,
  noGrupo,
  noPeriodoTexto,
  parametrosDoPeriodo,
  periodoDoTipo,
  resumoDoPeriodo,
  rotuloDoPeriodo,
  umMesSo,
  type PeriodoDaEmpresa,
} from "../periodo";
import { reciboDoMes, type LancamentoDaEmpresa } from "../regras";

let n = 0;
const venda = (year: number, month: number, amount: number, extra: Partial<LancamentoDaEmpresa> = {}): LancamentoDaEmpresa => ({
  id: `v${n++}`, year, month, category: "INCOME", parentCategory: null, subcategory: "Vendas", description: null, amount, entryDate: null, ...extra,
});
const saida = (year: number, month: number, amount: number, extra: Partial<LancamentoDaEmpresa> = {}): LancamentoDaEmpresa => ({
  id: `s${n++}`, year, month, category: "EXPENSE", parentCategory: "MORADIA", subcategory: null, description: null, amount, entryDate: null, ...extra,
});

const HOJE = "2026-10-13";
const datas = (de: string, ate: string): PeriodoDaEmpresa => ({ tipo: "datas", de, ate });

// A Ana: novembro e dezembro de 2025, o ano de 2026 até outubro, com pró-labore, guia, insumos e clientes.
const ana: LancamentoDaEmpresa[] = [
  venda(2025, 11, 5000, { cliente: "Café Lume", entryDate: "2025-11-10" }),
  venda(2025, 12, 7000, { entryDate: "2025-12-20" }),
  saida(2025, 12, 1000, { parentCategory: "ALIMENTACAO", entryDate: "2025-12-05" }),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => venda(2026, m, 8000, { entryDate: `2026-0${m}-10` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => saida(2026, m, 3000, { parentCategory: "ALIMENTACAO", entryDate: `2026-0${m}-12` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => saida(2026, m, 400, { entryDate: `2026-0${m}-05` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => saida(2026, m, 86.05, { parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)", entryDate: `2026-0${m}-20` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => saida(2026, m, 4000, { parentCategory: "SAUDE", subcategory: "Pró-labore", externalId: `prolabore:2026-0${m}` })),
  venda(2026, 9, 1440, { cliente: "Café Lume", entryDate: "2026-09-03" }),
  venda(2026, 9, 900, { cliente: "café lume ", entryDate: "2026-09-04" }),
  venda(2026, 9, 600, { cliente: "Marina Costa", entryDate: "2026-09-30" }),
  // Sem dia: vale o mês.
  venda(2026, 10, 2000),
  venda(2026, 10, 500, { entryDate: "2026-10-02" }),
  saida(2026, 10, 300, { parentCategory: "ALIMENTACAO", entryDate: "2026-10-08" }),
  // Fora da conta: aplicação do caixa (não é venda nem despesa) e pagamento de fatura.
  venda(2026, 9, 50, { subcategory: "Rendimento do caixa" }),
  { ...saida(2026, 9, 999), category: "INVESTMENT_CONTRIBUTION" },
];

describe("os chips do período", () => {
  it("cada chip a partir de hoje", () => {
    expect(periodoDoTipo("mes", HOJE)).toEqual({ tipo: "mes", de: "2026-10-01", ate: HOJE, aberto: true });
    expect(periodoDoTipo("mes-passado", HOJE)).toEqual({ tipo: "mes-passado", de: "2026-09-01", ate: "2026-09-30" });
    expect(periodoDoTipo("ano", HOJE)).toEqual({ tipo: "ano", de: "2026-01-01", ate: HOJE, aberto: true });
    expect(periodoDoTipo("12m", HOJE)).toEqual({ tipo: "12m", de: "2025-11-01", ate: HOJE, aberto: true });
  });

  it("mês passado em janeiro é dezembro do ano anterior", () => {
    expect(periodoDoTipo("mes-passado", "2027-01-05")).toEqual({ tipo: "mes-passado", de: "2026-12-01", ate: "2026-12-31" });
    expect(periodoDoTipo("12m", "2027-01-05").de).toBe("2026-02-01");
  });

  it("lê e escreve o endereço", () => {
    expect(lerPeriodo({ periodo: "ano" }, HOJE)).toEqual(periodoDoTipo("ano", HOJE));
    expect(lerPeriodo({ de: "2026-03-01", ate: "2026-05-31" }, HOJE)).toEqual(datas("2026-03-01", "2026-05-31"));
    // Trocadas, futuro e lixo.
    expect(lerPeriodo({ de: "2026-05-31", ate: "2026-03-01" }, HOJE)).toEqual(datas("2026-03-01", "2026-05-31"));
    expect(lerPeriodo({ de: "2026-09-01", ate: "2027-01-01" }, HOJE)).toEqual({ ...datas("2026-09-01", HOJE), aberto: true });
    expect(lerPeriodo({ de: "2026-11-01", ate: "2026-12-01" }, HOJE)).toBeNull();
    expect(lerPeriodo({ de: "2026-02-30", ate: "2026-03-01" }, HOJE)).toBeNull();
    expect(lerPeriodo({ periodo: "tudo" }, HOJE)).toBeNull();
    expect(lerPeriodo({}, HOJE)).toBeNull();
    expect(parametrosDoPeriodo(periodoDoTipo("12m", HOJE))).toBe("periodo=12m");
    expect(parametrosDoPeriodo(datas("2026-03-01", "2026-05-31"))).toBe("de=2026-03-01&ate=2026-05-31");
  });

  it("os nomes", () => {
    expect(rotuloDoPeriodo(periodoDoTipo("mes", HOJE), HOJE)).toEqual({ nome: "Este mês", sub: "até 13 out" });
    expect(rotuloDoPeriodo(periodoDoTipo("mes-passado", HOJE), HOJE)).toEqual({ nome: "Mês passado", sub: "set 2026" });
    expect(rotuloDoPeriodo(periodoDoTipo("ano", HOJE), HOJE)).toEqual({ nome: "Este ano", sub: "jan a out 2026" });
    expect(rotuloDoPeriodo(periodoDoTipo("12m", HOJE), HOJE)).toEqual({ nome: "Últimos 12 meses", sub: "nov 2025 a out 2026" });
    expect(rotuloDoPeriodo(datas("2026-03-01", "2026-03-31"), HOJE)).toEqual({ nome: "Março", sub: "2026" });
    expect(rotuloDoPeriodo(datas("2025-01-01", "2025-12-31"), HOJE)).toEqual({ nome: "2025", sub: "o ano inteiro" });
    expect(rotuloDoPeriodo(datas("2026-03-01", "2026-06-30"), HOJE)).toEqual({ nome: "Mar a jun", sub: "2026" });
    expect(rotuloDoPeriodo(datas("2026-03-15", "2026-04-10"), HOJE).nome).toBe("15 mar a 10 abr 2026");
    expect(noPeriodoTexto(periodoDoTipo("ano", HOJE), HOJE)).toBe("em 2026");
    expect(noPeriodoTexto(periodoDoTipo("mes-passado", HOJE), HOJE)).toBe("em setembro");
  });

  it("um mês só e um ano só", () => {
    expect(umMesSo(periodoDoTipo("mes", HOJE), HOJE)).toEqual({ ano: 2026, mes: 10 });
    expect(umMesSo(periodoDoTipo("mes-passado", HOJE), HOJE)).toEqual({ ano: 2026, mes: 9 });
    expect(umMesSo(datas("2026-09-01", "2026-09-29"), HOJE)).toBeNull();
    expect(umMesSo(periodoDoTipo("ano", HOJE), HOJE)).toBeNull();
    expect(anoSo(periodoDoTipo("ano", HOJE), HOJE)).toBe(2026);
    expect(anoSo(datas("2025-01-01", "2025-12-31"), HOJE)).toBe(2025);
    expect(anoSo(periodoDoTipo("12m", HOJE), HOJE)).toBeNull();
  });

  it("os meses que o período toca, na virada do ano", () => {
    expect(mesesDoPeriodo(datas("2025-11-15", "2026-02-03"))).toEqual([
      { ano: 2025, mes: 11 },
      { ano: 2025, mes: 12 },
      { ano: 2026, mes: 1 },
      { ano: 2026, mes: 2 },
    ]);
  });

  it("atalhos de mês e ano no Escolher datas", () => {
    const a = atalhosDeDatas(HOJE, 2026);
    expect(a.anos).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(a.meses[9]).toMatchObject({ de: "2026-10-01", ate: "2026-10-31", futuro: false });
    // Outubro inteiro, lido do endereço, vira "Este mês" até hoje.
    expect(rotuloDoPeriodo(lerPeriodo({ de: a.meses[9].de, ate: a.meses[9].ate }, HOJE)!, HOJE).nome).toBe("Este mês");
    expect(a.meses[10].futuro).toBe(true);
    expect(atalhosDeDatas(HOJE, 2024).meses[1]).toMatchObject({ de: "2024-02-01", ate: "2024-02-29" });
  });
});

describe("que lançamento entra", () => {
  it("mês inteiro dentro: o mês do lançamento manda, com ou sem dia", () => {
    const p = datas("2026-09-01", "2026-09-30");
    expect(dentroDoPeriodo(venda(2026, 9, 1), p)).toBe(true);
    // A entrada empurrada para o mês seguinte (data em agosto, mês setembro) conta em setembro.
    expect(dentroDoPeriodo(venda(2026, 9, 1, { entryDate: "2026-08-28" }), p)).toBe(true);
    expect(dentroDoPeriodo(venda(2026, 8, 1, { entryDate: "2026-09-02" }), p)).toBe(false);
  });

  it("mês cortado: o dia manda; sem dia, vale o dia 1", () => {
    const p = datas("2026-03-15", "2026-04-10");
    expect(dentroDoPeriodo(venda(2026, 3, 1, { entryDate: "2026-03-20" }), p)).toBe(true);
    expect(dentroDoPeriodo(venda(2026, 3, 1, { entryDate: "2026-03-14" }), p)).toBe(false);
    expect(dentroDoPeriodo(venda(2026, 4, 1, { entryDate: "2026-04-10" }), p)).toBe(true);
    expect(dentroDoPeriodo(venda(2026, 4, 1, { entryDate: "2026-04-11" }), p)).toBe(false);
    expect(dentroDoPeriodo(venda(2026, 3, 1), p)).toBe(false);
    expect(dentroDoPeriodo(venda(2026, 4, 1), p)).toBe(true);
  });

  it("este mês até hoje: o mês inteiro conta, como no recibo", () => {
    expect(dentroDoPeriodo(venda(2026, 10, 1), periodoDoTipo("mes", HOJE))).toBe(true);
    // A conta agendada para o dia 25 continua no "Este mês" e no "Este ano".
    expect(dentroDoPeriodo(saida(2026, 10, 1, { entryDate: "2026-10-25" }), periodoDoTipo("mes", HOJE))).toBe(true);
    expect(dentroDoPeriodo(saida(2026, 10, 1, { entryDate: "2026-10-25" }), periodoDoTipo("ano", HOJE))).toBe(true);
    // Escolher datas até um dia antes de hoje corta no dia.
    expect(dentroDoPeriodo(saida(2026, 10, 1, { entryDate: "2026-10-25" }), datas("2026-10-01", "2026-10-12"))).toBe(false);
  });
});

describe("as somas do período", () => {
  it("um mês: igual ao recibo do mês", () => {
    const r = resumoDoPeriodo(ana, periodoDoTipo("mes-passado", HOJE), HOJE);
    const set = reciboDoMes(ana, { ano: 2026, mes: 9 });
    expect(r.recibo.entrou).toBe(set.entrou);
    expect(r.recibo.sobrou).toBe(set.sobrou);
    expect(r.recibo.entrou).toBe(8000 + 1440 + 900 + 600);
    expect(r.despesas).toBe(3000 + 400 + 86.05);
    expect(r.proLabore).toBe(4000);
    expect(r.recibo.impostos).toBe(86.05);
    expect(r.ficou).toBe(Math.round((r.recibo.sobrou - 4000) * 100) / 100);
  });

  it("o ano: quanto ganhou em 2026 é a soma dos meses", () => {
    const r = resumoDoPeriodo(ana, periodoDoTipo("ano", HOJE), HOJE);
    expect(r.recibo.entrou).toBe(8000 * 9 + 1440 + 900 + 600 + 2000 + 500);
    expect(r.despesas).toBe(Math.round((3486.05 * 9 + 300) * 100) / 100);
    expect(r.proLabore).toBe(36000);
    expect(r.recibo.impostos).toBe(Math.round(86.05 * 9 * 100) / 100);
    expect(r.recibo.sobrou).toBe(Math.round((r.recibo.entrou - r.despesas) * 100) / 100);
    expect(r.meses).toHaveLength(10);
    expect(r.meses[9]).toMatchObject({ m: { ano: 2026, mes: 10 }, entrou: 2500, parcial: true });
    expect(r.meses[8].parcial).toBe(false);
    // Nada de 2025 entra.
    expect(r.clientes.find((c) => c.nome === "Café Lume")?.valor).toBe(2340);
  });

  it("intervalo na virada do ano", () => {
    const r = resumoDoPeriodo(ana, datas("2025-12-01", "2026-01-31"), HOJE);
    expect(r.recibo.entrou).toBe(7000 + 8000);
    expect(r.despesas).toBe(1000 + 3486.05);
    expect(r.meses.map((m) => m.m)).toEqual([{ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }]);
  });

  it("intervalo com o mês cortado", () => {
    // 5 a 12 de outubro: a venda do dia 2 e a sem dia (dia 1) ficam de fora.
    const r = resumoDoPeriodo(ana, datas("2026-10-05", "2026-10-12"), HOJE);
    expect(r.recibo.entrou).toBe(0);
    expect(r.despesas).toBe(300);
  });

  it("os maiores clientes juntam o mesmo nome, e o resto vai para sem nome", () => {
    const r = resumoDoPeriodo(ana, periodoDoTipo("12m", HOJE), HOJE);
    expect(r.clientes[0]).toEqual({ nome: "Café Lume", valor: 5000 + 1440 + 900, n: 3 });
    expect(r.clientes[1]).toEqual({ nome: "Marina Costa", valor: 600, n: 1 });
    expect(r.semNome.valor).toBe(7000 + 8000 * 9 + 2000 + 500);
  });

  it("as despesas por categoria da Empresa, sem pró-labore, aplicação ou fatura", () => {
    const r = resumoDoPeriodo(ana, periodoDoTipo("ano", HOJE), HOJE);
    expect(r.categorias.map((c) => [c.chave, c.valor])).toEqual([
      ["ALIMENTACAO", 27300],
      ["MORADIA", 3600],
      ["IMPOSTOS", Math.round(86.05 * 9 * 100) / 100],
    ]);
    expect(r.categorias.reduce((s, c) => s + c.valor, 0)).toBeCloseTo(r.despesas, 2);
  });

  it("período sem nada: zeros, sem quebrar", () => {
    const r = resumoDoPeriodo(ana, datas("2024-01-01", "2024-12-31"), HOJE);
    expect(r.recibo.entrou).toBe(0);
    expect(r.nLancamentos).toBe(0);
    expect(r.meses).toHaveLength(12);
  });
});

describe("tocar num total abre exatamente o que ele soma", () => {
  const p = periodoDoTipo("ano", HOJE);
  const r = resumoDoPeriodo(ana, p, HOJE);
  const dentro = ana.filter((l) => dentroDoPeriodo(l, p));
  const soma = (g: Parameters<typeof noGrupo>[1]) => Math.round(dentro.filter((l) => noGrupo(l, g)).reduce((s, l) => s + l.amount, 0) * 100) / 100;

  it("cada grupo bate com o total da tela", () => {
    expect(soma("entradas")).toBe(r.recibo.entrou);
    expect(soma("despesas")).toBe(r.despesas);
    expect(soma("prolabore")).toBe(r.proLabore);
    expect(soma("impostos")).toBe(r.recibo.impostos);
    for (const c of r.categorias) expect(soma(`cat:${c.chave}`)).toBe(c.valor);
    expect(soma("cliente:Café Lume")).toBe(2340);
    expect(soma("cliente:")).toBe(r.semNome.valor);
    expect(soma("variaveis")).toBe(r.recibo.variaveis);
    expect(soma("fixas")).toBe(r.recibo.fixas);
    expect(Math.round((soma("entradas") - soma("despesas")) * 100) / 100).toBe(r.recibo.sobrou);
  });

  it("lê só grupos válidos", () => {
    expect(lerGrupo("entradas")).toBe("entradas");
    expect(lerGrupo("cat:ALIMENTACAO")).toBe("cat:ALIMENTACAO");
    expect(lerGrupo("cliente:Café Lume")).toBe("cliente:Café Lume");
    expect(lerGrupo("cat:'; drop")).toBeNull();
    expect(lerGrupo("tudo")).toBeNull();
    expect(lerGrupo(null)).toBeNull();
  });
});
