import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

/**
 * A renda estimada (pedido da Dani, 13/10/2026): a média dos últimos 12 meses FECHADOS com
 * entrada, nunca o último mês sozinho. Com banco de mentira e "hoje" fixo.
 */
type Linha = { year: number; month: number; amount: number; description: string | null };
const banco = vi.hoisted(() => ({ linhas: [] as Linha[], chamadas: [] as unknown[] }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    monthlyEntry: {
      findMany: async (args: { where: unknown }) => {
        banco.chamadas.push(args.where);
        return banco.linhas;
      },
    },
    user: { findUnique: async () => ({ name: "Isabela Espagolla Santos" }) },
  },
}));

import { ehRendaDeVerdade, mediaDaRenda, mediaDosAportes, mesesDaMedia, textoDaMedia } from "../renda-media";
import { getRendaMedia } from "@/lib/repositories/renda-media.repo";
import { rendaDeReferencia } from "@/lib/simulators/worth-it";

const hoje = new Date(2026, 9, 13, 12); // 13/10/2026
const e = (year: number, month: number, amount: number, description: string | null = "Salário"): Linha => ({ year, month, amount, description });
const ctx = { userId: "u1", profileId: "p1", profileKind: "PESSOAL" } as unknown as AuthContext;

beforeEach(() => {
  banco.linhas = [];
  banco.chamadas = [];
});

describe("mesesDaMedia", () => {
  it("os 12 meses fechados antes de outubro: setembro de 2026 a outubro de 2025", () => {
    const m = mesesDaMedia(hoje);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ year: 2026, month: 9 });
    expect(m[11]).toEqual({ year: 2025, month: 10 });
  });
  it("em janeiro, os 12 meses são o ano anterior inteiro", () => {
    const m = mesesDaMedia(new Date(2027, 0, 5, 12));
    expect(m[0]).toEqual({ year: 2026, month: 12 });
    expect(m[11]).toEqual({ year: 2026, month: 1 });
  });
});

describe("mediaDaRenda", () => {
  it("com 12 meses: a média dos 12, não o último", () => {
    // 11 meses de R$ 5.000 e setembro com R$ 11.000 (o freela que caiu de uma vez).
    const linhas = mesesDaMedia(hoje).map((m) => e(m.year, m.month, m.month === 9 && m.year === 2026 ? 11000 : 5000));
    expect(mediaDaRenda(linhas, hoje)).toEqual({ valor: 5500, meses: 12 });
  });

  it("com 3 meses: a média dos 3 (quem chegou há pouco não divide por 12)", () => {
    expect(mediaDaRenda([e(2026, 9, 6000), e(2026, 8, 4000), e(2026, 7, 5000)], hoje)).toEqual({ valor: 5000, meses: 3 });
  });

  it("ignora o mês atual, em andamento", () => {
    expect(mediaDaRenda([e(2026, 10, 9000), e(2026, 9, 4000)], hoje)).toEqual({ valor: 4000, meses: 1 });
  });

  it("ignora meses sem nenhuma entrada (não puxa a média para baixo)", () => {
    // Junho e julho sem nada lançado: a média é de 2 meses, não de 4.
    expect(mediaDaRenda([e(2026, 9, 6000), e(2026, 5, 4000)], hoje)).toEqual({ valor: 5000, meses: 2 });
  });

  it("o 13º mês para trás já não conta", () => {
    expect(mediaDaRenda([e(2026, 9, 5000), e(2025, 9, 50000)], hoje)).toEqual({ valor: 5000, meses: 1 });
  });

  it("sem entrada nenhuma nos 12 meses: null", () => {
    expect(mediaDaRenda([], hoje)).toBeNull();
    expect(mediaDaRenda([e(2026, 10, 3000)], hoje)).toBeNull();
  });

  it("várias entradas no mesmo mês somam (salário + freela)", () => {
    expect(mediaDaRenda([e(2026, 9, 4000), e(2026, 9, 1000, "Freela"), e(2026, 8, 5000)], hoje)).toEqual({ valor: 5000, meses: 2 });
  });

  it("resgate, conta própria, estorno e reembolso não são renda; mês que só teve isso sai da conta", () => {
    const linhas = [
      e(2026, 9, 5000),
      e(2026, 9, 2000, "Resgate CDB"),
      e(2026, 9, 300, "Estorno compra loja X"),
      e(2026, 9, 150, "Reembolso plano de saúde"),
      e(2026, 9, 1000, "Transferência mesma titularidade"),
      e(2026, 8, 10000, "Dinheiro retirado Caixinha Viagem"),
    ];
    expect(mediaDaRenda(linhas, hoje)).toEqual({ valor: 5000, meses: 1 });
  });

  it("Pix recebido do próprio nome não é renda, mesmo com o nome cortado pelo banco (30/10/2026)", () => {
    const nome = "Isabela Espagolla";
    expect(ehRendaDeVerdade({ description: "Pix Recebido Isabela Espago" }, nome)).toBe(false);
    expect(ehRendaDeVerdade({ description: "Transferência recebida pelo Pix ISABELA ESPAGOLLA" }, nome)).toBe(false);
    // Pix de outra pessoa continua renda; sem o nome, a regra fica como era.
    expect(ehRendaDeVerdade({ description: "Pix Recebido Maria Souza" }, nome)).toBe(true);
    expect(ehRendaDeVerdade({ description: "Pix Recebido Isabela Espago" })).toBe(true);
    const linhas = [e(2026, 9, 5000), e(2026, 9, 3000, "Pix Recebido Isabela Espago"), e(2026, 8, 5000), e(2026, 8, 700, "Pix Recebido Maria Souza")];
    expect(mediaDaRenda(linhas, hoje, nome)).toEqual({ valor: 5350, meses: 2 });
  });

  it("rendimento da poupança é renda (é ganho, não resgate)", () => {
    expect(ehRendaDeVerdade({ description: "Juros poupança" })).toBe(true);
    expect(ehRendaDeVerdade({ description: null })).toBe(true);
    expect(ehRendaDeVerdade({ description: "Salário ACME" })).toBe(true);
  });
});

