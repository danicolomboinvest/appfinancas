import { describe, expect, it } from "vitest";
import { pareceForaDoBrasil } from "../fora-do-brasil";

describe("celular fora do Brasil pelo fuso", () => {
  it("Argentina, Portugal e Estados Unidos estão fora", () => {
    expect(pareceForaDoBrasil("America/Argentina/Buenos_Aires")).toBe(true);
    expect(pareceForaDoBrasil("America/Buenos_Aires")).toBe(true);
    expect(pareceForaDoBrasil("Europe/Lisbon")).toBe(true);
    expect(pareceForaDoBrasil("America/New_York")).toBe(true);
  });
  it("fusos do Brasil e fuso sem informação contam como Brasil", () => {
    expect(pareceForaDoBrasil("America/Sao_Paulo")).toBe(false);
    expect(pareceForaDoBrasil("America/Manaus")).toBe(false);
    expect(pareceForaDoBrasil("America/Noronha")).toBe(false);
    expect(pareceForaDoBrasil("Etc/UTC")).toBe(false);
    expect(pareceForaDoBrasil("")).toBe(false);
    expect(pareceForaDoBrasil(undefined)).toBe(false);
  });
});
