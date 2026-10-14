import type { ReactElement } from "react";
import { CampoDeDinheiro } from "../CampoDeDinheiro";

/**
 * Ajuda dos testes de dinheiro: digita no CampoDeDinheiro tecla por tecla, sem DOM. Quem importa
 * precisa mockar o useCurrency (`vi.mock("@/components/money/MoneyProvider", ...)`).
 */
type PropsDoInput = { value: string; inputMode: string; type: string; onChange: (e: { target: { value: string } }) => void };

/** Renderiza o campo (é uma função) e devolve as props do <input>. */
export function campo(valor: number | null, onValor: (v: number | null) => void, extra: Record<string, unknown> = {}) {
  return (CampoDeDinheiro({ valor, onValor, ...extra }) as ReactElement<PropsDoInput>).props;
}

/** Como no celular: o texto novo é o que o campo mostra + a tecla ("⌫" apaga a última). */
export function digitar(teclas: string, inicial: number | null = null, extra: Record<string, unknown> = {}) {
  let valor = inicial;
  for (const tecla of teclas) {
    const p = campo(valor, (v) => (valor = v), extra);
    p.onChange({ target: { value: tecla === "⌫" ? p.value.slice(0, -1) : p.value + tecla } });
  }
  return valor;
}
