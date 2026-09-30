import { describe, expect, it } from "vitest";
import { modoPedidoNoEvento, EVENTO_REGISTRAR } from "../registrar-eventos";

const evento = (detail?: unknown) =>
  detail === undefined ? new Event(EVENTO_REGISTRAR) : new CustomEvent(EVENTO_REGISTRAR, { detail });

describe("modoPedidoNoEvento: em que tela a gaveta do + abre", () => {
  it("sem detalhe abre na escolha, como sempre abriu (Fechamento, orçamento, guia antigo)", () => {
    expect(modoPedidoNoEvento(evento())).toBe("choice");
    expect(modoPedidoNoEvento(new CustomEvent(EVENTO_REGISTRAR))).toBe("choice");
  });

  it("aceita os nomes internos", () => {
    expect(modoPedidoNoEvento(evento({ modo: "import" }))).toBe("import");
    expect(modoPedidoNoEvento(evento({ modo: "type" }))).toBe("type");
    expect(modoPedidoNoEvento(evento({ modo: "voice" }))).toBe("voice");
  });

  it("aceita os nomes em português que o guia 'Comece por aqui' dispara", () => {
    expect(modoPedidoNoEvento(evento({ modo: "importar" }))).toBe("import");
    expect(modoPedidoNoEvento(evento({ modo: "digitar" }))).toBe("type");
    expect(modoPedidoNoEvento(evento({ modo: "falar" }))).toBe("voice");
  });

  it("nome desconhecido ou de outro tipo cai na escolha, sem quebrar", () => {
    expect(modoPedidoNoEvento(evento({ modo: "qualquer" }))).toBe("choice");
    expect(modoPedidoNoEvento(evento({ modo: 3 }))).toBe("choice");
    expect(modoPedidoNoEvento(evento({ modo: "toString" }))).toBe("choice");
    expect(modoPedidoNoEvento(evento("import"))).toBe("choice");
    expect(modoPedidoNoEvento(evento(null))).toBe("choice");
  });
});
