import { describe, expect, it } from "vitest";
import { computeExecutiveSummary, type Insight } from "../insights";

function makeInsight(tone: Insight["tone"]): Insight {
  return { id: `${tone}-${Math.random()}`, message: "mensagem", tone, category: "fluxo" };
}

describe("computeExecutiveSummary", () => {
  it("returns an info summary when there are no insights", () => {
    const summary = computeExecutiveSummary([]);
    expect(summary.tone).toBe("info");
  });

  it("prioritizes a danger tone whenever any insight is dangerous, even amid successes", () => {
    const summary = computeExecutiveSummary([makeInsight("success"), makeInsight("success"), makeInsight("danger")]);
    expect(summary.tone).toBe("danger");
  });

  it("returns a warning summary when warnings outnumber successes (and there is no danger)", () => {
    const summary = computeExecutiveSummary([makeInsight("warning"), makeInsight("warning"), makeInsight("success")]);
    expect(summary.tone).toBe("warning");
  });

  it("returns a success summary when successes are the majority signal", () => {
    const summary = computeExecutiveSummary([makeInsight("success"), makeInsight("success"), makeInsight("info")]);
    expect(summary.tone).toBe("success");
  });

  it("returns a neutral summary when only info insights are present", () => {
    const summary = computeExecutiveSummary([makeInsight("info"), makeInsight("info")]);
    expect(summary.tone).toBe("info");
  });
});
