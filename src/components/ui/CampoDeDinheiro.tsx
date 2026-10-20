"use client";

import { formatMoney, moedaSemCentavos, type CurrencyCode } from "@/lib/money";
import { centavosDoTexto } from "@/lib/dinheiro/digitado";
import { useCurrency } from "@/components/money/MoneyProvider";

type Proprias = {
  /** Valor em reais (1234.56). null, undefined ou 0 mostram o campo vazio. */
  valor: number | null | undefined;
  /** Chamado a cada dígito com o valor em reais, ou null quando ela apaga tudo. */
  onValor: (reais: number | null) => void;
  /** Mostra o símbolo dentro do campo ("R$ 1.234,56"). Sem ele, só "1.234,56" (o símbolo já está desenhado ao lado). */
  comSimbolo?: boolean;
  /** Teto em reais: o que passar disso fica no teto. */
  max?: number;
  currency?: CurrencyCode;
};

type Props = Proprias & Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "max">;

/**
 * O campo de dinheiro de digitar livre, com o visual de cada tela (className vem de fora).
 *
 * Mesma regra do CurrencyField (ver lib/dinheiro/digitado): os dígitos entram como centavos,
 * a máscara mostra sempre as duas casas, e o teclado é o decimal (no iPhone, com a vírgula).
 * Ao tocar, seleciona tudo: o que ela digita substitui o valor, em vez de entrar depois dele.
 */
export function CampoDeDinheiro({ valor, onValor, comSimbolo = false, max, currency: moedaProp, onFocus, ...resto }: Props) {
  const moedaDoApp = useCurrency();
  const moeda = moedaProp ?? moedaDoApp;
  const texto = valor ? formatMoney(valor, moeda, comSimbolo ? {} : { bare: true }) : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...resto}
      value={texto}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const c = centavosDoTexto(e.target.value, moedaSemCentavos(moeda));
        if (c === null) return onValor(null);
        const reais = c / 100;
        onValor(max !== undefined ? Math.min(reais, max) : reais);
      }}
    />
  );
}
