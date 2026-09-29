import { describe, expect, it } from "vitest";
import { girarLista, processarComPrazo } from "../lote";
import { checarChamadaDoCron } from "../autorizacao";

describe("processarComPrazo", () => {
  it("processa tudo quando cabe no prazo, respeitando o limite de paralelismo", async () => {
    let emVoo = 0;
    let pico = 0;
    const feitos: number[] = [];
    const r = await processarComPrazo([1, 2, 3, 4, 5, 6, 7], { paralelo: 3, prazo: Number.POSITIVE_INFINITY }, async (n) => {
      emVoo += 1;
      pico = Math.max(pico, emVoo);
      await new Promise((ok) => setTimeout(ok, 1));
      feitos.push(n);
      emVoo -= 1;
    });
    expect(r).toEqual({ processados: 7, falhas: 0, pendentes: 0 });
    expect(pico).toBeLessThanOrEqual(3);
    expect(feitos.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("para de pegar itens novos depois do prazo e conta o que ficou pra trás", async () => {
    let relogio = 0;
    const r = await processarComPrazo(["a", "b", "c", "d"], { paralelo: 1, prazo: 2, agora: () => relogio }, async () => {
      relogio += 1;
    });
    expect(r).toEqual({ processados: 2, falhas: 0, pendentes: 2 });
  });

  it("um item que falha não derruba os outros", async () => {
    const r = await processarComPrazo([1, 2, 3], { paralelo: 2, prazo: Number.POSITIVE_INFINITY }, async (n) => {
      if (n === 2) throw new Error("fora do ar");
    });
    expect(r).toEqual({ processados: 2, falhas: 1, pendentes: 0 });
  });

  it("lista vazia não trava", async () => {
    expect(await processarComPrazo([], { paralelo: 5, prazo: Number.POSITIVE_INFINITY }, async () => {})).toEqual({ processados: 0, falhas: 0, pendentes: 0 });
  });
});

describe("girarLista", () => {
  it("começa do índice pedido e dá a volta", () => {
    expect(girarLista([1, 2, 3, 4], 2)).toEqual([3, 4, 1, 2]);
    expect(girarLista([1, 2, 3, 4], 6)).toEqual([3, 4, 1, 2]);
    expect(girarLista([1, 2, 3], -1)).toEqual([3, 1, 2]);
    expect(girarLista([], 3)).toEqual([]);
  });
});

describe("checarChamadaDoCron", () => {
  it("sem CRON_SECRET ninguém passa, nem com o user-agent da Vercel", () => {
    expect(checarChamadaDoCron(null, undefined)).toBe("sem-segredo");
    expect(checarChamadaDoCron("Bearer qualquer", "")).toBe("sem-segredo");
  });

  it("com o segredo, só o Bearer certo passa", () => {
    expect(checarChamadaDoCron("Bearer s3gr3do", "s3gr3do")).toBe("ok");
    expect(checarChamadaDoCron("Bearer outro", "s3gr3do")).toBe("negado");
    expect(checarChamadaDoCron(null, "s3gr3do")).toBe("negado");
  });
});
