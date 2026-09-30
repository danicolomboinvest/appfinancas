import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { addAccessPeriod, isExpired } from "../allowedEmail.repo";
import { plusOneYear } from "@/app/(app)/admin/acessos/date-utils";

/**
 * Bugs de fuso e de ano bissexto no prazo de acesso (Hubla e painel de acessos).
 *
 * Os testes rodam no fuso da PRODUÇÃO (a Vercel roda em UTC). Rodando no Mac da Dani (Brasília)
 * alguns destes bugs somem, e é por isso que os testes antigos não pegavam.
 *
 * Corrigidos: isExpired recebe o instante real, addAccessPeriod soma o ano no calendário de
 * Brasília e o "+1 ano" do painel segue a mesma regra do 29/02. Estes testes seguram o conserto.
 */

const fusoOriginal = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  process.env.TZ = fusoOriginal;
});
afterEach(() => {
  vi.useRealTimers();
});

/** Dia no calendário de Brasília de um instante, "YYYY-MM-DD". */
const diaNoBrasil = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

describe("isExpired sem `now` explícito (o jeito que o login e o painel chamam)", () => {
  // "Acesso até 30/09": gravado pelo painel ao meio-dia (actions.ts:117) → 30/09 12h de Brasília.
  const ate30deSetembro = new Date("2026-09-30T15:00:00Z");

  it("controle: com o instante real passado de fora, 02h de 01/10 já é vencido", () => {
    expect(isExpired(ate30deSetembro, new Date("2026-10-01T05:00:00Z"))).toBe(true);
  });

  it("às 02h de 01/10 (Brasília) o acesso até 30/09 já venceu — o padrão não converte o fuso duas vezes", () => {
    // allowedEmail.repo.ts:24 → `now = nowInBrazil()` já é o relógio de Brasília; na linha 27
    // `nowInBrazil(now)` converte de novo e "hoje" fica 3h atrás do relógio de Brasília (servidor UTC).
    // Resultado: entre 00h e 03h de Brasília, quem venceu ontem ainda entra (isEmailAllowed,
    // hasPremiumAccess) e o painel conta como ativo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T05:00:00Z")); // 01/10 02h00 em Brasília
    expect(isExpired(ate30deSetembro)).toBe(true);
  });
});

describe("addAccessPeriod (compra no Hubla) em ano bissexto", () => {
  it("controle: compra de manhã em 29/02/2028 vence em 28/02/2029", () => {
    expect(diaNoBrasil(addAccessPeriod(new Date("2028-02-29T13:00:00Z")))).toBe("2029-02-28");
  });

  it("compra às 22h de 28/02/2028 (Brasília) vence em 28/02/2029 — a cliente não perde um dia", () => {
    // 28/02 22h em Brasília = 29/02 01h UTC. addAccessPeriod (allowedEmail.repo.ts:162) lê
    // getDate() no fuso do servidor (29), cai em 01/03, volta pra 28/02 01h UTC = 27/02 22h em
    // Brasília. isExpired olha o dia em Brasília: o acesso morre no fim de 27/02/2029.
    expect(diaNoBrasil(addAccessPeriod(new Date("2028-02-29T01:00:00Z")))).toBe("2029-02-28");
  });
});

describe("plusOneYear (atalho \"+1 ano\" do painel de acessos)", () => {
  it("em 29/02/2028 o atalho sugere 28/02/2029, igual à regra da Hubla", () => {
    // date-utils.ts:12 usa setFullYear sozinho; addAccessPeriod já trata o 29/02. As duas
    // telas dão vencimentos diferentes pra mesma compra.
    const hoje = new Date(2028, 1, 29, 12);
    const sugerido = plusOneYear(hoje);
    expect([sugerido.getFullYear(), sugerido.getMonth() + 1, sugerido.getDate()]).toEqual([2029, 2, 28]);
  });

  it("controle: fora do bissexto, mesma data um ano depois", () => {
    const sugerido = plusOneYear(new Date(2026, 8, 30, 12));
    expect([sugerido.getFullYear(), sugerido.getMonth() + 1, sugerido.getDate()]).toEqual([2027, 9, 30]);
  });
});
