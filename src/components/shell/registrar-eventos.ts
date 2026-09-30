/**
 * O "contrato" pra qualquer tela abrir a gaveta do Registrar sem receber função por prop.
 *
 * A gaveta mora no AppShell, que envolve o app inteiro; os botões que pedem por ela moram em
 * telas do servidor, no guia de primeiros passos, no fechamento do mês. Um evento na janela
 * liga as duas pontas sem passar callback por cinco camadas. Os nomes ficam aqui, num lugar só,
 * pra quem dispara e quem escuta não escreverem a string cada um do seu jeito.
 */

/** Em que tela a gaveta abre: a escolha (o "+"), digitar, falar ou importar arquivo. */
export type ModoDoRegistrar = "choice" | "type" | "voice" | "import";

/** Abre a gaveta. Sem `detail`, na escolha; com `{ detail: { modo: "type" } }`, direto no modo. */
export const EVENTO_REGISTRAR = "spi:registrar";
/** Abre a gaveta direto na importação de extrato ou fatura. */
export const EVENTO_IMPORTAR = "spi:importar";

/**
 * Os nomes aceitos em `detail.modo`. Além dos internos, os em português que as telas usam
 * ("importar", "digitar", "falar"): o guia "Comece por aqui" já dispara `{ modo: "importar" }`,
 * e um nome que a gaveta não reconhecesse abriria na escolha sem ninguém perceber o porquê.
 */
const MODOS: Record<string, ModoDoRegistrar> = {
  choice: "choice",
  type: "type",
  voice: "voice",
  import: "import",
  escolher: "choice",
  digitar: "type",
  falar: "voice",
  voz: "voice",
  importar: "import",
};

/**
 * O modo pedido por quem disparou o evento. Tudo que não for um modo conhecido (evento sem
 * `detail`, `new Event` simples, texto errado) cai na escolha: na dúvida, a gaveta abre no
 * começo, que é o comportamento de sempre.
 */
export function modoPedidoNoEvento(event: Event): ModoDoRegistrar {
  const detail = (event as CustomEvent<unknown>).detail;
  if (detail && typeof detail === "object" && "modo" in detail) {
    const modo = (detail as { modo: unknown }).modo;
    if (typeof modo === "string" && Object.hasOwn(MODOS, modo)) return MODOS[modo];
  }
  return "choice";
}

/** Atalho pra componentes do cliente: `pedirRegistro("import")` abre a gaveta na importação. */
export function pedirRegistro(modo: ModoDoRegistrar = "choice"): void {
  window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, { detail: { modo } }));
}
