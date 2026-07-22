import { Decimal, toDecimal, type DecimalInput } from "./decimal";
import { pmt } from "./pmt";

export type AmortizationSystem = "SAC" | "PRICE";

export type AmortizationRow = {
  month: number;
  payment: number;
  interest: number;
  amortization: number;
  balance: number;
};

export type AmortizationInput = {
  system: AmortizationSystem;
  principal: DecimalInput;
  monthlyRate: DecimalInput;
  months: number;
};

/**
 * Tabela de amortização mês a mês, compartilhada por Financiar-vs-Alugar e Consórcio.
 * SAC: amortização constante, juros e parcela decrescem ao longo do tempo.
 * Price: parcela fixa (PMT), a composição entre juros e amortização muda mês a mês.
 */
export function generateAmortizationSchedule(input: AmortizationInput): AmortizationRow[] {
  const rate = toDecimal(input.monthlyRate);
  const principal = toDecimal(input.principal);
  let balance = principal;
  const rows: AmortizationRow[] = [];

  const fixedAmortization = input.system === "SAC" ? principal.div(input.months) : null;
  const fixedPayment = input.system === "PRICE" ? pmt(rate, input.months, principal, 0).abs() : null;

  for (let month = 1; month <= input.months; month += 1) {
    const interest = balance.times(rate);
    let amortization = input.system === "SAC" ? fixedAmortization! : fixedPayment!.minus(interest);
    if (amortization.greaterThan(balance)) amortization = balance;
    const payment = amortization.plus(interest);
    balance = balance.minus(amortization);

    rows.push({
      month,
      payment: payment.toNumber(),
      interest: interest.toNumber(),
      amortization: amortization.toNumber(),
      balance: balance.toNumber(),
    });
  }

  return rows;
}

export function totalInterest(rows: AmortizationRow[]): Decimal {
  return rows.reduce((sum, row) => sum.plus(row.interest), new Decimal(0));
}

export function totalPaid(rows: AmortizationRow[]): Decimal {
  return rows.reduce((sum, row) => sum.plus(row.payment), new Decimal(0));
}
