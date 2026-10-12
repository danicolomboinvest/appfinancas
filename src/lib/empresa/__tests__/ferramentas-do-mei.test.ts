import { describe, expect, it } from "vitest";
import { ferramentasDoMei, type ParametrosDoMei } from "../legal";
import { menuDaEmpresa } from "@/components/shell/nav-sections";

const p = (valor: number) => ({ valor, fonte: "Receita Federal", fonteData: "2026-01-01" });
const COMPLETO: ParametrosDoMei = { teto: p(81000), tolerancia: p(97200), das: p(80.9), diaDoDas: p(20) };
const VAZIO: ParametrosDoMei = { teto: null, tolerancia: null, das: null, diaDoDas: null };
const hrefs = (tipo: string | null, legal: ParametrosDoMei) => menuDaEmpresa(ferramentasDoMei(tipo, legal)).map((i) => i.href);

describe("Limite do MEI e Impostos só aparecem quando têm o que mostrar (sem 'em breve')", () => {
  it("MEI com a tabela legal completa vê as duas", () => {
    expect(ferramentasDoMei("MEI", COMPLETO)).toEqual({ limite: true, impostos: true });
    expect(hrefs("MEI", COMPLETO)).toEqual(expect.arrayContaining(["/empresa/limite", "/empresa/impostos"]));
  });

  it("Autônoma e ME não veem nenhuma das duas", () => {
    for (const tipo of ["AUTONOMA", "ME", null]) {
      expect(ferramentasDoMei(tipo, COMPLETO)).toEqual({ limite: false, impostos: false });
      expect(hrefs(tipo, COMPLETO)).not.toContain("/empresa/limite");
      expect(hrefs(tipo, COMPLETO)).not.toContain("/empresa/impostos");
    }
  });

  it("MEI sem o número na tabela não vê a tela daquele número", () => {
    expect(ferramentasDoMei("MEI", VAZIO)).toEqual({ limite: false, impostos: false });
    expect(ferramentasDoMei("MEI", { ...COMPLETO, tolerancia: null })).toEqual({ limite: false, impostos: true });
    expect(ferramentasDoMei("MEI", { ...COMPLETO, das: null })).toEqual({ limite: true, impostos: false });
  });

  it("o resto do menu da Empresa não muda", () => {
    expect(hrefs("ME", VAZIO)).toEqual(["/empresa", "/empresa/como-vai", "/empresa/clientes", "/empresa/preco", "/empresa/relatorios", "/empresa/configuracoes"]);
  });
});
