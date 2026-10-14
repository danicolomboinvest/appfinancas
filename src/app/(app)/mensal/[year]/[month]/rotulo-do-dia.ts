const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const MESES_DO_ANO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "Hoje, quarta 7", "Ontem, terça 6", "Segunda 5" (o dia em "YYYY-MM-DD", hoje idem). Dia de outro
 * mês (a compra de 29/09 que caiu na fatura de outubro) leva o nome do mês: "Terça 29 de setembro",
 * senão a lista de outubro mostrava um "Terça 29" que parecia o fim do mês.
 */
export function rotuloDoDia(dia: string, hoje: string, mesDaLista?: string): string {
  if (dia === "sem-data") return "Sem data";
  const d = new Date(`${dia}T12:00:00Z`);
  const semana = DIAS_DA_SEMANA[d.getUTCDay()];
  if (mesDaLista && dia.slice(0, 7) !== mesDaLista) {
    const nome = `${semana.charAt(0).toUpperCase() + semana.slice(1)} ${d.getUTCDate()} de ${MESES_DO_ANO[d.getUTCMonth()]}`;
    return d.getUTCFullYear() === Number(mesDaLista.slice(0, 4)) ? nome : `${nome} de ${d.getUTCFullYear()}`;
  }
  const ontem = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10);
  if (dia === hoje) return `Hoje, ${semana} ${d.getUTCDate()}`;
  if (dia === ontem) return `Ontem, ${semana} ${d.getUTCDate()}`;
  if (dia > hoje) return `${semana.charAt(0).toUpperCase() + semana.slice(1)} ${d.getUTCDate()}, a vencer`;
  return `${semana.charAt(0).toUpperCase() + semana.slice(1)} ${d.getUTCDate()}`;
}
