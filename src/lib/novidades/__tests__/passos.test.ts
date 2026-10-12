import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import {
  LINK_COMO_FUNCIONA,
  LINK_VER_DE_NOVO,
  ONDE_DOS_PASSOS,
  VIDEOS_COMO_FUNCIONA,
  abreAsNovidades,
  contadorDoPasso,
  estadoDasNovidades,
  jaUsava,
  textosDasNovidades,
} from "../passos";

describe("Tivemos uma mudança: quem vê", () => {
  it("quem já usava (marca vazia) vê; quem viu ou pulou não vê de novo sozinho; quem é novo nunca vê", () => {
    expect(estadoDasNovidades(null)).toBe("mostrar");
    expect(estadoDasNovidades(undefined)).toBe("mostrar");
    expect(estadoDasNovidades("terminou")).toBe("visto");
    expect(estadoDasNovidades("pulou")).toBe("visto");
    expect(estadoDasNovidades("novo")).toBe("boas-vindas");
    expect(estadoDasNovidades("novo-visto")).toBe("novo");
  });

  it("abre sozinho uma vez para quem já usava, e de novo só pelo link da Ajuda", () => {
    expect(abreAsNovidades("mostrar", false, false)).toBe(true);
    expect(abreAsNovidades("mostrar", false, true)).toBe(false); // já viu neste aparelho, a conta ainda não gravou
    expect(abreAsNovidades("visto", false, false)).toBe(false);
    expect(abreAsNovidades("visto", true, true)).toBe(true);
  });

  it("a nova vê o Boas-vindas uma vez depois do começo, e nunca pelo link da Ajuda", () => {
    expect(abreAsNovidades("boas-vindas", false, false)).toBe(true);
    expect(abreAsNovidades("boas-vindas", false, true)).toBe(false);
    expect(abreAsNovidades("boas-vindas", true, false)).toBe(false);
    expect(abreAsNovidades("novo", false, false)).toBe(false);
    expect(abreAsNovidades("novo", true, false)).toBe(false);
    expect(jaUsava("boas-vindas")).toBe(false);
    expect(jaUsava("novo")).toBe(false);
    expect(jaUsava("mostrar")).toBe(true);
    expect(jaUsava("visto")).toBe(true);
  });

  it("a abertura da nova é sem gênero nos 4 temas, com os mesmos 5 passos", () => {
    for (const tema of ["padrao", "girly", "manifestacao", "titanio"] as const) {
      const novo = textosDasNovidades(tema, "novo");
      expect(novo.abertura.titulo).toBe("Boas-vindas ao SPI");
      expect(novo.abertura.texto).toBe("Em 5 passos você conhece tudo.");
      expect(novo.abertura.pular).toBe("Pular");
      expect(novo.fim.comoFunciona).toBe("Ver como funciona");
      expect(novo.passos).toEqual(textosDasNovidades(tema).passos);
      expect(textosDasNovidades(tema).abertura.titulo).toBe("Tivemos uma mudança");
    }
  });

  it("o link de rever reabre na Visão geral", () => {
    expect(LINK_VER_DE_NOVO).toBe("/mensal/foco?novidades=1");
    expect(LINK_COMO_FUNCIONA.startsWith("/guia")).toBe(true);
  });
});

describe("Tivemos uma mudança: os passos", () => {
  it("5 passos, cada um apontando o elemento de verdade, na ordem aprovada", () => {
    // Auditoria de 11/10/2026: o passo 3 destaca o cartão da decisão e o 4 vai para a Carteira (sem abrir o menu).
    expect(ONDE_DOS_PASSOS.map((p) => p.alvos)).toEqual([["mais", "perfil"], ["fluxo"], ["pilha"], ["abas-carteira"], ["temas"]]);
    expect(ONDE_DOS_PASSOS.map((p) => p.rota)).toEqual(["/mensal/foco", "/mensal/foco", "/decidir", "/carteira", "/configuracoes/aparencia"]);
    expect(ONDE_DOS_PASSOS.filter((p) => p.abreMenu)).toHaveLength(0);
    expect(contadorDoPasso(0)).toBe("1 de 5");
    expect(contadorDoPasso(4)).toBe("5 de 5");
  });

  it.each(PROFILE_THEMES.map((t) => t.key))("%s: abertura, 5 passos e o fim com o atalho do Como funciona", (tema) => {
    const tx = textosDasNovidades(tema);
    expect(tx.abertura).toEqual({ titulo: "Tivemos uma mudança", texto: "O SPI ficou mais simples. Te mostro em 1 minuto.", ver: "Ver o que mudou", pular: "Pular" });
    expect(tx.passos).toHaveLength(ONDE_DOS_PASSOS.length);
    expect(tx.fim.titulo).toBe("Pronto. Tudo no lugar.");
    expect(tx.fim.comoFunciona.toLowerCase()).toContain("como funciona");
  });

  it("cada tema fala do seu jeito, como no protótipo dele", () => {
    expect(textosDasNovidades("girly").passos[0].titulo).toBe("O menu e o seu perfil");
    expect(textosDasNovidades("padrao").passos[0].titulo).toBe("Menu e perfil");
    expect(textosDasNovidades("titanio").passos[1].titulo).toBe("A Visão geral em 4 abas");
    expect(textosDasNovidades("manifestacao")).toEqual(textosDasNovidades("titanio"));
    expect(textosDasNovidades("titanio").fim.comoFunciona).toBe("Ver como funciona");
  });

  it("sem emoji e sem travessão em tema nenhum", () => {
    for (const { key } of PROFILE_THEMES) {
      const tx = textosDasNovidades(key);
      const textos = [...Object.values(tx.abertura), ...tx.passos.flatMap((p) => [p.titulo, p.texto]), tx.fim.titulo, tx.fim.texto ?? "", tx.fim.comecar, tx.fim.comoFunciona, tx.aoPular ?? ""];
      for (const t of textos) expect(t, t).not.toMatch(/\p{Extended_Pictographic}|[—–]/u);
    }
  });
});

describe("Como funciona: os vídeos", () => {
  it("são os 5 aprovados, com capa, e os arquivos estão em public/videos", () => {
    expect(VIDEOS_COMO_FUNCIONA.map((v) => v.titulo)).toEqual(["Seu primeiro mês em 3 minutos", "Quanto posso gastar hoje", "Decidir", "Suas metas", "Carteira"]);
    for (const v of VIDEOS_COMO_FUNCIONA) {
      expect(existsSync(join(process.cwd(), "public", v.src)), v.src).toBe(true);
      expect(existsSync(join(process.cwd(), "public", v.poster)), v.poster).toBe(true);
    }
  });
});
