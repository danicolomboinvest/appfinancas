import { describe, expect, it } from "vitest";
import {
  estimateTrip,
  findDestination,
  searchDestinations,
  findCheaperMonth,
  computeTripTotals,
  clampCategoryValue,
  MAX_CATEGORY_VALUE,
  TRAVEL_DESTINATIONS,
  TRIP_LIMITS,
} from "../estimates";

const trip = (legs: { destinationKey: string; days: number }[], travelers = 2, style: "economico" | "medio" | "confortavel" = "medio") =>
  estimateTrip({ legs, travelers, style });

describe("estimateTrip — um destino", () => {
  it("calcula diárias e passagem de uma viagem simples", () => {
    const est = trip([{ destinationKey: "gramado", days: 7 }])!;
    expect(est).not.toBeNull();
    // Gramado: tier "caro" (620/400... hosp 620, comida 220, passeios 160), band "nacional" (950).
    // 2 pessoas = 1 quarto; 7 dias no último (único) trecho = 6 noites.
    expect(est.legs).toHaveLength(1);
    expect(est.legs[0].nights).toBe(6);
    expect(est.lodging).toBe(620 * 6);
    expect(est.food).toBe(220 * 7 * 2);
    expect(est.activities).toBe(160 * 7 * 2);
    expect(est.flights).toBe(950 * 2);
    const subtotal = est.flights + est.lodging + est.food + est.activities;
    expect(est.buffer).toBe(Math.round(subtotal * 0.1));
    expect(est.total).toBe(subtotal + est.buffer);
    expect(est.perPerson).toBe(Math.round(est.total / 2));
  });

  it("estilo econômico sai mais barato e confortável mais caro que o médio", () => {
    const legs = [{ destinationKey: "paris", days: 10 }];
    expect(trip(legs, 2, "economico")!.total).toBeLessThan(trip(legs, 2, "medio")!.total);
    expect(trip(legs, 2, "medio")!.total).toBeLessThan(trip(legs, 2, "confortavel")!.total);
  });

  it("3 viajantes precisam de 2 quartos (hospedagem sobe por quarto, não por pessoa)", () => {
    const dois = trip([{ destinationKey: "rio-de-janeiro", days: 5 }], 2)!;
    const tres = trip([{ destinationKey: "rio-de-janeiro", days: 5 }], 3)!;
    expect(tres.lodging).toBe(dois.lodging * 2);
  });
});

describe("estimateTrip — vários destinos", () => {
  it("cada trecho usa as diárias do SEU destino e soma os dias", () => {
    const est = trip([
      { destinationKey: "paris", days: 3 },
      { destinationKey: "roma", days: 4 },
    ])!;
    expect(est.legs).toHaveLength(2);
    expect(est.totalDays).toBe(7);
    // Só o último trecho perde uma noite (a última noite já é a volta pra casa).
    expect(est.legs[0].nights).toBe(3);
    expect(est.legs[1].nights).toBe(3);
    // Paris é "premium" (900/noite) e Roma "caro" (620/noite): diárias diferentes por trecho.
    expect(est.legs[0].lodging).toBe(900 * 3);
    expect(est.legs[1].lodging).toBe(620 * 3);
    expect(est.lodging).toBe(est.legs[0].lodging + est.legs[1].lodging);
  });

  it("passagem = voo principal + conexão, não duas idas e voltas", () => {
    const soParis = trip([{ destinationKey: "paris", days: 7 }])!;
    const parisRoma = trip([
      { destinationKey: "paris", days: 3 },
      { destinationKey: "roma", days: 4 },
    ])!;
    // Uma passagem pra Europa (4600) + trecho interno (600), por pessoa.
    expect(soParis.flights).toBe(4600 * 2);
    expect(parisRoma.flights).toBe((4600 + 600) * 2);
    expect(parisRoma.flights).toBeLessThan(soParis.flights * 2);
  });

  it("conexão entre regiões diferentes custa mais que dentro da mesma região", () => {
    const mesmaRegiao = trip([
      { destinationKey: "paris", days: 3 },
      { destinationKey: "roma", days: 3 },
    ])!;
    const outraRegiao = trip([
      { destinationKey: "paris", days: 3 },
      { destinationKey: "toquio", days: 3 },
    ])!;
    expect(outraRegiao.flights).toBeGreaterThan(mesmaRegiao.flights);
  });

  it("o voo principal é o do destino mais caro, esteja ele em qualquer posição", () => {
    const primeiro = trip([
      { destinationKey: "toquio", days: 3 },
      { destinationKey: "bangkok", days: 3 },
    ])!;
    const invertido = trip([
      { destinationKey: "bangkok", days: 3 },
      { destinationKey: "toquio", days: 3 },
    ])!;
    expect(primeiro.flights).toBe(invertido.flights);
  });
});

