import { describe, expect, it } from "vitest";
import {
  CHAVE_BOAS_VINDAS,
  CHAVE_VAZIO_DIA2,
  CHAVE_VAZIO_DIA5,
  etapaComConta,
  etapaSemConta,
} from "../boas-vindas";

const DIA = 86_400_000;
const liberado = new Date("2026-10-01T12:00:00Z");
const depois = (dias: number) => new Date(liberado.getTime() + dias * DIA);
const nada = new Set<string>();

describe("etapaSemConta: lembrete de criar a conta, no 1º e no 4º dia", () => {
  it("antes de 1 dia não manda nada", () => {
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: null, lembrete2Em: null }, depois(0.5))).toBeNull();
  });
  it("com 1 dia manda o primeiro, e só uma vez", () => {
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: null, lembrete2Em: null }, depois(1.2))).toBe("conta-dia1");
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: depois(1.2), lembrete2Em: null }, depois(2.2))).toBeNull();
  });
  it("com 4 dias manda o segundo, e só uma vez", () => {
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: depois(1.2), lembrete2Em: null }, depois(4.1))).toBe("conta-dia4");
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: depois(1.2), lembrete2Em: depois(4.1) }, depois(5.1))).toBeNull();
  });
  it("quem perdeu o do 1º dia e já está no 4º recebe só o do 4º, nunca os dois", () => {
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: null, lembrete2Em: null }, depois(4.5))).toBe("conta-dia4");
  });
  it("depois do prazo a trilha acaba", () => {
    expect(etapaSemConta({ liberadoEm: liberado, lembrete1Em: null, lembrete2Em: null }, depois(11))).toBeNull();
  });
});

describe("etapaComConta: boas-vindas, e empurrão no 2º e no 5º dia só pra quem não lançou nada", () => {
  const base = { confirmadoEm: liberado, enviados: nada, temLancamento: false };
  it("logo depois de confirmar: boas-vindas", () => {
    expect(etapaComConta(base, depois(0.01))).toBe(CHAVE_BOAS_VINDAS);
  });
  it("boas-vindas não repete", () => {
    expect(etapaComConta({ ...base, enviados: new Set([CHAVE_BOAS_VINDAS]) }, depois(1))).toBeNull();
  });
  it("2º dia sem lançamento: empurrão; 5º dia: o último", () => {
    const jaMandou = new Set([CHAVE_BOAS_VINDAS]);
    expect(etapaComConta({ ...base, enviados: jaMandou }, depois(2.1))).toBe(CHAVE_VAZIO_DIA2);
    expect(etapaComConta({ ...base, enviados: new Set([...jaMandou, CHAVE_VAZIO_DIA2]) }, depois(3))).toBeNull();
    expect(etapaComConta({ ...base, enviados: new Set([...jaMandou, CHAVE_VAZIO_DIA2]) }, depois(5.2))).toBe(CHAVE_VAZIO_DIA5);
    expect(etapaComConta({ ...base, enviados: new Set([...jaMandou, CHAVE_VAZIO_DIA2, CHAVE_VAZIO_DIA5]) }, depois(6))).toBeNull();
  });
  it("quem lançou qualquer coisa sai da trilha na hora, em qualquer dia", () => {
    for (const d of [0.01, 2.1, 5.2]) expect(etapaComConta({ ...base, temLancamento: true }, depois(d))).toBeNull();
  });
  it("depois do prazo a trilha acaba", () => {
    expect(etapaComConta(base, depois(13))).toBeNull();
  });
});
