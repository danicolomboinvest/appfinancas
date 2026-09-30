/**
 * O "Comece por aqui" do Foco: os três primeiros passos, sempre na mesma ordem.
 *
 * A ordem é a da promessa da página de venda ("solta o extrato, o mês se monta sozinho"):
 *   1. trazer os gastos (subir o extrato ou a fatura);
 *   2. ver o mês montado;
 *   3. fazer o orçamento (o "combinado"), que aí já nasce com os gastos dela como sugestão.
 *
 * Antes o guia pedia "registre um gasto", depois orçamento, depois carteira, o tour dizia "+" e
 * o manual dizia orçamento primeiro: três ordens diferentes. E o passo da carteira nunca era
 * feito por quem não investe (o guia ficava em 2 de 3 pra sempre). Agora é uma lista que dá pra
 * terminar, e o tour, o manual e o Foco contam a mesma história.
 *
 * Lógica pura (sem React, sem banco) pra ser testada à parte.
 */

export type PassoDoComece = "importar" | "verMes" | "orcamento";

export const ORDEM_DO_COMECE: PassoDoComece[] = ["importar", "verMes", "orcamento"];

/** Quem lançou algo há mais que isso já viu o mês faz tempo: não faz sentido pedir de novo. */
export const DIAS_PRA_CONSIDERAR_MES_VISTO = 3;
const DIA_MS = 86_400_000;

export type EstadoDoComece = {
  /** Existe algum lançamento neste perfil (importado ou digitado). */
  temLancamento: boolean;
  /** Existe orçamento com valor neste perfil. */
  temOrcamento: boolean;
  /** Ela tocou em "Ver meu mês" neste aparelho. */
  viuMes: boolean;
  /** Quando entrou o primeiro lançamento do perfil (null = nenhum). */
  primeiroLancamentoEm?: Date | null;
  /** Relógio de agora (injetável pro teste). */
  agora?: Date;
};

export type PassosDoComece = {
  passos: { id: PassoDoComece; feito: boolean }[];
  /** O passo da vez: o primeiro que falta, na ordem. null = tudo feito. */
  atual: PassoDoComece | null;
  feitos: number;
  /** Conta sem nenhum lançamento: o Foco mostra só o "Comece por aqui". */
  contaNova: boolean;
};

export function passosDoComece(e: EstadoDoComece): PassosDoComece {
  const agora = e.agora ?? new Date();
  // Quem já usa o app há dias (entrou antes deste guia existir, ou viu o mês por outro caminho
  // ou em outro aparelho) não recebe o "veja seu mês" como se fosse novidade.
  const lancamentoAntigo = e.primeiroLancamentoEm ? agora.getTime() - e.primeiroLancamentoEm.getTime() > DIAS_PRA_CONSIDERAR_MES_VISTO * DIA_MS : false;
  const feito: Record<PassoDoComece, boolean> = {
    importar: e.temLancamento,
    // Ver o mês só existe depois de ter o que ver. E quem já fez o orçamento passou por ele.
    verMes: e.temLancamento && (e.viuMes || e.temOrcamento || lancamentoAntigo),
    orcamento: e.temOrcamento,
  };
  const passos = ORDEM_DO_COMECE.map((id) => ({ id, feito: feito[id] }));
  return {
    passos,
    atual: passos.find((p) => !p.feito)?.id ?? null,
    feitos: passos.filter((p) => p.feito).length,
    contaNova: !e.temLancamento,
  };
}

/**
 * O guia aparece? Some quando os três estão feitos. Dispensar (o X) só vale depois do primeiro
 * lançamento: pra conta nova, o "Comece por aqui" é a tela inteira do Foco, e escondê-lo
 * deixaria a pessoa diante de uma página vazia.
 */
export function mostrarComece(p: PassosDoComece, dispensado: boolean): boolean {
  if (p.atual === null) return false;
  if (p.contaNova) return true;
  return !dispensado;
}

/** A pergunta "toda semana ou uma vez por mês?" só faz sentido depois do primeiro lançamento. */
export function perguntarRitmo(ritmoEscolhido: boolean, temLancamento: boolean): boolean {
  return !ritmoEscolhido && temLancamento;
}
