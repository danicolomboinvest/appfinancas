import { afterEach, describe, expect, it, vi } from "vitest";
import { decidirSituacaoDoPar, podeBaixarCopia } from "../acesso";
import { assinaturaDoMes, estadoDoFechamento, mesParaFechar } from "../fechamento";
import { calcularMeuNoCasal } from "../meu-no-casal";
import { cabeMaisUmaTentativa, chaveDaOrigem, LIMITE_DA_PAGINA } from "../limite";
import { inicioDaCobranca, temAdicional } from "../adicional";
import { calcularAcerto } from "@/lib/casal/acerto";
import { readFileSync } from "node:fs";

const DIA = 86_400_000;
const HOJE = new Date("2026-10-11T12:00:00Z");

describe("o par perde o acesso se a titular não renovar, e tudo fica 90 dias", () => {
  it("Casal valendo: liberado", () => {
    expect(decidirSituacaoDoPar({ titularAtiva: true, temAdicional: true, bloqueadoEm: null, agora: HOJE })).toEqual({ tipo: "liberado" });
  });
  it("parou hoje: pausado até 90 dias depois", () => {
    const s = decidirSituacaoDoPar({ titularAtiva: false, temAdicional: true, bloqueadoEm: null, agora: HOJE });
    expect(s.tipo).toBe("pausado");
    if (s.tipo === "pausado") expect((s.ate.getTime() - HOJE.getTime()) / DIA).toBe(90);
  });
  it("sem o adicional da conta do parceiro também pausa", () => {
    expect(decidirSituacaoDoPar({ titularAtiva: true, temAdicional: false, bloqueadoEm: null, agora: HOJE }).tipo).toBe("pausado");
  });
  it("os 90 dias contam do primeiro dia parado, e no 90º acabou", () => {
    const desde = new Date(HOJE.getTime() - 89 * DIA);
    expect(decidirSituacaoDoPar({ titularAtiva: false, temAdicional: true, bloqueadoEm: desde, agora: HOJE }).tipo).toBe("pausado");
    expect(decidirSituacaoDoPar({ titularAtiva: false, temAdicional: true, bloqueadoEm: new Date(HOJE.getTime() - 90 * DIA), agora: HOJE }).tipo).toBe("encerrado");
  });
  it("renovou dentro dos 90 dias: volta como estava", () => {
    expect(decidirSituacaoDoPar({ titularAtiva: true, temAdicional: true, bloqueadoEm: new Date(HOJE.getTime() - 30 * DIA), agora: HOJE })).toEqual({ tipo: "liberado" });
  });
  it("a cópia do que ele lançou pode ser baixada até 90 dias depois de sair", () => {
    expect(podeBaixarCopia(null, HOJE)).toBe(true);
    expect(podeBaixarCopia(new Date(HOJE.getTime() - 89 * DIA), HOJE)).toBe(true);
    expect(podeBaixarCopia(new Date(HOJE.getTime() - 90 * DIA), HOJE)).toBe(false);
  });
});

describe("fechar o mês precisa dos dois", () => {
  const linhas = [
    { id: "1", amount: 2400, category: "EXPENSE", pessoa: "A", doCasal: true },
    { id: "2", amount: 500, category: "EXPENSE", pessoa: "B", doCasal: true },
  ];
  const ass = assinaturaDoMes(linhas);
  const em = new Date("2026-10-02T21:10:00Z");

  it("ninguém conferiu, um conferiu, os dois conferiram", () => {
    expect(estadoDoFechamento(null, ass)).toEqual({ tipo: "ninguem" });
    expect(estadoDoFechamento({ confereA: em, assinaturaA: ass, confereB: null, assinaturaB: null, fechadoEm: null }, ass)).toEqual({ tipo: "falta-um", conferiu: "A", falta: "B" });
    expect(estadoDoFechamento({ confereA: em, assinaturaA: ass, confereB: em, assinaturaB: ass, fechadoEm: em }, ass)).toEqual({ tipo: "fechado", em });
  });

  it("alguém lançou ou mudou depois do primeiro confere: as confirmações caem", () => {
    const novo = assinaturaDoMes([...linhas, { id: "3", amount: 186.4, category: "EXPENSE", pessoa: "A", doCasal: true }]);
    expect(estadoDoFechamento({ confereA: em, assinaturaA: ass, confereB: null, assinaturaB: null, fechadoEm: null }, novo)).toEqual({ tipo: "mudou", quem: ["A"] });
    const mudouValor = assinaturaDoMes([{ ...linhas[0], amount: 2401 }, linhas[1]]);
    expect(mudouValor).not.toBe(ass);
  });

  it("a ordem das linhas não muda a assinatura", () => {
    expect(assinaturaDoMes([...linhas].reverse())).toBe(ass);
  });

  it("o mês para fechar é o anterior, inclusive na virada do ano", () => {
    expect(mesParaFechar({ ano: 2026, mes: 10 })).toEqual({ ano: 2026, mes: 9 });
    expect(mesParaFechar({ ano: 2027, mes: 1 })).toEqual({ ano: 2026, mes: 12 });
  });
});

