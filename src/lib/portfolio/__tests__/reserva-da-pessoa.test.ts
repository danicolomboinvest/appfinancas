import { describe, expect, it } from "vitest";
import { acharMetaDaReserva, reservaDaPessoa } from "../reserva-da-pessoa";

const metaReserva = { id: "g1", icon: "RESERVA", name: "Reserva de emergência", targetAmount: 21000, atual: 4200 };

describe("a reserva da Estratégia é a meta Reserva de emergência (decisão da dona, 12/10/2026)", () => {
  it("acha a meta pelo tipo reserva; sem ela, pelo nome", () => {
    expect(acharMetaDaReserva([{ icon: "VIAGEM", name: "Europa" }, { icon: "RESERVA", name: "Minha base" }])?.name).toBe("Minha base");
    expect(acharMetaDaReserva([{ icon: "GENERICO", name: "Reserva da casa" }])?.name).toBe("Reserva da casa");
    expect(acharMetaDaReserva([{ icon: "VIAGEM", name: "Europa" }])).toBeNull();
  });
  it("só a meta: guardado e alvo são os da meta, custo pelo gasto típico", () => {
    expect(reservaDaPessoa({ meta: metaReserva, antiga: null, gastoTipico: 3500 })).toEqual({ atual: 4200, meta: 21000, custoDeVida: 3500, idDaMeta: "g1" });
  });
  it("meta e simulador antigo: o maior dos dois guardados; o alvo é o da meta", () => {
    expect(reservaDaPessoa({ meta: metaReserva, antiga: { atual: 6000, alvo: 18000, custoDeVida: 3000 } })).toEqual({ atual: 6000, meta: 21000, custoDeVida: 3000, idDaMeta: "g1" });
    expect(reservaDaPessoa({ meta: { ...metaReserva, atual: 9000 }, antiga: { atual: 6000, alvo: 18000, custoDeVida: 3000 } })?.atual).toBe(9000);
  });
  it("só o simulador antigo: continua como era (com os ativos de reserva da Carteira)", () => {
    expect(reservaDaPessoa({ meta: null, antiga: { atual: 2000, alvo: 18000, custoDeVida: 3000 }, naCarteira: 2500 })).toEqual({ atual: 2500, meta: 18000, custoDeVida: 3000, idDaMeta: null });
  });
  it("nenhuma das duas: sem reserva", () => {
    expect(reservaDaPessoa({ meta: null, antiga: null })).toBeNull();
  });
});