describe("textoDaMedia", () => {
  it("singular e plural", () => {
    expect(textoDaMedia(1)).toBe("média de 1 mês");
    expect(textoDaMedia(12)).toBe("média de 12 meses");
  });
});

describe("getRendaMedia", () => {
  it("lê só as entradas dos 12 meses fechados do perfil e devolve a média", async () => {
    banco.linhas = [e(2026, 9, 6000), e(2026, 8, 4000), e(2026, 10, 99999)];
    expect(await getRendaMedia(ctx, hoje)).toEqual({ valor: 5000, meses: 2 });
    const where = banco.chamadas[0] as { userId: string; profileId: string; category: string; OR: { year: number; month: number }[] };
    expect(where.userId).toBe("u1");
    expect(where.profileId).toBe("p1");
    expect(where.category).toBe("INCOME");
    expect(where.OR).toHaveLength(12);
    expect(where.OR).not.toContainEqual({ year: 2026, month: 10 });
  });

  it("sem nada: null", async () => {
    expect(await getRendaMedia(ctx, hoje)).toBeNull();
  });

  it("usa o nome da conta: o Pix recebido dela mesma fica fora da média", async () => {
    banco.linhas = [e(2026, 9, 6000), e(2026, 9, 4519.85, "Pix - Recebido 38392308883 Isabela Espago 4.519,85 (+) Saldo do dia"), e(2026, 8, 4000)];
    expect(await getRendaMedia(ctx, hoje)).toEqual({ valor: 5000, meses: 2 });
  });
});

describe("digitado vence a estimativa", () => {
  it("a renda planejada do mês ganha da média; sem ela, vale a média; sem média, o que entrou", () => {
    expect(rendaDeReferencia(7000, 5000, 200)).toEqual({ valor: 7000, fonte: "plano" });
    expect(rendaDeReferencia(null, 5000, 200)).toEqual({ valor: 5000, fonte: "media" });
    expect(rendaDeReferencia(0, null, 200)).toEqual({ valor: 200, fonte: "mes" });
  });
});

describe("mediaDosAportes", () => {
  const hoje = new Date(2026, 9, 14, 12);
  it("média dos meses fechados com aporte, sem o mês corrente", () => {
    expect(
      mediaDosAportes(
        [
          { year: 2026, month: 9, amount: 600 },
          { year: 2026, month: 8, amount: 300 },
          { year: 2026, month: 8, amount: 100 },
          { year: 2026, month: 10, amount: 5000 },
        ],
        hoje,
      ),
    ).toBe(500);
  });
  it("sem aporte, null", () => {
    expect(mediaDosAportes([], hoje)).toBeNull();
    expect(mediaDosAportes([{ year: 2024, month: 1, amount: 900 }], hoje)).toBeNull();
  });
});
