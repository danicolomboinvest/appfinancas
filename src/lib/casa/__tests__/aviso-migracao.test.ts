import { describe, expect, it } from "vitest";
import { lerConfigCasal } from "@/lib/casal/acerto";
import { oQueAbreSozinho, textosDoAvisoDaMigracao } from "../aviso-migracao";

/**
 * "O casal ficou mais simples": o aviso de uma vez para quem teve a casa passada do Nós dois para
 * o Casal simples. Vem antes do "Como funciona o casal" e só numa casa migrada.
 */
describe("O casal ficou mais simples: os textos", () => {
  it("título, no máximo quatro pontos com ícone, rodapé e os dois botões", () => {
    for (const papel of ["titular", "par"] as const) {
      const tx = textosDoAvisoDaMigracao(papel);
      expect(tx.titulo).toBe("O casal ficou mais simples");
      expect(tx.pontos.length).toBeLessThanOrEqual(4);
      expect(new Set(tx.pontos.map((p) => p.icone)).size).toBe(tx.pontos.length);
      expect(tx.rodape).toBe("Nada se perdeu.");
      expect([tx.ver, tx.agoraNao]).toEqual(["Ver como funciona", "Agora não"]);
    }
  });

  it("a titular lê que as contas da casa vieram para o Pessoal; o par, que tem o app completo", () => {
    const titular = textosDoAvisoDaMigracao("titular").pontos.map((p) => p.texto);
    const par = textosDoAvisoDaMigracao("par").pontos.map((p) => p.texto);
    expect(titular[1]).toBe("As contas da casa foram para o seu Pessoal, marcadas como Da casa. O orçamento veio junto.");
    expect(par[1]).toBe("Agora você tem o seu app completo, com o seu resumo e os seus cartões.");
    expect(titular[0]).toBe(par[0]);
    expect(titular.slice(2)).toEqual(par.slice(2));
  });

  it("sem travessão, sem emoji, sem 'pra' e sem gênero", () => {
    for (const papel of ["titular", "par"] as const) {
      const tx = textosDoAvisoDaMigracao(papel);
      for (const t of [tx.titulo, ...tx.pontos.map((p) => p.texto), tx.rodape, tx.ver, tx.agoraNao]) {
        expect(t).not.toMatch(/[—–]/);
        expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(t).not.toMatch(/\bpra\b/i);
        expect(t).not.toMatch(/\b(sozinha|sozinho|bem-vinda|bem-vindo|pronta|pronto|ela|ele)\b/i);
      }
    }
  });
});

describe("O casal ficou mais simples: quando abre", () => {
  const base = { naCasa: true, migrada: true, avisoVisto: false, tutorialVisto: false };

  it("casa migrada: o aviso vem antes do tutorial", () => {
    expect(oQueAbreSozinho(base)).toBe("aviso");
    expect(oQueAbreSozinho({ ...base, tutorialVisto: true })).toBe("aviso");
  });

  it("uma vez: depois de visto, segue para o tutorial só se ele ainda não foi visto", () => {
    expect(oQueAbreSozinho({ ...base, avisoVisto: true })).toBe("tutorial");
    expect(oQueAbreSozinho({ ...base, avisoVisto: true, tutorialVisto: true })).toBeNull();
  });

  it("casa criada já no simples não vê o aviso, só o tutorial de sempre", () => {
    expect(oQueAbreSozinho({ ...base, migrada: false })).toBe("tutorial");
    expect(oQueAbreSozinho({ ...base, migrada: false, tutorialVisto: true })).toBeNull();
  });

  it("quem não tem casa não vê nada", () => {
    expect(oQueAbreSozinho({ ...base, naCasa: false })).toBeNull();
  });

  it("a marca de quem viu mora no JSON do perfil Casal, junto com a do tutorial", () => {
    const c = lerConfigCasal({ nomeA: "Ana", nomeB: "Lucas", tutorialVisto: ["ana"], avisoMigracaoVisto: ["ana", "lucas", 3, ""] });
    expect(c.avisoMigracaoVisto).toEqual(["ana", "lucas"]);
    expect(lerConfigCasal({}).avisoMigracaoVisto).toBeUndefined();
  });
});
