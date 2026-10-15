import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FOTOS_DE_META, TIPOS_DE_META, fotoDaMeta, fotoDoTipo, fotosEmOrdem, nomeCurto, tipoDoNome } from "../tipos";

describe("os 18 tipos de meta", () => {
  it("são 18, sem repetir chave nem nome, na ordem do protótipo", () => {
    expect(TIPOS_DE_META).toHaveLength(18);
    expect(new Set(TIPOS_DE_META.map((t) => t.chave)).size).toBe(18);
    expect(TIPOS_DE_META[0].nome).toBe("Reserva de emergência");
    expect(TIPOS_DE_META[17].nome).toBe("Outro");
  });

  it("todo tipo tem foto sugerida, e todo arquivo do banco existe em public/fotos/metas", () => {
    for (const t of TIPOS_DE_META) expect(fotoDoTipo(t.chave)).toMatch(/^\/fotos\/metas\/.+\.jpg$/);
    for (const f of FOTOS_DE_META) expect(existsSync(join(process.cwd(), "public/fotos/metas", f.arquivo))).toBe(true);
  });

  it("a grade começa pelas fotos do tipo e tem todas, sem repetir", () => {
    const g = fotosEmOrdem("VIAGEM");
    expect(g[0]).toBe("/fotos/metas/viagem-praia.jpg");
    expect(new Set(g).size).toBe(FOTOS_DE_META.length);
  });

  it("o tipo sai do nome quando ela não toca num chip", () => {
    expect(tipoDoNome("Viagem para a praia")).toBe("VIAGEM");
    expect(tipoDoNome("Europa 2027")).toBe("VIAGEM");
    expect(tipoDoNome("Apê novo")).toBe("CASA");
    expect(tipoDoNome("Reserva de emergência")).toBe("RESERVA");
    expect(tipoDoNome("Trocar de carro")).toBe("CARRO");
    expect(tipoDoNome("Casamento")).toBe("CASAMENTO");
    expect(tipoDoNome("Presente da mãe")).toBe("GENERICO");
  });

  it("meta antiga sem foto usa a do tipo; com foto, a dela", () => {
    expect(fotoDaMeta({ fotoUrl: null, icon: "CARRO", name: "Carro" })).toBe("/fotos/metas/carro.jpg");
    expect(fotoDaMeta({ fotoUrl: null, icon: "GENERICO", name: "Viagem Europa" })).toBe("/fotos/metas/viagem-praia.jpg");
    expect(fotoDaMeta({ fotoUrl: "/api/metas/foto/abc", icon: "CARRO", name: "x" })).toBe("/api/metas/foto/abc");
  });
});

describe("nome curto (fileira de fotos e Próxima a chegar)", () => {
  it("é o do protótipo para as metas da Ana", () => {
    expect(nomeCurto("Reserva de emergência")).toBe("Reserva");
    expect(nomeCurto("Viagem Europa 2027")).toBe("Europa");
    expect(nomeCurto("Trocar de carro")).toBe("Carro");
  });

  it("fica com 'Viagem' quando é a única palavra, e não corta a palavra no meio", () => {
    expect(nomeCurto("Viagem")).toBe("Viagem");
    expect(nomeCurto("Intercâmbio na Irlanda")).toBe("Intercâmbio");
    expect(nomeCurto("Apartamento")).toBe("Apartamento");
  });
});
