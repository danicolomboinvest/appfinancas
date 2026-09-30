import type { MoneyFormatter } from "@/lib/money";

type CampoComFaixa = { kind: "currency" | "percent" | "number" | "select"; suffix?: string; min?: number; max?: number; step?: number };

/** 1, 2, 2,5, 5 ou 10 vezes uma potência de 10: o teto "bonito" de uma escala (R$ 1,5 mi → R$ 2 mi). */
export function arredondaBonito(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const b = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return b * p;
}

/**
 * A faixa do controle deslizante de um campo. A página pode dizer (min/max/step); sem isso, sai
 * do valor de exemplo: dinheiro vai de zero a ~3x o exemplo, percentual até 20% ao ano (ou 3% ao
 * mês), prazo até ~2x. Digitar um número fora da faixa continua valendo: só o controle para na ponta.
 */
export function faixaDoCampo(campo: CampoComFaixa, exemplo: number): { min: number; max: number; step: number } {
  if (campo.kind === "currency") {
    const max = campo.max ?? arredondaBonito(Math.max(exemplo, 100) * 3);
    return { min: campo.min ?? 0, max, step: campo.step ?? arredondaBonito(max / 200) };
  }
  if (campo.kind === "percent") {
    const mensal = campo.suffix === "a.m.";
    // Exemplo 0% (IR zero) ou negativo (imóvel que desvaloriza): arredondaBonito devolve 1 pra
    // valor não positivo, e a faixa virava 0–100% ao ano. Sem exemplo positivo, vale o teto de 20%.
    const max = campo.max ?? (mensal ? Math.max(0.03, exemplo * 2) : exemplo > 0 ? Math.max(0.2, Math.min(1, arredondaBonito(exemplo * 2))) : 0.2);
    return { min: campo.min ?? 0, max, step: campo.step ?? (mensal ? 0.0005 : 0.0025) };
  }
  const max = campo.max ?? Math.max(12, Math.ceil(exemplo * 2));
  return { min: campo.min ?? 0, max, step: campo.step ?? 1 };
}

/** O texto de um atalho: "30 anos" pra 360 meses, "11%" pra 0,11, "R$ 500.000" pra dinheiro. */
export function rotuloDoAtalho(campo: CampoComFaixa, valor: number, money: MoneyFormatter): string {
  if (campo.kind === "currency") return money(valor, { round: true });
  if (campo.kind === "percent") return `${(Math.round(valor * 1e6) / 1e4).toLocaleString("pt-BR")}%`;
  if (campo.suffix === "meses" && valor >= 12 && valor % 12 === 0) {
    const anos = valor / 12;
    return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  }
  return `${valor}${campo.suffix ? ` ${campo.suffix}` : ""}`;
}
