import { describe, expect, it } from "vitest";
import {
  EQUIVALENCIA,
  RESPOSTAS_DE_ASSINATURA,
  estadoDaAssinatura,
  eventoDoRegistro,
  eventosDoLegado,
  marcasDaDela,
  marcasDoAchado,
  marcasDoRaioX,
  mesmaAssinatura,
  naListaDeAssinaturas,
  noDinheiroPerdido,
  noRaioX,
  type Evento,
  type RespostaDeAssinatura,
} from "../regra";

/**
 * A regra única das assinaturas (15/10/2026): a última resposta, em qualquer das três telas, vale
 * em todo lugar. Aqui, a parte pura: a tabela de equivalência, a identidade e o "mais recente".
 */

let n = 0;
const ev = (resposta: RespostaDeAssinatura | "desfazer", minuto: number, extra: Partial<Evento> = {}): Evento => ({
  id: `e${String(n++).padStart(4, "0")}`,
  marcas: ["c:m:netflix", "n:netflix", "r:netflix"],
  resposta,
  em: new Date(Date.UTC(2026, 9, 15, 12, minuto)),
  minha: true,
  daCasa: false,
  registro: true,
  ...extra,
});
const NETFLIX = ["c:m:netflix", "n:netflix", "r:netflix"];

describe("a tabela de equivalência", () => {
  it("cada resposta tem um estado, e as do pedido da Dani batem", () => {
    expect(Object.keys(EQUIVALENCIA).sort()).toEqual([...RESPOSTAS_DE_ASSINATURA].sort());
    expect(EQUIVALENCIA.raiox_cancelei.estado).toBe("cancelada");
    expect(EQUIVALENCIA.raiox_manter.estado).toBe("mantida");
    expect(EQUIVALENCIA.perdido_uso.estado).toBe("mantida");
    expect(EQUIVALENCIA.lista_adicionar.estado).toBe("mantida");
    expect(EQUIVALENCIA.lista_nao_e.estado).toBe("fora");
    expect(EQUIVALENCIA.lista_remover.estado).toBe("fora");
    expect(EQUIVALENCIA.perdido_nao_uso.estado).toBe("para_cancelar");
    expect(EQUIVALENCIA.raiox_cancelar.estado).toBe("para_cancelar");
  });

  it("o que cada tela mostra para cada estado", () => {
    expect(noRaioX("aberta")).toEqual({ aparece: true, escolha: null, cancelada: false });
    expect(noRaioX("mantida").escolha).toBe("raiox_manter");
    expect(noRaioX("para_cancelar")).toEqual({ aparece: true, escolha: "raiox_cancelar", cancelada: false });
    expect(noRaioX("cancelada")).toEqual({ aparece: true, escolha: "raiox_cancelar", cancelada: true });
    expect(noRaioX("fora").aparece).toBe(false);

    expect(noDinheiroPerdido("aberta").estado).toBe("aberto");
    expect(noDinheiroPerdido("mantida").estado).toBe("uso");
    expect(noDinheiroPerdido("para_cancelar").estado).toBe("nao_uso");
    expect(noDinheiroPerdido("cancelada").estado).toBe("nao_uso");
    expect(noDinheiroPerdido("fora").aparece).toBe(false);

    expect(naListaDeAssinaturas("aberta")).toEqual({ aparece: true, paraCancelar: false });
    expect(naListaDeAssinaturas("mantida")).toEqual({ aparece: true, paraCancelar: false });
    expect(naListaDeAssinaturas("para_cancelar")).toEqual({ aparece: true, paraCancelar: true });
    expect(naListaDeAssinaturas("cancelada").aparece).toBe(false);
    expect(naListaDeAssinaturas("fora").aparece).toBe(false);
  });
});

describe("a identidade: a mesma Netflix nas três telas", () => {
  it("Raio-X, carta do Dinheiro perdido e a assinatura posta à mão têm marca em comum", () => {
    const raiox = marcasDoRaioX({ chave: "netflix", nome: "Netflix", descricao: "NETFLIX.COM" });
    const carta = marcasDoAchado({ comerciante: "m:netflix#5590", nome: "Netflix", descricaoDoLogo: "Netflix" });
    const dela = marcasDaDela({ nome: "Netflix", chaveDoHistorico: "m:netflix" });
    expect(mesmaAssinatura(raiox, carta)).toBe(true);
    expect(mesmaAssinatura(carta, dela)).toBe(true);
    expect(mesmaAssinatura(raiox, dela)).toBe(true);
    // O "#5590" do Dinheiro perdido sai da marca.
    expect(carta).toContain("c:m:netflix");
  });

  it("assinaturas diferentes não se misturam", () => {
    expect(mesmaAssinatura(marcasDoRaioX({ chave: "netflix", nome: "Netflix" }), marcasDoRaioX({ chave: "spotify", nome: "Spotify" }))).toBe(false);
  });
});

