/**
 * Os estados do fechamento de um mês (seção 3.12, rodada 42): não fechado, fechando (os passos,
 * só na tela), fechado (com a data) e reaberto. Mora na tabela FechamentoDoMes, uma linha por
 * perfil e mês; sem linha = não fechado. "Fechado" deixou de ser "qualquer mês passado".
 *
 * Nenhum texto do fluxo de FECHAR fala "aberto"; "Setembro aberto" só aparece no reaberto.
 */
export type EstadoDoFechamento = "nao_fechado" | "fechado" | "reaberto";
export type AcaoDoFechamento = "fechar" | "reabrir";

export type LinhaDoFechamento = { estado: string; fechadoEm: Date | null; reabertoEm: Date | null };

/** O estado de um mês a partir da linha da tabela (ou da falta dela). */
export function estadoDoFechamento(linha: LinhaDoFechamento | null): { estado: EstadoDoFechamento; em: Date | null } {
  if (!linha) return { estado: "nao_fechado", em: null };
  if (linha.estado === "fechado") return { estado: "fechado", em: linha.fechadoEm };
  if (linha.estado === "reaberto") return { estado: "reaberto", em: linha.reabertoEm };
  return { estado: "nao_fechado", em: null };
}

/**
 * As passagens que valem: fechar um mês não fechado ou reaberto; reabrir um fechado. Fechar o que
 * já está fechado não muda a data; reabrir o que nunca fechou não faz nada (null).
 */
export function proximoEstado(atual: EstadoDoFechamento, acao: AcaoDoFechamento): "fechado" | "reaberto" | null {
  if (acao === "fechar") return atual === "fechado" ? null : "fechado";
  return atual === "fechado" ? "reaberto" : null;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "7 de outubro", no calendário de Brasília. */
export function dataPorExtenso(d: Date): string {
  const b = new Date(d.getTime() - 3 * 3_600_000);
  return `${b.getUTCDate()} de ${MESES[b.getUTCMonth()]}`;
}

/** As frases de cada estado, para o Resumo e para a tela do fechamento. */
export function textosDoFechamento(estado: EstadoDoFechamento, mes: number, em: Date | null) {
  const nome = MESES[mes - 1];
  const Nome = nome.charAt(0).toUpperCase() + nome.slice(1);
  const data = em ? dataPorExtenso(em) : "";
  if (estado === "fechado") return { titulo: `${Nome} fechado`, linha: `${Nome} fechado. Ver resumo`, detalhe: data ? `Fechado em ${data}.` : "", botao: `Reabrir ${nome}` };
  if (estado === "reaberto") return { titulo: `${Nome} aberto`, linha: `Fechar ${nome}`, detalhe: "Você reabriu este mês. Pode fechar de novo quando quiser.", botao: `Fechar ${nome}` };
  return { titulo: `Fechar ${nome}`, linha: `Fechar ${nome}`, detalhe: "", botao: "Começar" };
}
