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
  /** A guia do MEI de serviço inteira (a primeira chave, de 11/10/2026). */
  das: Parametro | null;
  diaDoDas: Parametro | null;
  /** As partes da guia (15/10/2026): o salário mínimo, o INSS em % dele, o ICMS e o ISS. Com as
   * quatro, a guia sai pela atividade do MEI (ver dasEstimado). */
  salarioMinimo?: Parametro | null;
  inssPercentual?: Parametro | null;
  icms?: Parametro | null;
  iss?: Parametro | null;
};

/** O que o MEI faz, para a guia: serviço paga ISS, comércio e indústria pagam ICMS, os dois pagam os dois. */
export const ATIVIDADES_DO_MEI = [
  { chave: "servico", nome: "Serviço" },
  { chave: "comercio", nome: "Comércio ou indústria" },
  { chave: "comercio_servico", nome: "Comércio e serviço" },
] as const;
export type AtividadeDoMei = (typeof ATIVIDADES_DO_MEI)[number]["chave"];

export function ehAtividadeDoMei(v: unknown): v is AtividadeDoMei {
  return ATIVIDADES_DO_MEI.some((a) => a.chave === v);
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * A guia estimada pelo app para a atividade: INSS (o % do salário mínimo) mais ICMS (comércio ou
 * indústria) e/ou ISS (serviço), tudo da tabela ParametroLegal. Sem as partes, o serviço ainda usa
 * a guia inteira de antes (mei_das_servico); as outras atividades ficam sem número.
 */
export function dasEstimado(p: ParametrosDoMei, atividade: AtividadeDoMei): Parametro | null {
  const { salarioMinimo: sm, inssPercentual: pct, icms, iss } = p;
  if (sm && pct && icms && iss) {
    const inss = centavos((sm.valor * pct.valor) / 100);
    const valor = centavos(inss + (atividade !== "servico" ? icms.valor : 0) + (atividade !== "comercio" ? iss.valor : 0));
    return { valor, fonte: sm.fonte, fonteData: sm.fonteData };
  }
  return atividade === "servico" ? p.das : null;
}

/** O valor que ela digitou da guia dela ("Usar o valor da minha guia"), com o dia em que digitou. */
export type GuiaDigitada = { valor: number; em: string };

/** A guia que o app usa em todo lugar, e de onde veio o número. */
export type ValorDaGuia = { valor: number; origem: "paga" | "digitada" | "estimada" };

/**
 * A fonte única do valor da guia (Resumo, Impostos, a conta "Guia do MEI" das Recorrentes, o custo
 * do mês). O valor digitado ganha da estimativa; a guia paga mais recente ganha do digitado ANTIGO
 * (digitado antes do dia em que ela pagou); sem nenhum dos dois, a estimativa pela atividade.
 */
export function valorDaGuia(e: {
  legal: ParametrosDoMei;
  atividade: AtividadeDoMei;
  digitada: GuiaDigitada | null;
  /** A guia paga mais recente: o valor e o dia ("AAAA-MM-DD"). */
  ultimaPaga: { valor: number; dia: string } | null;
}): ValorDaGuia | null {
  const { digitada, ultimaPaga } = e;
  if (digitada && (!ultimaPaga || ultimaPaga.dia.slice(0, 10) <= digitada.em.slice(0, 10))) return { valor: digitada.valor, origem: "digitada" };
  if (ultimaPaga) return { valor: ultimaPaga.valor, origem: "paga" };
  const estimado = dasEstimado(e.legal, e.atividade);
  return estimado ? { valor: estimado.valor, origem: "estimada" } : null;
}

/** O dia de uma guia paga: o do lançamento, ou o primeiro do mês quando não tem dia. */
export function diaDaGuiaPaga(l: { entryDate: string | null; year: number; month: number }): string {
  return l.entryDate ?? `${l.year}-${String(l.month).padStart(2, "0")}-01`;
}

/** "estimado pelo app", "da sua guia", "da última guia paga": o rótulo pequeno embaixo do valor. */
export function origemDaGuia(g: ValorDaGuia): string {
  return g.origem === "estimada" ? "estimado pelo app" : g.origem === "digitada" ? "da sua guia" : "da última guia paga";
}

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

const NOME_NA_FRASE: Record<AtividadeDoMei, string> = { servico: "de serviço", comercio: "de comércio ou indústria", comercio_servico: "de comércio e serviço" };

/** O "?" da guia: a estimativa pela atividade, o dia, a fonte, e qual valor o app usa. */
export function textoDaGuia(p: ParametrosDoMei, atividade: AtividadeDoMei, usada: ValorDaGuia | null): string | null {
  const estimado = dasEstimado(p, atividade);
  if (!estimado || !p.diaDoDas) return null;
  const base = `Pela tabela, a guia do MEI ${NOME_NA_FRASE[atividade]} é ${reais(estimado.valor)} e vence todo dia ${p.diaDoDas.valor}. Fonte: ${estimado.fonte}, ${dataBr(estimado.fonteData)}.`;
  if (!usada || usada.origem === "estimada" || Math.abs(usada.valor - estimado.valor) <= 0.009) return base;
  return `${base} O app usa ${reais(usada.valor)}, ${usada.origem === "digitada" ? "o valor da sua guia" : "o da última guia paga"}.`;
}

/**
 * Quais telas legais da Empresa têm o que mostrar (12/10/2026, pedido da dona: nada de "em breve"
 * no menu). O Limite precisa do teto e da faixa extra; Impostos, da guia do MEI (valor e dia).
 * Fora do MEI, nenhuma das duas.
 */
export type FerramentasDoMei = { limite: boolean; impostos: boolean };

export function ferramentasDoMei(tipo: string | null | undefined, p: ParametrosDoMei): FerramentasDoMei {
  const mei = tipo === "MEI";
  const temGuia = !!p.das || !!(p.salarioMinimo && p.inssPercentual && p.icms && p.iss);
  return { limite: mei && !!p.teto && !!p.tolerancia, impostos: mei && temGuia && !!p.diaDoDas };
}