describe("O meu no casal (números da Ana canônica)", () => {
  // Rendas 7.700 e 6.300 (55% e 45%); casa 4.350, Ana pagou 2.850 e Lucas 1.500.
  const lancamentos = [
    { category: "INCOME", amount: 7700, pessoa: "A", doCasal: null },
    { category: "INCOME", amount: 6300, pessoa: "B", doCasal: null },
    { category: "EXPENSE", amount: 2400, pessoa: "A", doCasal: true },
    { category: "EXPENSE", amount: 450, pessoa: "A", doCasal: true },
    { category: "EXPENSE", amount: 500, pessoa: "B", doCasal: true },
    { category: "EXPENSE", amount: 370, pessoa: "B", doCasal: true },
    { category: "EXPENSE", amount: 330, pessoa: "B", doCasal: true },
    { category: "EXPENSE", amount: 210, pessoa: "B", doCasal: true },
    { category: "EXPENSE", amount: 90, pessoa: "B", doCasal: true },
  ];
  const acerto = calcularAcerto(lancamentos, "renda");

  it("para o Lucas: gastei R$ 2.040, coloquei R$ 1.500, mando R$ 458", () => {
    const meu = calcularMeuNoCasal(acerto, "B", [
      { category: "EXPENSE", amount: 22, pessoa: "B", doCasal: false, soMeu: false },
      { category: "EXPENSE", amount: 60, pessoa: "B", doCasal: false, soMeu: false },
      { category: "EXPENSE", amount: 300, pessoa: "B", doCasal: false, soMeu: true },
      { category: "EXPENSE", amount: 120, pessoa: "A", doCasal: false, soMeu: false },
    ]);
    expect(Math.round(meu.gasteiNoMes)).toBe(2040);
    expect(meu.coloqueiNaCasa).toBe(1500);
    expect(Math.round(meu.noAcerto)).toBe(458);
    expect(meu.doMeuVisivel).toBe(82);
    expect(meu.temSoMeu).toBe(true);
  });

  it("para a Ana: recebe os mesmos R$ 458 (negativo = recebe)", () => {
    const meu = calcularMeuNoCasal(acerto, "A", []);
    expect(meu.noAcerto).toBeLessThan(0);
    expect(Math.round(Math.abs(meu.noAcerto))).toBe(458);
    expect(meu.coloqueiNaCasa).toBe(2850);
  });
});

describe("limite na página do convite", () => {
  it(`até ${LIMITE_DA_PAGINA.maximo} tentativas em 15 minutos por origem`, () => {
    const agora = new Date();
    const muitas = Array.from({ length: LIMITE_DA_PAGINA.maximo }, (_, i) => new Date(agora.getTime() - i * 1000));
    expect(cabeMaisUmaTentativa(muitas.slice(1), agora)).toBe(true);
    expect(cabeMaisUmaTentativa(muitas, agora)).toBe(false);
    const antigas = muitas.map((d) => new Date(d.getTime() - LIMITE_DA_PAGINA.janelaMs));
    expect(cabeMaisUmaTentativa(antigas, agora)).toBe(true);
  });

  it("a chave da origem não carrega o IP", () => {
    const k = chaveDaOrigem("200.10.20.30, 10.0.0.1", "segredo");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("200.10");
    expect(chaveDaOrigem("200.10.20.30", "segredo")).toBe(k);
    expect(chaveDaOrigem("200.10.20.31", "segredo")).not.toBe(k);
  });
});

describe("a ponte da cobrança (trocar pela de lá na junção)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("tem a mesma assinatura da regra do branch cobranca-adicionais", () => {
    const fonte = readFileSync("src/lib/casal-login/adicional.ts", "utf-8");
    expect(fonte).toContain("export async function temAdicional(userId: string, adicional: Adicional, agora: Date = new Date()): Promise<boolean>");
    expect(fonte).toContain('export type Adicional = "perfil_empresa" | "conta_parceiro"');
  });

  it("sem ADICIONAIS_COBRAR_DESDE (como hoje), todo mundo tem a conta do parceiro", async () => {
    vi.stubEnv("ADICIONAIS_COBRAR_DESDE", "");
    expect(inicioDaCobranca()).toBeNull();
    expect(await temAdicional("ana", "conta_parceiro")).toBe(true);
  });

  it("antes da data, todo mundo tem; ligada sem a junção, falha fechada", async () => {
    vi.stubEnv("ADICIONAIS_COBRAR_DESDE", "2026-11-03");
    expect(await temAdicional("ana", "conta_parceiro", new Date("2026-11-02T12:00:00Z"))).toBe(true);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await temAdicional("ana", "conta_parceiro", new Date("2026-11-04T12:00:00Z"))).toBe(false);
    expect(aviso).toHaveBeenCalled();
  });
});

describe("o link é público só em /par/", () => {
  it("o proxy libera /par/ com a barra, e não /parametros", () => {
    const proxy = readFileSync("src/proxy.ts", "utf-8");
    expect(proxy).toContain('"/par/"');
    expect(proxy).not.toMatch(/"\/par"[,\]]/);
  });
});
