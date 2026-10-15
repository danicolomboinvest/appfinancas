import { describe, expect, it } from "vitest";
import { registroDoComecoDoMes, rendimentoDoMes, type AtivoRegistrado } from "../rendimento";

const at = (id: string, atual: number, investido: number | null): AtivoRegistrado => ({ id, atual, investido });
const reg = (dia: string, ativos: AtivoRegistrado[]) => ({ dia, ativos });
const HOJE = "2026-10-15";

describe("rendimento do mês da Carteira", () => {
  it("só o preço mexeu: o rendimento é a diferença do ganho", () => {
    const x = rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500)])], HOJE, [at("a", 10220, 9500)]);
    expect(x).toMatchObject({ valor: 220, desde: "2026-10-01", deFora: 0 });
    expect(x!.pct).toBeCloseTo(0.022, 6);
  });

  it("aporte não é rendimento: sobe o atual e o investido juntos", () => {
    // Pôs R$ 1.000 e nada rendeu.
    expect(rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500)])], HOJE, [at("a", 11000, 10500)])).toMatchObject({ valor: 0 });
  });

  it("aporte e rendimento no mesmo mês: só o rendimento aparece", () => {
    expect(rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500)])], HOJE, [at("a", 11150, 10500)])).toMatchObject({ valor: 150 });
  });

  it("perda aparece negativa", () => {
    expect(rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500)])], HOJE, [at("a", 9920, 9500)])).toMatchObject({ valor: -80 });
  });

  it("ativo novo no meio do mês, com ganho que já vinha de antes, fica de fora", () => {
    // O ativo b foi comprado há um ano por 1.000 e hoje vale 1.800: esse ganho não é do mês.
    const x = rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500)])], HOJE, [at("a", 10100, 9500), at("b", 1800, 1000)]);
    expect(x).toMatchObject({ valor: 100, deFora: 1 });
  });

  it("ativo apagado não puxa o rendimento para baixo", () => {
    const x = rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500), at("b", 5000, 4000)])], HOJE, [at("a", 10100, 9500)]);
    expect(x).toMatchObject({ valor: 100, deFora: 0 });
  });

  it("ativo sem valor investido não entra, mesmo que o valor tenha mudado", () => {
    const x = rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500), at("b", 3000, null)])], HOJE, [at("a", 10100, 9500), at("b", 3600, null)]);
    expect(x).toMatchObject({ valor: 100, deFora: 1 });
  });

  it("investido preenchido só agora (antes vazio) fica de fora: o ganho antigo não é do mês", () => {
    const x = rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500), at("b", 3000, null)])], HOJE, [at("a", 10100, 9500), at("b", 3000, 2000)]);
    expect(x).toMatchObject({ valor: 100, deFora: 1 });
  });

  it("carteira mista: ações, renda fixa e dólar somam cada um o que rendeu", () => {
    const base = [at("acao", 5000, 4000), at("rf", 20000, 19000), at("usd", 5020, 5000)];
    const hoje = [at("acao", 5200, 4000), at("rf", 20150, 19000), at("usd", 5120, 5000)];
    const x = rendimentoDoMes([reg("2026-10-01", base)], HOJE, hoje);
    expect(x).toMatchObject({ valor: 200 + 150 + 100, deFora: 0 });
    expect(x!.pct).toBeCloseTo(450 / 30020, 6);
  });

  it("vários aportes em ativos diferentes, um só rendeu", () => {
    const base = [at("a", 8000, 7000), at("b", 4000, 4000)];
    const hoje = [at("a", 8300, 7300), at("b", 4500, 4400)]; // a: aportou 300, rendeu 0; b: aportou 400, rendeu 100
    expect(rendimentoDoMes([reg("2026-10-01", base)], HOJE, hoje)).toMatchObject({ valor: 100 });
  });

  it("sem registro do começo do mês, não inventa: devolve null", () => {
    expect(rendimentoDoMes([], HOJE, [at("a", 10100, 9500)])).toBeNull();
    expect(rendimentoDoMes([reg("2026-08-10", [at("a", 10000, 9500)])], HOJE, [at("a", 10100, 9500)])).toBeNull();
  });

  it("nenhum ativo comparável (todos novos ou sem investido): null, nunca zero de mentira", () => {
    expect(rendimentoDoMes([reg("2026-10-01", [at("a", 10000, 9500)])], HOJE, [at("b", 1800, 1000)])).toBeNull();
    expect(rendimentoDoMes([reg("2026-10-01", [at("a", 10000, null)])], HOJE, [at("a", 10100, null)])).toBeNull();
  });

  it("quem começou a registrar no meio do mês vê o rendimento desde o primeiro registro", () => {
    expect(registroDoComecoDoMes([reg("2026-10-08", []), reg("2026-10-12", [])], HOJE)).toMatchObject({ dia: "2026-10-08" });
  });

  it("o registro de hoje não conta como começo, e até 10 dias antes do dia 1 ainda vale", () => {
    expect(registroDoComecoDoMes([reg(HOJE, [])], HOJE)).toBeNull();
    expect(registroDoComecoDoMes([reg("2026-09-22", []), reg("2026-09-28", [])], HOJE)).toMatchObject({ dia: "2026-09-28" });
    expect(registroDoComecoDoMes([reg("2026-09-18", [])], HOJE)).toBeNull();
  });
});
