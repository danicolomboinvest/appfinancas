import { describe, expect, it } from "vitest";
import { avisosDeHoje, dentroDoReembolso, diaDoAviso, diaDoLembreteDoReembolso, fimDoReembolso, MOTIVOS, ofertaDisponivel, PEDIDO_DO_MOTIVO, proximaTela, telaInicial, type Acao, type Tela } from "../regras";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia));

describe("antes de cancelar", () => {
  it("cinco motivos, cada um com o seu pedido", () => {
    expect(MOTIVOS.map((m) => m.rotulo)).toEqual(["Achei caro", "Difícil de usar", "Algo não está certo", "Não uso mais", "Outro motivo"]);
    expect(PEDIDO_DO_MOTIVO.caro).toBe("meses_gratis");
    expect(PEDIDO_DO_MOTIVO.naouso).toBe("aviso_renovacao");
  });

  it("cada oferta só uma vez a cada 12 meses", () => {
    expect(ofertaDisponivel(null, d(2026, 10, 11))).toBe(true);
    expect(ofertaDisponivel(d(2026, 1, 10), d(2026, 10, 11))).toBe(false);
    expect(ofertaDisponivel(d(2025, 10, 11), d(2026, 10, 11))).toBe(true);
  });

  it("o aviso de 'Não uso mais' sai 7 dias antes da renovação", () => {
    expect(diaDoAviso(d(2027, 3, 15)).toISOString().slice(0, 10)).toBe("2027-03-08");
    expect(diaDoAviso(d(2027, 3, 3)).toISOString().slice(0, 10)).toBe("2027-02-24");
    const p = [
      { id: 1, tipo: "aviso_renovacao", estado: "aberto", avisarEm: d(2027, 3, 8) },
      { id: 2, tipo: "aviso_renovacao", estado: "feito", avisarEm: d(2027, 3, 8) },
      { id: 3, tipo: "duvida", estado: "aberto", avisarEm: null },
    ];
    expect(avisosDeHoje(p, d(2027, 3, 7))).toEqual([]);
    expect(avisosDeHoje(p, d(2027, 3, 8)).map((x) => x.id)).toEqual([1]);
  });

  it("o 'Quero cancelar mesmo' chega ao caminho em no máximo 2 telas, de qualquer tela", () => {
    const telas: Tela[] = ["motivos", "oferta", "feito"];
    for (const t of telas) expect(proximaTela(t, "cancelar")).toBe("caminho");
    // Do começo: motivos (1) e o caminho (2).
    let t: Tela = telaInicial("site");
    let n = 1;
    for (const a of ["cancelar"] as Acao[]) {
      t = proximaTela(t, a);
      n++;
    }
    expect([t, n]).toEqual(["caminho", 2]);
  });

  it("quem pagou no iPhone vê só o caminho da Apple, sem ofertas", () => {
    expect(telaInicial("apple")).toBe("caminho");
    expect(telaInicial("apple", true)).toBe("caminho");
  });

  it("até 7 dias da compra a folha começa pelo reembolso; o lembrete sai 1 dia antes do fim", () => {
    const compra = d(2026, 10, 5);
    expect(fimDoReembolso(compra).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(diaDoLembreteDoReembolso(compra).toISOString().slice(0, 10)).toBe("2026-10-11");
    expect(dentroDoReembolso(compra, d(2026, 10, 12))).toBe(true);
    expect(dentroDoReembolso(compra, d(2026, 10, 13))).toBe(false);
    expect(telaInicial("site", true)).toBe("reembolso");
    expect(telaInicial("site", false)).toBe("motivos");
    // Do cartão do reembolso, o "Quero cancelar mesmo" chega ao caminho na 2ª tela.
    expect(proximaTela("reembolso", "cancelar")).toBe("caminho");
    expect(proximaTela("reembolso", "contar")).toBe("motivos");
  });

  it("o lembrete do reembolso também sai pelos avisos do dia", () => {
    const p = [{ id: 9, tipo: "aviso_reembolso", estado: "aberto", avisarEm: d(2026, 10, 11) }];
    expect(avisosDeHoje(p, d(2026, 10, 11)).map((x) => x.id)).toEqual([9]);
  });
});