describe("estimateTrip — robustez", () => {
  it("clampa dias e viajantes nas faixas válidas em vez de estourar", () => {
    const est = trip([{ destinationKey: "rio-de-janeiro", days: 9999 }], 999)!;
    expect(est.legs[0].days).toBe(TRIP_LIMITS.maxDaysPerLeg);
    expect(est.travelers).toBe(TRIP_LIMITS.maxTravelers);
    const minimo = trip([{ destinationKey: "rio-de-janeiro", days: 0 }], 0)!;
    expect(minimo.legs[0].days).toBe(TRIP_LIMITS.minDays);
    expect(minimo.travelers).toBe(TRIP_LIMITS.minTravelers);
  });

  it("ignora destino desconhecido e devolve null se não sobrar nenhum", () => {
    expect(trip([{ destinationKey: "atlantida", days: 7 }])).toBeNull();
    expect(trip([])).toBeNull();
    expect(findDestination("atlantida")).toBeNull();
    const misto = trip([
      { destinationKey: "atlantida", days: 3 },
      { destinationKey: "lisboa", days: 4 },
    ])!;
    expect(misto.legs).toHaveLength(1);
    expect(misto.legs[0].destination.key).toBe("lisboa");
  });

  it("catálogo: chaves únicas, campos preenchidos e bom tamanho", () => {
    const keys = new Set(TRAVEL_DESTINATIONS.map((dest) => dest.key));
    expect(keys.size).toBe(TRAVEL_DESTINATIONS.length);
    expect(TRAVEL_DESTINATIONS.length).toBeGreaterThan(150);
    for (const dest of TRAVEL_DESTINATIONS) {
      expect(dest.label.trim().length).toBeGreaterThan(0);
      expect(dest.country.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("searchDestinations", () => {
  it("acha sem acento e sem caixa", () => {
    expect(searchDestinations("sao paulo")[0].key).toBe("sao-paulo");
    expect(searchDestinations("FLORIANOPOLIS")[0].key).toBe("florianopolis");
  });

  it("quem começa com o termo vem antes de quem só contém", () => {
    const rio = searchDestinations("rio").map((dest) => dest.key);
    expect(rio.indexOf("rio-de-janeiro")).toBeLessThan(rio.indexOf("rio-branco"));
  });

  it("acha por apelido e por país", () => {
    expect(searchDestinations("ny")[0].key).toBe("nova-york");
    expect(searchDestinations("noronha")[0].key).toBe("fernando-de-noronha");
    const portugal = searchDestinations("portugal").map((dest) => dest.key);
    expect(portugal).toContain("lisboa");
    expect(portugal).toContain("porto-pt");
  });

  it("termo sem resultado devolve lista vazia; busca vazia devolve sugestões", () => {
    expect(searchDestinations("zzzzzz")).toHaveLength(0);
    expect(searchDestinations("").length).toBeGreaterThan(0);
  });
});

describe("computeTripTotals / clampCategoryValue", () => {
  it("soma categorias (fixas + extras), aplica 10% de margem", () => {
    const t = computeTripTotals([1000, 2000, 500, 500, 300]);
    expect(t.subtotal).toBe(4300);
    expect(t.buffer).toBe(430);
    expect(t.total).toBe(4730);
  });

  it("saneia valores editados: negativo/NaN viram 0, teto respeitado", () => {
    expect(clampCategoryValue(-50)).toBe(0);
    expect(clampCategoryValue(Number.NaN)).toBe(0);
    expect(clampCategoryValue(99_999_999)).toBe(MAX_CATEGORY_VALUE);
    expect(computeTripTotals([-100, Number.NaN, 1000]).subtotal).toBe(1000);
  });
});

describe("temporada (o mesmo lugar custa diferente conforme o mês)", () => {
  const emCaboFrio = (month: number) =>
    estimateTrip({ legs: [{ destinationKey: "cabo-frio", days: 7 }], travelers: 2, style: "medio", month })!;

  it("Cabo Frio em dezembro é bem mais caro que em maio (alta temporada de praia)", () => {
    const dezembro = emCaboFrio(12);
    const maio = emCaboFrio(5);
    expect(dezembro.total).toBeGreaterThan(maio.total);
    // Réveillon não é 5% mais caro: a diferença tem que ser sentida.
    expect(dezembro.total / maio.total).toBeGreaterThan(1.3);
    expect(dezembro.seasonLevel).toBe("alta");
    expect(maio.seasonLevel).toBe("baixa");
  });

  it("a alta temporada NÃO é a mesma pra todo destino", () => {
    const trip = (key: string, month: number) =>
      estimateTrip({ legs: [{ destinationKey: key, days: 7 }], travelers: 2, style: "medio", month })!;
    // Praia brasileira: dezembro caro, julho intermediário.
    expect(trip("cabo-frio", 12).total).toBeGreaterThan(trip("cabo-frio", 7).total);
    // Serra gaúcha: julho (frio) é mais caro que março.
    expect(trip("gramado", 7).total).toBeGreaterThan(trip("gramado", 3).total);
    // Mediterrâneo: agosto é o pico, janeiro é o fundo.
    expect(trip("santorini", 8).total).toBeGreaterThan(trip("santorini", 1).total * 1.5);
    // Safári africano: seca (agosto) acima da estação chuvosa (março).
    expect(trip("kruger", 8).total).toBeGreaterThan(trip("kruger", 3).total);
    // Dubai: inverno ameno é caro, verão escaldante é barato — invertido em relação à Europa.
    expect(trip("dubai", 1).total).toBeGreaterThan(trip("dubai", 7).total);
  });

  it("temporada mexe em passagem e hospedagem, não em comida e passeios", () => {
    const dezembro = emCaboFrio(12);
    const maio = emCaboFrio(5);
    expect(dezembro.flights).toBeGreaterThan(maio.flights);
    expect(dezembro.lodging).toBeGreaterThan(maio.lodging);
    expect(dezembro.food).toBe(maio.food);
    expect(dezembro.activities).toBe(maio.activities);
  });

  it("sem mês informado, o cálculo sai neutro (sem ajuste)", () => {
    const semMes = estimateTrip({ legs: [{ destinationKey: "cabo-frio", days: 7 }], travelers: 2, style: "medio" })!;
    expect(semMes.seasonFactor).toBe(1);
    expect(semMes.seasonLevel).toBe("media");
  });

  it("num roteiro, o destino onde se fica mais tempo pesa mais na temporada", () => {
    const maisTempoNaPraia = estimateTrip({
      legs: [
        { destinationKey: "cabo-frio", days: 10 },
        { destinationKey: "sao-paulo", days: 1 },
      ],
      travelers: 2,
      style: "medio",
      month: 12,
    })!;
    expect(maisTempoNaPraia.seasonLevel).toBe("alta");
  });

  it("sugere um mês mais barato quando a economia vale a pena", () => {
    const dica = findCheaperMonth({
      legs: [{ destinationKey: "cabo-frio", days: 7 }],
      travelers: 2,
      style: "medio",
      month: 12,
    });
    expect(dica).not.toBeNull();
    expect(dica!.savings).toBeGreaterThan(0);
    // Maio/junho são o fundo do poço na praia brasileira.
    expect([5, 6]).toContain(dica!.month);
  });

  it("não sugere nada quando já se está num mês barato", () => {
    expect(
      findCheaperMonth({ legs: [{ destinationKey: "cabo-frio", days: 7 }], travelers: 2, style: "medio", month: 5 }),
    ).toBeNull();
  });

  it("mês inválido não quebra: cai em neutro", () => {
    for (const month of [0, 13, -1, 1.5, Number.NaN]) {
      const est = estimateTrip({ legs: [{ destinationKey: "cabo-frio", days: 5 }], travelers: 2, style: "medio", month })!;
      expect(est.seasonFactor).toBe(1);
    }
  });
});
