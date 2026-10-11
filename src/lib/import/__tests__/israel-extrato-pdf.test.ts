import { describe, expect, it } from "vitest";
import { isIsraelBankStatement, parseIsraelBankStatement } from "../israel-extrato-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra FICTÍCIA no formato do extrato de conta israelense em inglês: crédito e débito colados
// numa coluna só, do mais novo pro mais antigo, saldo acumulado no fim.
const AMOSTRA = [
  "11.10.2026\tIssue Date:",
  "Account statement Account Name: ישראל ישראלי",
  "For the Period: 11.07.2026 - 11.10.2026 Account Number: 000-00000000",
  "Date Transaction Type Credit Debit Cumulative Balance",
  "09.10.2026 dir tran of salary 10,000.00 ₪ 10,500.00 ₪",
  "01.10.2026 direct trans fee 9.90 ₪ 500.00₪",
  "30.09.2026 credit interest 12.00₪ 509.90₪",
  "27.09.2026 check 1,000.00 ₪ 497.90 ₪",
  "i Excluding Transactions Completed Today and Pending Transactions",
  "2\t/\t1",
  "",
  "-- 1 of 2 --",
  "",
  "11.10.2026\tIssue Date:",
  "Date Transaction Type Credit Debit Cumulative Balance",
  "15.09.2026 leumi mastercard 2,502.10 ₪ 1,497.90₪",
  "13.09.2026 dir tran of salary 4,000.00 ₪ 4,000.00₪",
].join("\n");

describe("extrato de conta de Israel em inglês (shekel)", () => {
  it("reconhece e pega o sinal pela diferença do saldo", () => {
    expect(isIsraelBankStatement(AMOSTRA)).toBe(true);
    expect(parseIsraelBankStatement(AMOSTRA).map((t) => [t.date, t.amount, t.description])).toEqual([
      ["2026-10-09", 10000, "dir tran of salary"],
      ["2026-10-01", -9.9, "direct trans fee"],
      ["2026-09-30", 12, "credit interest"],
      ["2026-09-27", -1000, "check"],
      ["2026-09-15", -2502.1, "leumi mastercard"],
      // a mais antiga não tem saldo embaixo: salário conta como entrada
      ["2026-09-13", 4000, "dir tran of salary"],
    ]);
  });

  it("entra pelo leitor próprio", () => {
    expect(parseStatementComLeitor(AMOSTRA, "pdf").leitor).toBe("israel-extrato");
  });
});
