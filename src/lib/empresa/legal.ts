import { formatMoney } from "@/lib/money";
/**
 * Os números legais da Empresa (teto do MEI e guia) vêm da tabela ParametroLegal, sempre com a fonte
 * e a data. Aqui só os tipos e os textos do "?": nenhum número legal mora no código.
 *
 * ME, EPP e autônoma não têm linha na tabela (plano, pendência 5.2.10): o app não mostra número
 * legal nenhum para elas, e as telas de Limite e Impostos nem aparecem (12/10/2026, sem "em breve").
 */
export type Parametro = { valor: number; fonte: string; fonteData: string };

export type ParametrosDoMei = {
  teto: Parametro | null;
  tolerancia: Parametro | null;
  das: Parametro | null;
  diaDoDas: Parametro | null;
};

/** "16/09/2026". */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Os números legais são em real por definição (lei brasileira), qualquer que seja a moeda do app. */
const reais = (v: number) => formatMoney(v, "BRL", { round: Number.isInteger(v) });

/** O "?" do medidor: as três faixas e a fonte. */
export function textoDoTeto(p: ParametrosDoMei): string | null {
  if (!p.teto || !p.tolerancia) return null;
  return `Até ${reais(p.teto.valor)} no ano, continua MEI. Até ${reais(p.tolerancia.valor)}: paga uma guia extra e deixa de ser MEI em janeiro. Acima disso, deixa de ser MEI desde janeiro deste ano. Fonte: ${p.teto.fonte}, ${dataBr(p.teto.fonteData)}.`;
}

/** O "?" da guia: o valor, o dia e a fonte. */
export function textoDaGuia(p: ParametrosDoMei, valorPago: number | null): string | null {
  if (!p.das || !p.diaDoDas) return null;
  const base = `A guia do MEI de serviço é ${reais(p.das.valor)} e vence todo dia ${p.diaDoDas.valor}. Fonte: ${p.das.fonte}, ${dataBr(p.das.fonteData)}.`;
  return valorPago !== null && Math.abs(valorPago - p.das.valor) > 0.009 ? `${base} A sua última guia foi de ${reais(valorPago)}: é esse valor que o app usa.` : base;
}

/**
 * Quais telas legais da Empresa têm o que mostrar (12/10/2026, pedido da dona: nada de "em breve"
 * no menu). O Limite precisa do teto e da faixa extra; Impostos, da guia do MEI (valor e dia).
 * Fora do MEI, nenhuma das duas.
 */
export type FerramentasDoMei = { limite: boolean; impostos: boolean };

export function ferramentasDoMei(tipo: string | null | undefined, p: ParametrosDoMei): FerramentasDoMei {
  const mei = tipo === "MEI";
  return { limite: mei && !!p.teto && !!p.tolerancia, impostos: mei && !!p.das && !!p.diaDoDas };
}
