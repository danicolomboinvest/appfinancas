import { describe, expect, it } from "vitest";
import {
  boardingMonth,
  cheaperMonthTip,
  CHEAPER_MIN_AHEAD,
  goalNameFor,
  monthlyForTrip,
  monthsAhead,
  parseTripPlan,
  seasonByMonth,
  stepMonthly,
  tripValues,
  type TripPlan,
} from "@/lib/travel/assistente";
import {
  airportCodeFor,
  computeTripTotals,
  customDestination,
  destinationsWithoutPlaceType,
  estimateTrip,
  findDestination,
  photoFor,
  placeTypeFor,
  resolveLegDestination,
  searchDestinations,
  tripGoalTargetDate,
} from "@/lib/travel/estimates";
import { computeGoalPlan } from "@/lib/planning/goal";
import { DESTINATION_PHOTOS } from "@/lib/travel/fotos-destinos";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Quarta, 7 de outubro de 2026 (o "hoje" da Ana canônica).
const HOJE = new Date(2026, 9, 7, 12);

/** A viagem de exemplo dos protótipos: Lisboa 5 dias + Paris 4, 2 pessoas, médio, maio de 2027. */
const EXEMPLO: TripPlan = {
  legs: [
    { destinationKey: "lisboa", days: 5 },
    { destinationKey: "paris", days: 4 },
  ],
  travelers: 2,
  style: "medio",
  tripMonth: "2027-05",
  overrides: {},
  extras: [],
  photos: {},
};

