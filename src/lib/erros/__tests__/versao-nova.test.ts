import { describe, expect, it, vi } from "vitest";
import { INTERVALO_MINIMO_MS, criarRecarregador, erroDeVersaoNova, podeRecarregar, versaoMudou, type Ambiente } from "../versao-nova";
import { lerRascunho, montarRascunho, VALIDADE_RASCUNHO_MS } from "@/lib/entries/rascunho-lancar";

function ambiente(over: Partial<Ambiente> = {}) {
  let ultima: number | null = null;
  let relogio = 1_000_000;
  const recargas = vi.fn();
  const amb: Ambiente = {
    agora: () => relogio,
    lerUltimaRecarga: () => ultima,
    gravarUltimaRecarga: (q) => {
      ultima = q;
      return true;
    },
    versaoLocal: () => "dpl_velha",
    buscarVersaoDoServidor: async () => "dpl_velha",
    statusDoArquivo: async () => 200,
    online: () => true,
    avisarERecarregar: recargas,
    ...over,
  };
  return { amb, recargas, avancar: (ms: number) => (relogio += ms) };
}

describe("reconhece o app atualizado com a tela aberta", () => {
  it("ação que a versão nova não tem", () => {
    expect(erroDeVersaoNova(new Error('Failed to find Server Action "7f3a". This request might be from an older or newer deployment.'))).toBe("acao-sumiu");
    const e = new Error('Server Action "7f3a" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action');
    e.name = "UnrecognizedActionError";
    expect(erroDeVersaoNova(e)).toBe("acao-sumiu");
  });
  it("pedaço do código que sumiu (ChunkLoadError)", () => {
    const e = new Error("Loading chunk 4512 failed.");
    e.name = "ChunkLoadError";
    expect(erroDeVersaoNova(e)).toBe("pedaco-sumiu");
    expect(erroDeVersaoNova(new TypeError("Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js"))).toBe("pedaco-sumiu");
    expect(erroDeVersaoNova(new TypeError("Importing a module script failed."))).toBe("pedaco-sumiu");
  });
  it("arquivo do app que voltou 404", () => {
    expect(erroDeVersaoNova("GET https://financas.danicolombo.com.br/_next/static/chunks/abc.js 404 (Not Found)")).toBe("arquivo-404");
  });
  it("erro comum não é versão nova", () => {
    expect(erroDeVersaoNova(new Error("Cannot read properties of undefined (reading 'x')"))).toBeNull();
    expect(erroDeVersaoNova(new TypeError("Failed to fetch"))).toBeNull();
    expect(erroDeVersaoNova(new Error("Valor inválido"))).toBeNull();
    expect(erroDeVersaoNova(null)).toBeNull();
  });
  it("versão diferente só conta com as duas conhecidas", () => {
    expect(versaoMudou("dpl_a", "dpl_b")).toBe(true);
    expect(versaoMudou("dpl_a", "dpl_a")).toBe(false);
    expect(versaoMudou("", "dpl_b")).toBe(false);
    expect(versaoMudou("dpl_a", null)).toBe(false);
  });
});

