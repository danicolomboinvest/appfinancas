import { describe, expect, it } from "vitest";
import { planoDaMeta, proximaAChegar, type EntradaDaMeta } from "@/lib/metas/projecao";
import { limiteDasMetas } from "@/lib/metas/prazo-que-cabe";
import { DIAS_DO_SELO_NOVA, metaApertada, seloDaMeta } from "../visual";

/**
 * Revisão com a conta real (15/10/2026): a Reserva aparecia ao mesmo tempo com "Prazo apertado",
 * "Nova" e "Próxima a chegar". Agora é um selo por meta, o mais útil.
 */
const HOJE = new Date(2026, 9, 15);
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000);
const limite = limiteDasMetas({ planoRenda: 5000 }); // cabe R$ 1.000 por mês nas metas

const entrada = (e: Partial<EntradaDaMeta>): EntradaDaMeta => ({ alvo: 10000, guardado: 0, prazo: null, taxaAnual: 0, inicio: diasAtras(60), porMesCombinado: 0, aportes: new Map(), hoje: HOJE, ...e });
const meta = (id: string, e: EntradaDaMeta, daViagem = false) => ({ id, prazo: e.prazo, daViagem, inicio: e.inicio, plano: planoDaMeta(e) });

// A Reserva criada há 2 dias, sem aporte: R$ 18.000 até dezembro pede R$ 6.000 por mês (não cabe).
// Sem ritmo, a chegada vem do combinado, e por isso ela "chegava primeiro".
const reserva = meta("reserva", entrada({ alvo: 18000, prazo: new Date(2026, 11, 1), inicio: diasAtras(2), porMesCombinado: 6000 }));
// O carro tem ritmo de verdade e cabe.
const carro = meta(
  "carro",
  entrada({ alvo: 30000, guardado: 6000, prazo: new Date(2029, 5, 1), porMesCombinado: 700, aportes: new Map([["2026-07", 700], ["2026-08", 700], ["2026-09", 700]]), inicio: new Date(2026, 0, 10) }),
);

describe("um selo só por meta", () => {
  it("a Reserva do caso real: só 'Prazo apertado', e ela não é a 'Próxima a chegar'", () => {
    expect(reserva.plano.nova).toBe(true);
    const apertada = (m: typeof reserva) => metaApertada(m, limite);
    expect(apertada(reserva)).toBe(true);
    // Antes: a Reserva era a próxima a chegar, pelo combinado que não cabe.
    expect(proximaAChegar([reserva, carro])?.id).toBe("reserva");
    const prox = proximaAChegar([reserva, carro], apertada);
    expect(prox?.id).toBe("carro");
    const selo = seloDaMeta({ status: reserva.plano.status, nova: reserva.plano.nova, inicio: reserva.inicio, hoje: HOJE, apertada: true, proxima: prox?.id === "reserva" });
    expect(selo).toEqual({ tipo: "prazo-apertado", texto: "Prazo apertado" });
  });

  it("a ordem: Concluída, Prazo apertado, Atrasada, Nova, No ritmo", () => {
    const base = { nova: true, inicio: diasAtras(1), hoje: HOJE, apertada: true };
    expect(seloDaMeta({ ...base, status: "ACHIEVED" }).tipo).toBe("concluida");
    expect(seloDaMeta({ ...base, status: "BEHIND" }).tipo).toBe("prazo-apertado");
    expect(seloDaMeta({ ...base, status: "BEHIND", apertada: false }).tipo).toBe("atrasada");
    expect(seloDaMeta({ ...base, status: "ON_TRACK", apertada: false }).tipo).toBe("nova");
    expect(seloDaMeta({ ...base, status: "ON_TRACK", apertada: false, nova: false }).tipo).toBe("no-ritmo");
    expect(seloDaMeta({ ...base, status: "SEM_PRAZO", apertada: false, nova: false }).tipo).toBe("sem-prazo");
  });

  it("'Nova' só nos primeiros dias e sem outro selo (nem a 'Próxima a chegar')", () => {
    const base = { status: "ON_TRACK" as const, nova: true, hoje: HOJE, apertada: false };
    expect(seloDaMeta({ ...base, inicio: diasAtras(DIAS_DO_SELO_NOVA - 1) }).texto).toBe("Nova");
    expect(seloDaMeta({ ...base, inicio: diasAtras(DIAS_DO_SELO_NOVA) }).texto).toBe("No ritmo");
    expect(seloDaMeta({ ...base, inicio: diasAtras(1), proxima: true }).texto).toBe("No ritmo");
  });

  it("a meta da Viagem e a sem prazo nunca têm prazo apertado", () => {
    const viagem = meta("viagem", entrada({ alvo: 18000, prazo: new Date(2026, 11, 1), porMesCombinado: 6000 }), true);
    const semPrazo = meta("sem", entrada({ alvo: 18000, porMesCombinado: 6000 }));
    expect(metaApertada(viagem, limite)).toBe(false);
    expect(metaApertada(semPrazo, limite)).toBe(false);
  });
});
