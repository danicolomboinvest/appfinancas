import { describe, expect, it } from "vitest";
import {
  scoreReserva,
  scorePoupanca,
  scoreEstrategia,
  scoreMetas,
  combineHealthDimensions,
  statusFromScore,
} from "../health-score";

describe("statusFromScore", () => {
  it("returns sem-dados for null", () => {
    expect(statusFromScore(null)).toBe("sem-dados");
  });
  it("returns boa for >= 70", () => {
    expect(statusFromScore(70)).toBe("boa");
    expect(statusFromScore(100)).toBe("boa");
  });
  it("returns atencao for 40-69", () => {
    expect(statusFromScore(40)).toBe("atencao");
    expect(statusFromScore(69)).toBe("atencao");
  });
  it("returns critica below 40", () => {
    expect(statusFromScore(0)).toBe("critica");
    expect(statusFromScore(39)).toBe("critica");
  });
});

describe("scoreReserva", () => {
  it("returns sem-dados when no target is set", () => {
    expect(scoreReserva(0, 0).score).toBeNull();
  });
  it("caps score at 100 even if current exceeds target", () => {
    const result = scoreReserva(10000, 20000);
    expect(result.score).toBe(100);
    expect(result.status).toBe("boa");
  });
  it("computes a partial percentage", () => {
    const result = scoreReserva(10000, 5000);
    expect(result.score).toBe(50);
    expect(result.status).toBe("atencao");
  });
});

describe("scorePoupanca", () => {
  it("returns sem-dados when there is no income", () => {
    expect(scorePoupanca(0, 0).score).toBeNull();
  });
  it("scores 100 at a 30% savings rate or above", () => {
    const result = scorePoupanca(1000, 700);
    expect(result.score).toBe(100);
  });
  it("scores 0 when spending exceeds income", () => {
    const result = scorePoupanca(1000, 1200);
    expect(result.score).toBe(0);
    expect(result.status).toBe("critica");
  });
  it("scores proportionally for a mid-range rate", () => {
    const result = scorePoupanca(1000, 850); // taxa de 15%
    expect(result.score).toBe(50);
  });
});

describe("scoreEstrategia", () => {
  it("returns sem-dados when there is no strategy defined", () => {
    expect(scoreEstrategia([]).score).toBeNull();
  });
  it("scores 100 when there is no deviation", () => {
    const result = scoreEstrategia([0, 0, 0]);
    expect(result.score).toBe(100);
  });
  it("penalizes larger average deviations", () => {
    const result = scoreEstrategia([0.25, -0.25]); // média de 25 p.p.
    expect(result.score).toBe(50);
  });
});

describe("scoreMetas", () => {
  it("returns sem-dados when there are no goals", () => {
    expect(scoreMetas(0, 0).score).toBeNull();
  });
  it("scores 100 when all goals are on track", () => {
    expect(scoreMetas(3, 3).score).toBe(100);
  });
  it("scores proportionally when some goals are behind", () => {
    expect(scoreMetas(1, 4).score).toBe(25);
  });
});

describe("combineHealthDimensions", () => {
  it("returns sem-dados overall when every dimension is unavailable", () => {
    const result = combineHealthDimensions([
      scoreReserva(0, 0),
      scorePoupanca(0, 0),
      scoreEstrategia([]),
      scoreMetas(0, 0),
    ]);
    expect(result.overallScore).toBeNull();
    expect(result.status).toBe("sem-dados");
  });

  it("averages only the available dimensions, weighted", () => {
    const result = combineHealthDimensions([
      scoreReserva(1000, 1000), // 100, peso 30
      scorePoupanca(0, 0), // sem dados, ignorado
      scoreEstrategia([]), // sem dados, ignorado
      scoreMetas(2, 2), // 100, peso 20
    ]);
    expect(result.overallScore).toBe(100);
    expect(result.status).toBe("boa");
  });

  it("reflects a mixed score across all four dimensions", () => {
    const result = combineHealthDimensions([
      scoreReserva(1000, 1000), // 100 (peso 30)
      scorePoupanca(1000, 1200), // 0 (peso 25)
      scoreEstrategia([0, 0]), // 100 (peso 25)
      scoreMetas(0, 2), // 0 (peso 20)
    ]);
    // (100*30 + 0*25 + 100*25 + 0*20) / 100 = 55
    expect(result.overallScore).toBe(55);
    expect(result.status).toBe("atencao");
  });
});
