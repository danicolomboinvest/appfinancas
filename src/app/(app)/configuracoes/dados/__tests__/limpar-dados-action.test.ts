import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A ação que a tela de "Limpar meus dados" vai chamar: tudo que vem da tela é conferido no
 * servidor (escopo, a palavra digitada, o limite por hora) antes de qualquer coisa ser apagada.
 */

const limparDados = vi.fn();
const cabeMaisUmaLimpeza = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pes", role: "CLIENT" })) }));
vi.mock("@/lib/repositories/limpar-dados.repo", () => ({
  limparDados: (...a: unknown[]) => limparDados(...a),
  cabeMaisUmaLimpeza: (...a: unknown[]) => cabeMaisUmaLimpeza(...a),
}));
vi.mock("../actions", () => ({ exportEntriesCsvAction: vi.fn(async () => "lanc"), exportAssetsCsvAction: vi.fn(async () => "cart") }));

const { limparDadosAction, copiaAntesDeLimparAction } = await import("../limpar-dados-actions");

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  limparDados.mockReset().mockResolvedValue({ perfis: 1, itensPluggy: [], contagens: { lancamentos: 3 } });
  cabeMaisUmaLimpeza.mockReset().mockResolvedValue(true);
  revalidatePath.mockReset();
});

describe("limparDadosAction", () => {
  it("sem a palavra certa, nada é apagado", async () => {
    const r = await limparDadosAction({ escopo: "perfil", confirmacao: "limpa" });
    expect(r).toEqual({ ok: false, erro: "Para confirmar, digite LIMPAR." });
    expect(limparDados).not.toHaveBeenCalled();
  });

  it("escopo inventado pela tela é recusado", async () => {
    const r = await limparDadosAction({ escopo: "conta" as never, confirmacao: "LIMPAR" });
    expect(r.ok).toBe(false);
    expect(limparDados).not.toHaveBeenCalled();
  });

  it("acima do limite por hora, recusa", async () => {
    cabeMaisUmaLimpeza.mockResolvedValue(false);
    const r = await limparDadosAction({ escopo: "perfil", confirmacao: "LIMPAR" });
    expect(r.ok).toBe(false);
    expect(limparDados).not.toHaveBeenCalled();
  });

  it("limpa com o Money Reset junto por padrão e devolve as contagens", async () => {
    const r = await limparDadosAction({ escopo: "perfil", confirmacao: "limpar" });
    expect(r).toEqual({ ok: true, contagens: { lancamentos: 3 } });
    expect(limparDados).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", profileId: "pes" }), { escopo: "perfil", zerarMoneyReset: true });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("zerarMoneyReset: false guarda o progresso", async () => {
    await limparDadosAction({ escopo: "todos", zerarMoneyReset: false, confirmacao: "LIMPAR" });
    expect(limparDados).toHaveBeenCalledWith(expect.anything(), { escopo: "todos", zerarMoneyReset: false });
  });

  it("o registro de auditoria leva só números, nunca nome ou valor", async () => {
    await limparDadosAction({ escopo: "perfil", confirmacao: "LIMPAR" });
    const linha = (console.info as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(linha[0]).toBe("[dados-limpos]");
    expect(JSON.parse(linha[1] as string)).toEqual({ userId: "u1", escopo: "perfil", zerarMoneyReset: true, perfis: 1, contagens: { lancamentos: 3 }, itensPluggy: [] });
  });

  it("se o banco falha, diz que nada foi apagado", async () => {
    limparDados.mockRejectedValue(new Error("caiu"));
    const r = await limparDadosAction({ escopo: "perfil", confirmacao: "LIMPAR" });
    expect(r).toEqual({ ok: false, erro: "Não consegui limpar agora. Nada foi apagado. Tente de novo em instantes." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("copiaAntesDeLimparAction", () => {
  it("reaproveita as exportações de Configurações › Dados", async () => {
    expect(await copiaAntesDeLimparAction()).toEqual({ lancamentos: "lanc", carteira: "cart" });
  });
});
