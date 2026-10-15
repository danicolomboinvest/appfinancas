import { describe, expect, it } from "vitest";
import { valorInformadoAoSalvar } from "../valor-informado";

const agora = new Date("2026-10-15T15:00:00Z");
const base = { rendaFixa: true, criando: true, estimadoPeloApp: false, valor: 1000, original: null, investido: 1000, temData: true, mudouABase: false, agora };

describe("valor informado ao salvar a renda fixa", () => {
  it("ação, FII e o resto não mexem", () => {
    expect(valorInformadoAoSalvar({ ...base, rendaFixa: false, valor: 1234 })).toBeUndefined();
  });

  it("criando com a estimativa do app ou com o valor igual ao investido: parte da compra", () => {
    expect(valorInformadoAoSalvar({ ...base, estimadoPeloApp: true, valor: 1080 })).toEqual({ valorInformado: null, valorInformadoEm: null });
    expect(valorInformadoAoSalvar(base)).toEqual({ valorInformado: null, valorInformadoEm: null });
  });

  it("criando com o valor do banco digitado, ou sem a data da compra: parte do valor dela", () => {
    expect(valorInformadoAoSalvar({ ...base, valor: 1087.4 })).toEqual({ valorInformado: 1087.4, valorInformadoEm: agora });
    expect(valorInformadoAoSalvar({ ...base, temData: false, estimadoPeloApp: true })).toEqual({ valorInformado: 1000, valorInformadoEm: agora });
  });

  it("editando: mexeu no valor de hoje vira o informado; mexeu na data ou na taxa volta para a compra", () => {
    const ed = { ...base, criando: false, original: 1080 };
    expect(valorInformadoAoSalvar({ ...ed, valor: 1100 })).toEqual({ valorInformado: 1100, valorInformadoEm: agora });
    expect(valorInformadoAoSalvar({ ...ed, valor: 1080, mudouABase: true })).toEqual({ valorInformado: null, valorInformadoEm: null });
    expect(valorInformadoAoSalvar({ ...ed, valor: 1080 })).toBeUndefined();
    // Sem data, mudar a taxa não tem de onde partir: fica como estava.
    expect(valorInformadoAoSalvar({ ...ed, valor: 1080, mudouABase: true, temData: false })).toBeUndefined();
  });
});