describe("a última resposta vale", () => {
  it("sem resposta: aberta", () => {
    expect(estadoDaAssinatura(NETFLIX, []).estado).toBe("aberta");
  });

  it("a mais recente ganha, venha de que tela vier", () => {
    const eventos = [ev("raiox_manter", 1), ev("perdido_nao_uso", 2)];
    expect(estadoDaAssinatura(NETFLIX, eventos).estado).toBe("para_cancelar");
    expect(estadoDaAssinatura(NETFLIX, [...eventos, ev("lista_adicionar", 3)]).estado).toBe("mantida");
    expect(estadoDaAssinatura(NETFLIX, [...eventos, ev("lista_nao_e", 3)]).estado).toBe("fora");
  });

  it("desfazer volta ao estado de antes, e desfazer de novo volta mais um", () => {
    const a = ev("raiox_manter", 1);
    const b = ev("perdido_nao_uso", 2);
    const d1 = ev("desfazer", 3, { desfaz: b.id });
    expect(estadoDaAssinatura(NETFLIX, [a, b, d1]).estado).toBe("mantida");
    const d2 = ev("desfazer", 4, { desfaz: a.id });
    expect(estadoDaAssinatura(NETFLIX, [a, b, d1, d2]).estado).toBe("aberta");
  });

  it("resposta de antes da regra conta enquanto não há registro; depois o lugar antigo é só espelho", () => {
    const antiga = ev("raiox_manter", 1, { registro: false });
    expect(estadoDaAssinatura(NETFLIX, [antiga]).estado).toBe("mantida");
    // O espelho do lugar antigo, gravado depois, não passa por cima do registro.
    const espelho = ev("raiox_cancelar", 9, { registro: false });
    expect(estadoDaAssinatura(NETFLIX, [antiga, ev("lista_adicionar", 5), espelho]).estado).toBe("mantida");
  });

  it("as respostas de antes, de cada tela, viram eventos com a hora certa", () => {
    const t = (m: number) => new Date(Date.UTC(2026, 9, 1, 12, m));
    const eventos = eventosDoLegado({
      raiox: [
        { id: "1", tipo: "raiox_manter", chave: "netflix", descricao: "Netflix", createdAt: t(1) },
        { id: "2", tipo: "raiox_metade", chave: "ifood", descricao: "iFood", createdAt: t(1) },
      ],
      confirmacoes: [{ id: "3", chave: "spotify|sim", createdAt: t(2) }, { id: "4", chave: "spotify|nao|2026-10", createdAt: t(2) }],
      achados: [
        { id: "5", chave: "assinatura:m:netflix#5590", tipo: "assinatura", nome: "Netflix", estado: "nao_uso", decididoEm: t(3), createdAt: t(0), comerciante: "m:netflix#5590", raiox: "netflix" },
        { id: "6", chave: "tarifa:x", tipo: "tarifa", nome: "Tarifa", estado: "nao_uso", decididoEm: t(3), createdAt: t(0), comerciante: null, raiox: null },
      ],
      recusas: [{ id: "7", chave: "nao-assinatura:icloud", createdAt: t(4) }, { id: "8", chave: "m:vivo", createdAt: t(4) }],
      dela: [{ id: "9", nome: "Academia", chaveDoHistorico: null, createdAt: t(5) }],
    });
    expect(eventos.map((e) => e.resposta)).toEqual(["raiox_manter", "raiox_cancelei", "perdido_nao_uso", "lista_nao_e", "lista_adicionar"]);
    // A Netflix: Manter no Raio-X às 12h01, Não uso no Dinheiro perdido às 12h03: vale o Não uso.
    expect(estadoDaAssinatura(NETFLIX, eventos).estado).toBe("para_cancelar");
    expect(estadoDaAssinatura(["n:icloud"], eventos).estado).toBe("fora");
    expect(estadoDaAssinatura(["r:spotify"], eventos).estado).toBe("cancelada");
  });

  it("a linha do registro vira evento; linha estranha não", () => {
    const e = eventoDoRegistro({ id: "x", descricao: "perdido_uso", dados: { marcas: NETFLIX, em: "2026-10-15T12:00:00.000Z" }, createdAt: new Date() }, true);
    expect(e?.resposta).toBe("perdido_uso");
    expect(e?.em.toISOString()).toBe("2026-10-15T12:00:00.000Z");
    expect(eventoDoRegistro({ id: "y", descricao: "qualquer", dados: { marcas: NETFLIX }, createdAt: new Date() }, true)).toBeNull();
    expect(eventoDoRegistro({ id: "z", descricao: "perdido_uso", dados: null, createdAt: new Date() }, true)).toBeNull();
  });
});

describe("Casal simples: o que é da casa vale para os dois", () => {
  const doOutro = (resposta: RespostaDeAssinatura, minuto: number, daCasa: boolean) => ev(resposta, minuto, { minha: false, daCasa });

  it("a resposta do outro vale quando a assinatura é da casa para os dois", () => {
    const eventos = [ev("raiox_manter", 1), doOutro("perdido_nao_uso", 2, true)];
    expect(estadoDaAssinatura(NETFLIX, eventos, true).estado).toBe("para_cancelar");
  });

  it("a minha Netflix não é da casa: a resposta do outro não mexe nela", () => {
    expect(estadoDaAssinatura(NETFLIX, [ev("raiox_manter", 1), doOutro("perdido_nao_uso", 2, true)], false).estado).toBe("mantida");
  });

  it("a cobrança dele não é da casa (ou é Só meu): a resposta dele é só dele", () => {
    expect(estadoDaAssinatura(NETFLIX, [doOutro("lista_nao_e", 2, false)], true).estado).toBe("aberta");
  });
});
