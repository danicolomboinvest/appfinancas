/**
 * O vencimento impresso na fatura do cartão, pra já deixar escolhido o mês em que ela entra.
 *
 * A pergunta "de qual mês é esta fatura?" começava no mês de HOJE: quem subia em 30/09 a fatura
 * que vence em 10/10 deixava setembro, e as compras de outubro inteiras caíam no mês errado. O
 * que vale é quando a fatura é paga, e o dia do pagamento é o vencimento que o próprio PDF traz.
 *
 * Só procura data logo depois da palavra "vencimento" (ou do "FATURA 14 SET 2026" do topo da
 * fatura do Nubank). Nada de chutar pela data mais comum do arquivo: é uma sugestão que a pessoa
 * vê e pode trocar, e uma sugestão errada é pior que nenhuma.
 */

const MESES_CURTOS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const MESES_LONGOS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// "Vencimento", "Data de vencimento", "Vencimento da fatura", "Vence em" — com dois-pontos, traço
// ou quebra de linha antes da data (o extrator de PDF põe o rótulo e o valor em linhas separadas).
const ROTULO = String.raw`(?:data\s+(?:de|do)\s+)?venc(?:imento|e\s+em)(?:\s+da\s+fatura)?\s*[:\-–]?\s*`;
const NUMERICA = new RegExp(String.raw`${ROTULO}(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)`, "gi");
const MES_CURTO = new RegExp(String.raw`(?:${ROTULO}|\bFATURA\s+)(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+(\d{4})`, "gi");
const MES_LONGO = new RegExp(String.raw`${ROTULO}(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})`, "gi");

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function dataValida(dia: number, mes: number, ano: number): string | null {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || ano < 2000 || ano > 2100) return null;
  // 31/02 não existe: o Date "empurra" pra março, e a comparação pega isso.
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * O vencimento da fatura ("YYYY-MM-DD"), ou null quando o texto não diz. Vale o que aparece
 * PRIMEIRO no arquivo: o vencimento da fatura fica no topo, e datas de vencimento mais pra baixo
 * são de outra coisa (parcelamento da fatura, boleto de outra via).
 */
export function detectarVencimento(texto: string): string | null {
  const t = semAcento(texto);
  const achados: { indice: number; data: string }[] = [];
  const guardar = (indice: number, data: string | null) => {
    if (data) achados.push({ indice, data });
  };
  for (const m of t.matchAll(NUMERICA)) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    guardar(m.index ?? 0, dataValida(Number(m[1]), Number(m[2]), ano));
  }
  for (const m of t.matchAll(MES_CURTO)) {
    guardar(m.index ?? 0, dataValida(Number(m[1]), MESES_CURTOS[m[2].toLowerCase()] ?? 0, Number(m[3])));
  }
  for (const m of t.matchAll(MES_LONGO)) {
    guardar(m.index ?? 0, dataValida(Number(m[1]), MESES_LONGOS[m[2].toLowerCase()] ?? 0, Number(m[3])));
  }
  if (achados.length === 0) return null;
  achados.sort((a, b) => a.indice - b.indice);
  return achados[0].data;
}
