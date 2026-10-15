import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthlyRecapEmail } from "@/lib/email/templates";
import { vozDoTema } from "@/lib/profiles/voice";
import { ondeMostrarFechamento } from "@/app/(app)/mensal/foco/fechamento/quando-mostrar";

/**
 * Decisão da Dani (15/10/2026): quem já fechou o mês anterior não recebe, no e-mail do resumo
 * mensal, o convite "Fechar setembro". O resto do e-mail continua igual. "Fechado" é o mesmo
 * critério do convite no app (FechamentoDoMes com estado "fechado"; reaberto conta como aberto).
 */

type Linha = { userId: string; profileId: string; ano: number; mes: number; estado: string; fechadoEm: Date | null; reabertoEm: Date | null };
const banco = vi.hoisted(() => ({ linhas: [] as Linha[] }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    fechamentoDoMes: {
      findUnique: vi.fn(async ({ where }: { where: { profileId_ano_mes: { profileId: string; ano: number; mes: number } } }) => {
        const k = where.profileId_ano_mes;
        return banco.linhas.find((l) => l.profileId === k.profileId && l.ano === k.ano && l.mes === k.mes) ?? null;
      }),
    },
  },
}));

const { mesJaFechado } = await import("@/lib/repositories/fechamento.repo");
const { ajustarResumoPorEmail, botaoDoResumo } = await import("../email-do-resumo");

const ana = { userId: "u-ana", profileId: "p-ana" };

/** O e-mail como a rota monta, para um mês fechado ou não. */
function emailDe(tema: string, fechado: boolean) {
  const base = vozDoTema(tema, "PESSOAL").titulos;
  const { balance, t } = ajustarResumoPorEmail(base, { income: 7700, expense: 6600, investment: 900 }, "setembro", false, fechado);
  return monthlyRecapEmail({
    name: "Ana",
    monthLabel: "setembro de 2026",
    currency: "BRL",
    income: 7700,
    expense: 6600,
    investment: 900,
    balance,
    expenseDelta: null,
    topCategory: null,
    appUrl: botaoDoResumo("https://app", 2026, 9, fechado),
    preferencesUrl: "https://app/configuracoes/notificacoes",
    t,
    tema,
  });
}

beforeEach(() => {
  banco.linhas = [];
});

describe("o mês fechado, pelo mesmo critério do app", () => {
  it("sem linha: não fechado (e o app mostra o convite)", async () => {
    expect(await mesJaFechado(ana, 2026, 9)).toBe(false);
    expect(ondeMostrarFechamento({ ritmo: null, fechamentoFeito: false, mesAnteriorTinhaPlano: true, dia: 2 })).toBe("destaque");
  });

  it("fechado: o app não convida, e o e-mail também não", async () => {
    banco.linhas.push({ ...ana, ano: 2026, mes: 9, estado: "fechado", fechadoEm: new Date("2026-10-01T12:00:00Z"), reabertoEm: null });
    const fechado = await mesJaFechado(ana, 2026, 9);
    expect(fechado).toBe(true);
    expect(ondeMostrarFechamento({ ritmo: null, fechamentoFeito: fechado, mesAnteriorTinhaPlano: true, dia: 2 })).toBeNull();
  });

  it("reaberto conta como aberto: volta o convite", async () => {
    banco.linhas.push({ ...ana, ano: 2026, mes: 9, estado: "reaberto", fechadoEm: new Date("2026-10-01T12:00:00Z"), reabertoEm: new Date("2026-10-02T12:00:00Z") });
    expect(await mesJaFechado(ana, 2026, 9)).toBe(false);
  });

  it("o fechamento de outro mês, ou de outra pessoa no mesmo perfil, não conta", async () => {
    banco.linhas.push({ ...ana, ano: 2026, mes: 8, estado: "fechado", fechadoEm: new Date(), reabertoEm: null });
    banco.linhas.push({ userId: "u-outra", profileId: "p-ana", ano: 2026, mes: 9, estado: "fechado", fechadoEm: new Date(), reabertoEm: null });
    expect(await mesJaFechado(ana, 2026, 9)).toBe(false);
  });
});

describe("e-mail do resumo: sem convite para fechar quando ela já fechou", () => {
  it("não fechado: o botão é o 'Fechar setembro' e leva ao fechamento", () => {
    const { html } = emailDe("padrao", false);
    expect(html).toContain("Fechar setembro");
    expect(html).toContain("https://app/mensal/foco/fechamento");
  });

  it("já fechado: nada de 'Fechar setembro' nem do link do fechamento, nos temas", () => {
    for (const tema of ["padrao", "girly", "manifestacao", "titanio"]) {
      const { html } = emailDe(tema, true);
      expect(html, tema).not.toMatch(/Fechar setembro/i);
      expect(html, tema).not.toContain("/mensal/foco/fechamento");
      expect(html, tema).toContain("https://app/mensal/foco?mes=2026-09");
    }
  });

  it("o resto do e-mail é igual: só o botão muda", () => {
    const aberto = emailDe("girly", false);
    const fechado = emailDe("girly", true);
    expect(fechado.subject).toBe(aberto.subject);
    const t = vozDoTema("girly", "PESSOAL").titulos;
    const semBotao = (html: string) =>
      html
        .replace(/https:\/\/app\/mensal\/foco(\/fechamento|\?mes=2026-09)/g, "LINK")
        .replace(t.emailRecapBotaoFechar("setembro"), "BOTAO")
        .replace(t.emailRecapBotao, "BOTAO");
    expect(semBotao(fechado.html)).toBe(semBotao(aberto.html));
  });
});