describe("uma conta só (pendência 5.1.9)", () => {
  it("o total da viagem de exemplo sai do motor, o mesmo em qualquer tema: R$ 26.681", () => {
    const v = tripValues(EXEMPLO);
    expect(v.fixed).toEqual({ flights: 11440, lodging: 5335, food: 4360, activities: 3120 });
    expect(v.buffer).toBe(2426);
    expect(v.total).toBe(26681);
    expect(v.perPerson).toBe(13341);
  });

  it("é exatamente estimateTrip + computeTripTotals (a tela e a meta não têm conta própria)", () => {
    const e = estimateTrip({ legs: EXEMPLO.legs, travelers: 2, style: "medio", month: 5 })!;
    expect(tripValues(EXEMPLO).total).toBe(e.total);
    expect(computeTripTotals([e.flights, e.lodging, e.food, e.activities]).total).toBe(e.total);
  });

  it("valor trocado na mão e outro custo entram na mesma conta, com os 10% de imprevistos", () => {
    const v = tripValues({ ...EXEMPLO, overrides: { flights: 9000 }, extras: [{ name: "Seguro", value: 400 }, { name: "", value: 0 }] });
    expect(v.fixed.flights).toBe(9000);
    expect(v.extras).toEqual([{ name: "Seguro", value: 400 }]);
    expect(v.total).toBe(computeTripTotals([9000, 5335, 4360, 3120, 400]).total);
  });

  it("os três estilos: mais simples < médio < mais conforto", () => {
    const [a, b, c] = (["economico", "medio", "confortavel"] as const).map((style) => tripValues({ ...EXEMPLO, style }).total);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("fora do real, a estimativa começa zerada e só conta o que ela digitar", () => {
    const v = tripValues({ ...EXEMPLO, overrides: { flights: 1000 } }, { usaEstimativas: false });
    expect(v.fixed).toEqual({ flights: 1000, lodging: 0, food: 0, activities: 0 });
    expect(v.total).toBe(1100);
  });
});

describe("dica do mês mais barato", () => {
  it("só sugere meses a partir de 4 à frente de hoje", () => {
    const dica = cheaperMonthTip(EXEMPLO, HOJE)!;
    expect(dica).not.toBeNull();
    expect(monthsAhead(HOJE, dica.monthValue)).toBeGreaterThanOrEqual(CHEAPER_MIN_AHEAD);
    expect(dica.monthValue).toBe("2027-02");
    expect(dica.savings).toBe(26681 - dica.total);
  });

  it("nunca sugere o mês que vem, mesmo quando ele é o mais barato", () => {
    // Novembro (o mês que vem) é baixa na Europa; a dica não pode cair nele nem em dez, jan.
    for (const tripMonth of ["2027-07", "2027-08", "2026-12"]) {
      const dica = cheaperMonthTip({ ...EXEMPLO, tripMonth }, HOJE);
      if (dica) expect(monthsAhead(HOJE, dica.monthValue)).toBeGreaterThanOrEqual(4);
    }
  });

  it("a economia sai só do que ainda é estimativa: tudo trocado na mão, nenhuma dica", () => {
    const tudo = { flights: 9000, lodging: 5000, food: 4000, activities: 3000 };
    expect(cheaperMonthTip({ ...EXEMPLO, overrides: tudo }, HOJE)).toBeNull();
  });

  it("a cor dos meses segue a mesma temporada que mexe no total", () => {
    const t = seasonByMonth(EXEMPLO);
    expect(t).toHaveLength(12);
    expect(t[6]).toBe("alta"); // julho na Europa
    expect(t[0]).toBe("baixa"); // janeiro
  });
});

describe("guardando por mês e data de embarque", () => {
  it("o 'guardando' é o aporte da meta que vai nascer, arredondado para cima", () => {
    const total = tripValues(EXEMPLO).total;
    const plan = computeGoalPlan({ targetAmount: total, currentAmount: 0, targetDate: tripGoalTargetDate("2027-05")!, annualRate: 0.1, now: HOJE });
    expect(monthlyForTrip(total, "2027-05", 0.1, HOJE)).toBe(Math.ceil(plan.requiredMonthlyContribution));
  });

  it("guardando o necessário, embarca no mês da viagem; guardando menos, depois", () => {
    const total = tripValues(EXEMPLO).total;
    const precisa = monthlyForTrip(total, "2027-05", 0.1, HOJE);
    expect(boardingMonth(total, precisa, 0.1, HOJE)).toBe("2027-05");
    expect(monthsAhead(HOJE, boardingMonth(total, precisa - 300, 0.1, HOJE)!)).toBeGreaterThan(monthsAhead(HOJE, "2027-05"));
    expect(boardingMonth(total, 0, 0.1, HOJE)).toBeNull();
  });

  it("o − e o + andam na grade das centenas e nunca ficam abaixo de R$ 100", () => {
    expect(stepMonthly(3218, -1)).toBe(3200);
    expect(stepMonthly(3218, 1)).toBe(3300);
    expect(stepMonthly(3200, -1)).toBe(3100);
    expect(stepMonthly(150, -1)).toBe(100);
  });
});

describe("destinos: mais brasileiros, tipo de lugar e fora da lista", () => {
  it("todo destino do catálogo tem tipo de lugar (nenhuma foto aleatória)", () => {
    expect(destinationsWithoutPlaceType()).toEqual([]);
  });

  it("sem foto própria, a foto vem do tipo; cidade histórica ou grande nunca usa a foto de outra cidade", () => {
    const semFoto = (key: string) => ({ ...findDestination(key)!, key: `${key}-sem-foto`, placeType: placeTypeFor(findDestination(key)!) });
    expect(photoFor(semFoto("buzios"))).toBe("/fotos/viagem-praia.jpg");
    expect(photoFor(semFoto("gramado"))).toBeNull(); // serra brasileira nunca com montanha nevada
    expect(photoFor(semFoto("interlaken"))).toBe("/fotos/montanha.jpg");
    expect(photoFor(semFoto("ouro-preto"))).toBeNull();
    expect(photoFor(semFoto("londres"))).toBeNull();
    expect(placeTypeFor(findDestination("orlando")!)).toBe("parque");
  });

  it("destino com foto própria usa a dele, e cada chave da lista tem o arquivo", () => {
    for (const key of DESTINATION_PHOTOS) {
      const d = findDestination(key);
      expect(d, key).not.toBeNull();
      expect(photoFor(d!)).toBe(`/fotos/destinos/${key}.webp`);
      expect(existsSync(join(process.cwd(), "public/fotos/destinos", `${key}.webp`)), key).toBe(true);
    }
  });

  it("a foto escolhida do banco manda; foto que não é do banco é ignorada", () => {
    const d = { ...findDestination("buzios")!, key: "buzios-sem-foto", placeType: "praia" as const };
    expect(photoFor(d, "cruzeiro")).toBe("/fotos/cruzeiro.jpg");
    expect(photoFor(d, "https://outro-site/x.jpg")).toBe("/fotos/viagem-praia.jpg");
  });

  it("acha sem acento e pelos lugares novos", () => {
    expect(searchDestinations("buzios")[0].label).toBe("Búzios");
    expect(searchDestinations("pedra azul")[0].key).toBe("domingos-martins");
    expect(searchDestinations("beto carrero")[0].key).toBe("penha");
    expect(searchDestinations("maraú")[0].key).toBe("barra-grande-ba");
  });

  it("lugar fora da lista ('Usar mesmo assim') ganha custo pela região, foto do tipo e marca de estimativa", () => {
    const leg = { destinationKey: "x", days: 3, custom: { label: "Serra do Japi", region: "Brasil" as const, placeType: "serra" as const } };
    const d = resolveLegDestination(leg)!;
    expect(d.custom).toBe(true);
    expect(d.label).toBe("Serra do Japi");
    expect(photoFor(d)).toBeNull();
    const e = estimateTrip({ legs: [leg], travelers: 2, style: "medio", month: 5 })!;
    expect(e.total).toBeGreaterThan(0);
    expect(e.legs[0].destination.custom).toBe(true);
  });

  it("lugar fora da lista com dado estranho não entra", () => {
    expect(customDestination({ label: "   ", region: "Brasil", placeType: "praia" })).toBeNull();
    expect(customDestination({ label: "X", region: "Marte" as never, placeType: "praia" })).toBeNull();
    expect(customDestination({ label: "<b>Ilha</b>", region: "Brasil", placeType: "praia" })!.label).toBe("bIlha/b");
  });

  it("código do aeroporto no cartão de embarque, com as três letras quando não há código", () => {
    expect(airportCodeFor(findDestination("lisboa")!)).toBe("LIS");
    expect(airportCodeFor(findDestination("paris")!)).toBe("CDG");
    expect(airportCodeFor(findDestination("galinhos")!)).toBe("GAL");
  });
});

describe("a viagem guardada na meta", () => {
  it("lê de volta o que foi gravado", () => {
    const lido = parseTripPlan(JSON.parse(JSON.stringify({ ...EXEMPLO, photos: { lisboa: "cruzeiro" } })));
    expect(lido).toEqual({ ...EXEMPLO, photos: { lisboa: "cruzeiro" } });
  });

  it("recusa viagem inválida em vez de quebrar a tela", () => {
    expect(parseTripPlan(null)).toBeNull();
    expect(parseTripPlan({ ...EXEMPLO, legs: [] })).toBeNull();
    expect(parseTripPlan({ ...EXEMPLO, tripMonth: "2027-13" })).toBeNull();
    expect(parseTripPlan({ ...EXEMPLO, photos: { lisboa: "javascript:alert(1)" } })).toBeNull();
    expect(parseTripPlan({ ...EXEMPLO, travelers: 50 })).toBeNull();
  });

  it("nome da meta: um, dois ou mais destinos", () => {
    expect(goalNameFor(["Paris"])).toBe("Viagem: Paris");
    expect(goalNameFor(["Lisboa", "Paris"])).toBe("Viagem: Lisboa e Paris");
    expect(goalNameFor(["Lisboa", "Paris", "Roma"])).toBe("Viagem: Lisboa +2");
  });
});
