import { describe, expect, it } from "vitest";
import { entrarNaFila, type AvisoNaFila } from "../fila-de-avisos";

const vazia: AvisoNaFila[] = [];

describe("fila dos avisos do rodapé", () => {
  it("deu certo depois de um erro: o erro sai da tela", () => {
    const fila = entrarNaFila(vazia, { id: 1, message: "Escolha uma categoria para o gasto.", erro: true });
    expect(entrarNaFila(fila, { id: 2, message: "Lançamento salvo com sucesso." }).map((a) => a.id)).toEqual([2]);
  });
  it("erro novo não apaga o aviso de sucesso anterior", () => {
    const fila = entrarNaFila(vazia, { id: 1, message: "Salvo." });
    expect(entrarNaFila(fila, { id: 2, message: "Falhou.", erro: true }).map((a) => a.id)).toEqual([1, 2]);
  });
  it("o mesmo texto não aparece duas vezes", () => {
    const fila = entrarNaFila(vazia, { id: 1, message: "Digite o valor.", erro: true });
    expect(entrarNaFila(fila, { id: 2, message: "Digite o valor.", erro: true }).map((a) => a.id)).toEqual([2]);
  });
});
