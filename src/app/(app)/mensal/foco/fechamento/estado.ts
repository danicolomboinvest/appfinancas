/**
 * Os estados do fechamento de um mês (rodada 42): não fechado, fechando (os passos, na tela),
 * fechado (com a data) e reaberto. Mora numa Decisao por mês e perfil: "fechamento" quando
 * fechou, "fechamento_reaberto" quando reabriu. As duas nunca convivem: fechar apaga a de
 * reabrir e reabrir apaga a de fechar (ver registrarDecisaoUnica).
 *
 * Nenhum texto do fluxo de FECHAR fala "aberto"; "Setembro aberto" só aparece no reaberto.
 */
export type EstadoDoFechamento = "nao_fechado" | "fechado" | "reaberto";

export function estadoDoFechamento(decisoes: { tipo: string; createdAt: Date }[]): { estado: EstadoDoFechamento; em: Date | null } {
  const ultima = [...decisoes].filter((d) => d.tipo === "fechamento" || d.tipo === "fechamento_reaberto").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!ultima) return { estado: "nao_fechado", em: null };
  return { estado: ultima.tipo === "fechamento" ? "fechado" : "reaberto", em: ultima.createdAt };
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** As frases de cada estado, para o Resumo e para a tela do fechamento. */
export function textosDoFechamento(estado: EstadoDoFechamento, mes: number, em: Date | null) {
  const nome = MESES[mes - 1];
  const Nome = nome.charAt(0).toUpperCase() + nome.slice(1);
  const data = em ? em.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
  if (estado === "fechado") return { titulo: `${Nome} fechado`, linha: `${Nome} fechado. Ver resumo`, detalhe: data ? `Fechado em ${data}.` : "", botao: `Reabrir ${nome}` };
  if (estado === "reaberto") return { titulo: `${Nome} aberto`, linha: `Fechar ${nome}`, detalhe: "Você reabriu este mês. Pode fechar de novo quando quiser.", botao: `Fechar ${nome}` };
  return { titulo: `Fechar ${nome}`, linha: `Fechar ${nome}`, detalhe: "", botao: "Começar" };
}
