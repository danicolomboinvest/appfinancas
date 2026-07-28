import { describe, expect, it } from "vitest";
import {
  estimateTrip,
  findDestination,
  computeTripTotals,
  clampCategoryValue,
  MAX_CATEGORY_VALUE,
  TRAVEL_DESTINATIONS,
  TRIP_LIMITS,
} from "../estimates";

describe("estimateTrip", () => {
  it("calcula o total de uma viagem média (2 pessoas, 7 dias, Gramado)", () => {
    const est = estimateTrip({ destinationKey: "gramado", days: 7, travelers: 2, style: "medio" });
    expect(est).not.toBeNull();
    // 2 pessoas = 1 quarto; 7 dias = 6 noites.
    expect(est!.flights).toBe(900 * 2);
    expect(est!.lodging).toBe(380 * 6);
    expect(est!.food).toBe(150 * 7 * 2);
    expect(est!.activities).toBe(120 * 7 * 2);
    const subtotal = est!.flights + est!.lodging + est!.food + est!.activities;
    expect(est!.buffer).toBe(Math.round(subtotal * 0.1));
    expect(est!.total).toBe(subtotal + est!.buffer);
    expect(est!.perPerson).toBe(Math.round(est!.total / 2));
  });

  it("estilo econômico sai mais barato e confortável mais caro que o médio", () => {
    const base = { destinationKey: "paris", days: 10, travelers: 2 } as const;
    const eco = estimateTrip({ ...base, style: "economico" })!;
    const medio = estimateTrip({ ...base, style: "medio" })!;
    const conforto = estimateTrip({ ...base, style: "confortavel" })!;
    expect(eco.total).toBeLessThan(medio.total);
    expect(medio.total).toBeLessThan(conforto.total);
  });

  it("3 viajantes precisam de 2 quartos (hospedagem sobe por quarto, não por pessoa)", () => {
    const dois = estimateTrip({ destinationKey: "rio", days: 5, travelers: 2, style: "medio" })!;
    const tres = estimateTrip({ destinationKey: "rio", days: 5, travelers: 3, style: "medio" })!;
    expect(tres.lodging).toBe(dois.lodging * 2);
  });

  it("clampa dias e viajantes nas faixas válidas em vez de estourar", () => {
    const est = estimateTrip({ destinationKey: "rio", days: 9999, travelers: 999, style: "medio" })!;
    expect(est.days).toBe(TRIP_LIMITS.maxDays);
    expect(est.travelers).toBe(TRIP_LIMITS.maxTravelers);
    const minimo = estimateTrip({ destinationKey: "rio", days: 0, travelers: 0, style: "medio" })!;
    expect(minimo.days).toBe(TRIP_LIMITS.minDays);
    expect(minimo.travelers).toBe(TRIP_LIMITS.minTravelers);
  });

  it("destino desconhecido devolve null (nunca lança)", () => {
    expect(estimateTrip({ destinationKey: "atlantida", days: 7, travelers: 2, style: "medio" })).toBeNull();
    expect(findDestination("atlantida")).toBeNull();
  });

  it("catálogo: todas as chaves são únicas e os valores positivos", () => {
    const keys = new Set(TRAVEL_DESTINATIONS.map((d) => d.key));
    expect(keys.size).toBe(TRAVEL_DESTINATIONS.length);
    for (const d of TRAVEL_DESTINATIONS) {
      expect(d.flightPerPerson).toBeGreaterThan(0);
      expect(d.lodgingPerNight).toBeGreaterThan(0);
      expect(d.foodPerPersonDay).toBeGreaterThan(0);
      expect(d.activitiesPerPersonDay).toBeGreaterThan(0);
    }
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
    const t = computeTripTotals([-100, Number.NaN, 1000]);
    expect(t.subtotal).toBe(1000);
  });
});
