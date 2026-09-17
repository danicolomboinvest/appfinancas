import { describe, expect, it } from "vitest";
import { convertAmount, parseAwesomeRate } from "../rates";

describe("parseAwesomeRate", () => {
  it("reads the pair the source publishes, averaging buy and sell, with the day", () => {
    const payload = { EURBRL: { bid: "5.9061", ask: "5.9081", create_date: "2026-09-16 21:39:01" } };
    expect(parseAwesomeRate(payload, "EUR", "BRL")).toEqual({ from: "EUR", to: "BRL", rate: 5.9071, date: "2026-09-16" });
  });

  it("returns null when the pair is missing or the number is junk", () => {
    expect(parseAwesomeRate({ USDBRL: { bid: "5.15" } }, "EUR", "BRL")).toBeNull();
    expect(parseAwesomeRate({ EURBRL: { bid: "abc" } }, "EUR", "BRL")).toBeNull();
    expect(parseAwesomeRate("nope", "EUR", "BRL")).toBeNull();
  });
});

describe("convertAmount", () => {
  it("rounds to cents", () => {
    expect(convertAmount(2000, 5.9071)).toBe(11814.2);
    expect(convertAmount(33.33, 0.1691)).toBe(5.64);
  });
});
