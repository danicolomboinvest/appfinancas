import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";
import { NOMES_PADRAO, SECOES_DO_MANUAL, comNomes, nomesDoTema, type BlocoDoManual } from "../conteudo";

/** Todo texto do manual, do jeito que a página /guia monta. */
function textosDoManual(n: (t: string) => string): string[] {
  const deBloco = (b: BlocoDoManual): string[] => {
    if (b.tipo === "passos") return b.itens.flatMap((p) => [p.titulo, p.texto]);
    if (b.tipo === "comparacao") return b.colunas.flatMap((c) => c.itens);
    if (b.tipo === "regras") return b.itens.map((r) => r.texto);
    return [b.texto];
  };
  return SECOES_DO_MANUAL.flatMap((s) => [s.titulo, s.resumo, ...s.blocos.flatMap(deBloco)]).map(n);
}

describe("manual: os nomes que ele cita são os que a tela do tema mostra", () => {
  it("nenhuma marca fica sem trocar, em nenhum tema, pessoa ou empresa", () => {
    for (const t of PROFILE_THEMES) {
      for (const kind of ["PESSOAL", "EMPRESA"]) {
        const nomes = nomesDoTema(vozDoTema(t.key, kind));
        for (const texto of textosDoManual((x) => comNomes(x, nomes))) {
          expect(texto, `${t.key}/${kind}`).not.toMatch(/\{[A-Za-z]+\}/);
        }
      }
    }
  });

  it("no Girly, o manual manda procurar o botão com o nome que o Girly escreve", () => {
    const g = vozDoTema("girly").titulos;
    const texto = textosDoManual((x) => comNomes(x, nomesDoTema(vozDoTema("girly")))).join("\n");
    expect(texto).toContain(`"${g.impHistoricoTitulo}"`);
    expect(texto).toContain(`"${g.impRemover}"`);
    expect(texto).toContain(`"${g.uiEditar}"`);
    expect(texto).toContain(`"${g.focoAcao}"`);
    expect(texto).toContain(`"${g.impFaturaMes}"`);
    expect(texto).not.toContain("Histórico de importações");
    expect(texto).not.toContain("Ver o que fazer");
    // Sem jargão e sem cor: o "aviso amarelo" é rosa no Girly.
    expect(texto).not.toMatch(/aport|provento|patrim[oô]nio|rentabilidade|ac[uú]mulo|consolidado|proje[cç][aã]o/i);
    expect(texto).not.toMatch(/amarel/i);
  });

  it("na Empresa, a reserva é o caixa de segurança", () => {
    const texto = textosDoManual((x) => comNomes(x, nomesDoTema(vozDoTema("padrao", "EMPRESA")))).join("\n");
    expect(texto).toContain("Caixa de segurança");
    expect(texto).toContain("pro caixa de segurança");
  });

  it("o PDF usa os nomes do Padrão, os mesmos da tela de quem não trocou de tema", () => {
    expect(NOMES_PADRAO.historico).toBe("Histórico de importações");
    expect(NOMES_PADRAO.importarArquivo).toBe("Importar extrato ou fatura");
    expect(NOMES_PADRAO.sobraReserva).toBe("Mandar a sobra para a reserva");
  });
});
