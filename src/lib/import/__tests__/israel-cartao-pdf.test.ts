import { describe, expect, it } from "vitest";
import { isIsraelCardStatement, parseIsraelCardStatement } from "../israel-cartao-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra fictícia no formato da fatura de cartão de Israel (colunas em ordem invertida, como o PDF sai).
const AMOSTRA = [
  "פירוט נוסף\tמס' שובר\tסכום חיוב\tסכום עסקה\tשם בית עסק\tתאריך רכישה",
  "הוראת קבע\t208022206\t₪89.00\t₪89.00\tHOT\t28.09.26",
  "211519948\t₪1,574.55\t₪1,574.55\tWOLT\t28.09.26",
  "₪20.00 הנחה\t188445043\t₪0.00\t₪20.00\tדמי כרטיס\t23.09.26",
  "אתר חו\"ל\t167120794\t₪73.00\t₪73.00\tGOOGLE CHATGPT\t22.09.26",
  "הוראת קבע",
].join("\n");

describe("fatura de cartão de Israel (shekel)", () => {
  it("reconhece e lê data, valor cobrado e nome, sem depender do hebraico", () => {
    expect(isIsraelCardStatement(AMOSTRA)).toBe(true);
    const txns = parseIsraelCardStatement(AMOSTRA);
    expect(txns.map((t) => [t.date, t.amount, t.description])).toEqual([
      ["2026-09-28", 89, "HOT"],
      ["2026-09-28", 1574.55, "WOLT"],
      ["2026-09-22", 73, "GOOGLE CHATGPT"],
    ]);
  });

  it("não vira gasto a taxa perdoada (cobrança ₪0,00)", () => {
    expect(parseIsraelCardStatement(AMOSTRA).some((t) => t.date === "2026-09-23")).toBe(false);
  });

  it("lê igual com as colunas na ordem do texto (data primeiro)", () => {
    const direto = "28.09.26\tHOT\t₪89.00\t₪89.00\t208022206\tהוראת קבע\n27.09.26\tשוק\t₪40.44\t₪40.44\t200257667\n26.09.26\tYELLOW\t₪200.57\t₪200.57\t194576185";
    expect(parseIsraelCardStatement(direto).map((t) => t.amount)).toEqual([89, 40.44, 200.57]);
  });

  it("entra no leitor geral", () => {
    expect(parseStatementComLeitor(AMOSTRA, "pdf", 2026).leitor).toBe("israel-cartao");
  });
});
