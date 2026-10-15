import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatMoney } from "@/lib/money";
import { lerSobrou, sobrouDoResumo, sobrouEmReais } from "../sobrou";
import { guardadoDoMes } from "../guardado";

/**
 * O sobrou e o guardado do mês, o mesmo número em todas as telas (15/10/2026).
 *
 * - Dívidas cortava o sobrou com Math.floor e o Resumo arredonda para o mais perto: R$ 199,60
 *   era "Sobrou R$ 200" no Resumo e "O que sobrou R$ 199" nas Dívidas.
 * - A Carteira dizia max(líquido, aportes positivos até hoje) e o Resumo a soma líquida: aportou
 *   R$ 1.000 e resgatou R$ 400, o Resumo dizia "Guardou R$ 600" e a Carteira "R$ 1.000".
 */

const resumoTela = (v: number) => formatMoney(v, "BRL", { round: true });

describe("sobrou em reais inteiros: Dívidas igual ao Resumo", () => {
  const resumo = { totalIncome: 5000, totalExpense: 3800.4, totalInvestment: 1000 };

  it("R$ 199,60: o Resumo mostra R$ 200 e as Dívidas também (antes R$ 199)", () => {
    const sobrou = sobrouDoResumo(resumo);
    expect(sobrou).toBe(199.6);
    expect(resumoTela(lerSobrou(sobrou).valor)).toBe(resumoTela(200));
    expect(sobrouEmReais(sobrou)).toBe(200);
    expect(Math.floor(sobrou)).toBe(199);
  });

  it("meio real sobe, como o formatador do Resumo; zero nunca vira -0", () => {
    expect(sobrouEmReais(250.5)).toBe(251);
    expect(resumoTela(250.5)).toBe(resumoTela(251));
    expect(Object.is(sobrouEmReais(-0.2), 0)).toBe(true);
  });

  it("a página de Dívidas usa o arredondamento único (sem Math.floor no sobrou)", () => {
    const pagina = readFileSync("src/app/(app)/dividas/page.tsx", "utf-8");
    expect(pagina).toMatch(/sobrouEmReais\(sobrouDoResumo\(resumo\)\)/);
    expect(pagina).not.toMatch(/Math\.floor/);
  });
});

describe("guardou no mês: Carteira igual ao Resumo", () => {
  it("aporte de R$ 1.000 e resgate de R$ 400: os dois dizem R$ 600 (a Carteira dizia R$ 1.000)", () => {
    const resumo = { totalIncome: 7000, totalExpense: 4000, totalInvestment: 1000 - 400 };
    const aportesPositivosAteHoje = 1000;
    expect(guardadoDoMes(resumo)).toBe(600);
    expect(Math.max(resumo.totalInvestment, aportesPositivosAteHoje)).toBe(1000);
    // E fecha a conta do sobrou: entrou − gastou − guardou.
    expect(sobrouDoResumo(resumo)).toBe(7000 - 4000 - guardadoDoMes(resumo));
  });

  it("centavos exatos: 0,10 + 0,20 de aporte é 0,30", () => {
    expect(guardadoDoMes({ totalInvestment: 0.1 + 0.2 })).toBe(0.3);
  });

  it("a Carteira e o quadro do Resumo leem a mesma função", () => {
    expect(readFileSync("src/app/(app)/carteira/page.tsx", "utf-8")).toMatch(/guardouNoMes = guardadoDoMes\(resumoDoMes\)/);
    expect(readFileSync("src/app/(app)/mensal/foco/QuadroDoMes.tsx", "utf-8")).toMatch(/money\(guardadoDoMes\(resumo\)\)/);
  });
});
