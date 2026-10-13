import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A ação que a tela de "Limpar meus dados" vai chamar: tudo que vem da tela é conferido no
 * servidor (escopo, a palavra digitada, o limite por hora) antes de qualquer coisa ser apagada.
 */

const limparDados = vi.fn();
const cabeMaisUmaLimpeza = vi.fn();
const revalidatePath = vi.fn();
const revogarNaPluggy = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pes", role: "CLIENT" })) }));
vi.mock("@/lib/repositories/limpar-dados.repo", () => ({
  limparDados: (...a: unknown[]) => limparDados(...a),
  cabeMaisUmaLimpeza: (...a: unknown[]) => cabeMaisUmaLimpeza(...a),
  PerfilDeOutraPessoa: class PerfilDeOutraPessoa extends Error {},
}));
vi.mock("@/lib/pluggy/revogar", () => ({ revogarNaPluggy: (...a: unknown[]) => revogarNaPluggy(...a) }));
vi.mock("../actions", () => ({ exportEntriesCsvAction: vi.fn(async () => "lanc"), exportAssetsCsvAction: vi.fn(async () => "cart") }));

const { limparDadosAction, copiaAntesDeLimparAction } = await import("../limpar-dados-actions");
const { PerfilDeOutraPessoa } = await import("@/lib/repositories/limpar-dados.repo");
const { PARTES } = await import("@/lib/limpar-dados/regras");

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  limparDados.mockReset().mockImplementation(async (_ctx, o: { partes: string[] }) => ({ perfis: 1, itensPluggy: [], contagens: { lancamentos: 3 }, partes: o.partes, recomecar: o.partes.includes("lancamentos") }));
  revogarNaPluggy.mockReset().mockResolvedValue(undefined);
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
    expect(r).toEqual({ ok: true, contagens: { lancamentos: 3 }, partes: [...PARTES], recomecar: true });
    expect(limparDados).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", profileId: "pes" }), { escopo: "perfil", perfilId: undefined, partes: [...PARTES] });
  });

  it("zerarMoneyReset: false guarda o progresso", async () => {
    await limparDadosAction({ escopo: "todos", zerarMoneyReset: false, confirmacao: "LIMPAR" });
    expect(limparDados).toHaveBeenCalledWith(expect.anything(), { escopo: "todos", perfilId: undefined, partes: PARTES.filter((p) => p !== "moneyReset") });
  });

  it("o registro de auditoria leva só números, nunca nome ou valor", async () => {
    await limparDadosAction({ escopo: "perfil", confirmacao: "LIMPAR" });
    const linha = (console.info as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(linha[0]).toBe("[dados-limpos]");
    expect(JSON.parse(linha[1] as string)).toEqual({ userId: "u1", escopo: "perfil", partes: [...PARTES], perfis: 1, contagens: { lancamentos: 3 }, itensPluggy: [] });
  });

  it("se o banco falha, diz que nada foi apagado", async () => {
    limparDados.mockRejectedValue(new Error("caiu"));
    const r = await limparDadosAction({ escopo: "perfil", confirmacao: "LIMPAR" });
    expect(r).toEqual({ ok: false, erro: "Não consegui limpar agora. Nada foi apagado. Tente de novo em instantes." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("limparDadosAction com partes escolhidas", () => {
  it("manda só as partes escolhidas e não volta ao começo sem os lançamentos", async () => {
    const r = await limparDadosAction({ escopo: "perfil", partes: ["metas"], confirmacao: "LIMPAR" });
    expect(limparDados).toHaveBeenCalledWith(expect.anything(), { escopo: "perfil", perfilId: undefined, partes: ["metas"] });
    expect(r).toMatchObject({ ok: true, partes: ["metas"], recomecar: false });
    // Fica no app: as telas são redesenhadas com o dado novo.
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("o servidor aplica as dependências mesmo se a tela mandar só Categorias", async () => {
    await limparDadosAction({ escopo: "perfil", partes: ["categorias"], confirmacao: "LIMPAR" });
    expect(limparDados).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ partes: ["lancamentos", "orcamento", "categorias"] }));
  });

  it("parte inventada ou lista vazia é recusada antes de apagar", async () => {
    for (const partes of [[], ["senha"], "tudo"]) {
      const r = await limparDadosAction({ escopo: "perfil", partes: partes as never, confirmacao: "LIMPAR" });
      expect(r).toEqual({ ok: false, erro: "Escolha o que limpar." });
    }
    expect(limparDados).not.toHaveBeenCalled();
  });

  it("perfil escolhido vai para o repositório; perfil de outra pessoa é recusado", async () => {
    await limparDadosAction({ escopo: "perfil", perfilId: "emp", partes: ["metas"], confirmacao: "LIMPAR" });
    expect(limparDados).toHaveBeenCalledWith(expect.anything(), { escopo: "perfil", perfilId: "emp", partes: ["metas"] });
    limparDados.mockRejectedValueOnce(new PerfilDeOutraPessoa());
    const r = await limparDadosAction({ escopo: "perfil", perfilId: "dela", partes: ["metas"], confirmacao: "LIMPAR" });
    expect(r).toEqual({ ok: false, erro: "Escolha um dos seus perfis." });
    const t = await limparDadosAction({ escopo: "todos", perfilId: "emp", confirmacao: "LIMPAR" });
    expect(t.ok).toBe(false);
  });

  it("voltando ao começo, não redesenha a tela agora (o layout pularia a tela final)", async () => {
    const r = await limparDadosAction({ escopo: "perfil", partes: ["lancamentos"], confirmacao: "LIMPAR" });
    expect(r).toMatchObject({ ok: true, recomecar: true });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("os bancos que saíram são revogados na Pluggy (mock), e nada é revogado se a limpeza falha", async () => {
    limparDados.mockResolvedValueOnce({ perfis: 1, itensPluggy: ["item-nu"], contagens: {}, partes: ["lancamentos"], recomecar: true });
    await limparDadosAction({ escopo: "perfil", partes: ["lancamentos"], confirmacao: "LIMPAR" });
    expect(revogarNaPluggy).toHaveBeenCalledWith(["item-nu"]);
    revogarNaPluggy.mockClear();
    limparDados.mockRejectedValueOnce(new Error("caiu"));
    await limparDadosAction({ escopo: "perfil", partes: ["lancamentos"], confirmacao: "LIMPAR" });
    expect(revogarNaPluggy).not.toHaveBeenCalled();
  });
});

describe("copiaAntesDeLimparAction", () => {
  it("reaproveita as exportações de Configurações › Dados", async () => {
    expect(await copiaAntesDeLimparAction()).toEqual({ lancamentos: "lanc", carteira: "cart" });
  });
});