describe("recarrega, sem laço", () => {
  it("cada tipo de erro de versão recarrega", async () => {
    const casos: unknown[] = [
      new Error("Failed to find Server Action"),
      Object.assign(new Error("Loading chunk 9 failed."), { name: "ChunkLoadError" }),
      "_next/static/chunks/x.js 404",
    ];
    for (const erro of casos) {
      const { amb, recargas } = ambiente();
      expect(await criarRecarregador(amb).tratar(erro)).toBe(true);
      expect(recargas).toHaveBeenCalledTimes(1);
    }
  });

  it("falha de rede com versão nova no servidor recarrega; com a mesma versão, não", async () => {
    const mudou = ambiente({ buscarVersaoDoServidor: async () => "dpl_nova" });
    expect(await criarRecarregador(mudou.amb).tratar(new TypeError("Failed to fetch"))).toBe(true);
    expect(mudou.recargas).toHaveBeenCalledTimes(1);

    const igual = ambiente();
    expect(await criarRecarregador(igual.amb).tratar(new TypeError("Failed to fetch"))).toBe(false);
    expect(igual.recargas).not.toHaveBeenCalled();
  });

  it("resposta inesperada do servidor também confere a versão", async () => {
    const { amb, recargas } = ambiente({ buscarVersaoDoServidor: async () => "dpl_nova" });
    expect(await criarRecarregador(amb).tratar(new Error("An unexpected response was received from the server."))).toBe(true);
    expect(recargas).toHaveBeenCalledTimes(1);
  });

  it("erro comum não recarrega nem pergunta a versão", async () => {
    const buscar = vi.fn(async () => "dpl_nova");
    const { amb, recargas } = ambiente({ buscarVersaoDoServidor: buscar });
    expect(await criarRecarregador(amb).tratar(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(recargas).not.toHaveBeenCalled();
    expect(buscar).not.toHaveBeenCalled();
  });

  it("no máximo uma recarga por minuto, mesmo depois de a página recarregar", async () => {
    const { amb, recargas, avancar } = ambiente();
    const erro = new Error("Failed to find Server Action");
    expect(await criarRecarregador(amb).tratar(erro)).toBe(true);
    // a página recarregou: recarregador novo, mesma hora guardada no aparelho
    avancar(10_000);
    expect(await criarRecarregador(amb).tratar(erro)).toBe(false);
    avancar(INTERVALO_MINIMO_MS - 10_001);
    expect(await criarRecarregador(amb).tratar(erro)).toBe(false);
    avancar(1);
    expect(await criarRecarregador(amb).tratar(erro)).toBe(true);
    expect(recargas).toHaveBeenCalledTimes(2);
  });

  it("sem onde guardar a hora da recarga, não recarrega (não teria trava contra laço)", async () => {
    const { amb, recargas } = ambiente({ gravarUltimaRecarga: () => false });
    expect(await criarRecarregador(amb).tratar(new Error("Failed to find Server Action"))).toBe(false);
    const quebrado = ambiente({
      lerUltimaRecarga: () => {
        throw new Error("SecurityError");
      },
    });
    expect(await criarRecarregador(quebrado.amb).tratar(new Error("Failed to find Server Action"))).toBe(false);
    expect(recargas).not.toHaveBeenCalled();
    expect(quebrado.recargas).not.toHaveBeenCalled();
  });

  it("relógio que voltou no tempo não libera recarga", () => {
    expect(podeRecarregar(1000, null)).toBe(true);
    expect(podeRecarregar(1000, 5000)).toBe(false);
    expect(podeRecarregar(1000 + INTERVALO_MINIMO_MS, 1000)).toBe(true);
  });

  it("dois erros juntos recarregam uma vez só", async () => {
    const { amb, recargas } = ambiente();
    const r = criarRecarregador(amb);
    expect(r.seVersaoNova(new Error("Failed to find Server Action"))).toBe(true);
    expect(r.seVersaoNova(new Error("Failed to find Server Action"))).toBe(true);
    expect(recargas).toHaveBeenCalledTimes(1);
  });

  it("arquivo de _next/static que voltou 404 recarrega; outro status ou outro arquivo, não", async () => {
    const r404 = ambiente({ statusDoArquivo: async () => 404 });
    expect(await criarRecarregador(r404.amb).arquivoNaoCarregou("https://x/_next/static/chunks/a.js")).toBe(true);
    const r200 = ambiente({ statusDoArquivo: async () => 200 });
    expect(await criarRecarregador(r200.amb).arquivoNaoCarregou("https://x/_next/static/chunks/a.js")).toBe(false);
    const fora = ambiente({ statusDoArquivo: async () => 404 });
    expect(await criarRecarregador(fora.amb).arquivoNaoCarregou("https://cdn.exemplo.com/x.js")).toBe(false);
  });

  it("guarda o rascunho antes de recarregar, e só quem ainda está registrado", async () => {
    const { amb } = ambiente();
    const r = criarRecarregador(amb);
    const guardar = vi.fn();
    const saiu = vi.fn();
    r.aoRecarregar(guardar);
    r.aoRecarregar(saiu)();
    r.seVersaoNova(new Error("Failed to find Server Action"));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(saiu).not.toHaveBeenCalled();
  });
});

describe("rascunho do lançamento", () => {
  const r = { tipo: "EXPENSE" as const, centavos: 4590, categoria: "FOOD", tipoLivre: "", descricao: "mercado", chip: "hoje" };
  it("volta igual dentro da validade", () => {
    expect(lerRascunho(montarRascunho(r, 1000), 1000 + 60_000)).toEqual(r);
  });
  it("vencido, sem valor ou quebrado não volta", () => {
    expect(lerRascunho(montarRascunho(r, 1000), 1000 + VALIDADE_RASCUNHO_MS + 1)).toBeNull();
    expect(lerRascunho(montarRascunho({ ...r, centavos: 0 }, 1000), 2000)).toBeNull();
    expect(lerRascunho("{", 2000)).toBeNull();
    expect(lerRascunho(null, 2000)).toBeNull();
  });
});
