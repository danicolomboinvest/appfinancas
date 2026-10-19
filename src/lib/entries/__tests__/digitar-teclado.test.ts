import { describe, expect, it } from "vitest";
import { centavosDoCampo, MAX_CENTAVOS, teclaDoTeclado, teclar } from "../digitar";

describe("Digitar: o teclado de verdade (18/10/2026)", () => {
  it("números do teclado físico viram as teclas da tela; Backspace e Delete apagam", () => {
    let c = 0;
    for (const k of ["1", "2", "5", "0"]) c = teclar(c, teclaDoTeclado(k)!);
    expect(c).toBe(1250);
    expect(teclar(c, teclaDoTeclado("Backspace")!)).toBe(125);
    expect(teclaDoTeclado("Delete")).toBe("del");
  });
  it("o resto não mexe no valor", () => {
    for (const k of ["Enter", "a", ",", ".", "ArrowLeft", " ", "Tab", "F1", "10"]) expect(teclaDoTeclado(k)).toBeNull();
  });
  it("o teclado numérico do celular: só os dígitos, como na maquininha", () => {
    expect(centavosDoCampo("4590")).toBe(4590);
    expect(centavosDoCampo("45,90")).toBe(4590);
    expect(centavosDoCampo("1.234 5")).toBe(12345);
    expect(centavosDoCampo("")).toBe(0);
    expect(centavosDoCampo("000")).toBe(0);
    expect(centavosDoCampo("0012")).toBe(12);
  });
  it("passou do máximo: o valor fica como estava", () => {
    expect(centavosDoCampo(String(MAX_CENTAVOS))).toBe(MAX_CENTAVOS);
    expect(centavosDoCampo(`${MAX_CENTAVOS}1`)).toBeNull();
  });
});
