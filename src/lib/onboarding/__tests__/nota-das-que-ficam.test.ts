import { describe, expect, it } from "vitest";
import { notaDasQueFicam } from "../conferencia-inicial";

describe("notaDasQueFicam", () => {
  it("singular com 1, plural com mais", () => {
    expect(notaDasQueFicam(1)).toBe("O outro fica para quando quiser.");
    expect(notaDasQueFicam(4)).toBe("Os outros 4 ficam para quando quiser.");
  });
});
