import { describe, expect, it } from "vitest";
import { trocouDePerfil } from "../perfil-da-tela";

describe("trocouDePerfil", () => {
  it("recusa quando a tela mostra outro perfil que não o ativo", () => {
    expect(trocouDePerfil("empresa", "pessoal")).toBe(true);
  });

  it("deixa gravar quando a tela está no perfil ativo", () => {
    expect(trocouDePerfil("pessoal", "pessoal")).toBe(false);
  });

  it("não barra tela antiga que ainda não manda o perfil (deploy no meio)", () => {
    expect(trocouDePerfil(null, "pessoal")).toBe(false);
    expect(trocouDePerfil(undefined, "pessoal")).toBe(false);
    expect(trocouDePerfil("", "pessoal")).toBe(false);
  });

  it("ignora o que não é texto (um arquivo no lugar do campo, por exemplo)", () => {
    expect(trocouDePerfil(new Blob(["x"]), "pessoal")).toBe(false);
  });
});
