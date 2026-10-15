/**
 * A assessoria dentro da Carteira (rodadas 59, 61, 68 e 76; seções 9 e 15 do plano):
 *
 * - "Abrir minha conta" só abre o link da EQI numa aba nova. NÃO muda nada no app: tocar não
 *   quer dizer que ela terminou a abertura.
 * - "Já abri minha conta" leva a "Estamos conferindo sua conta". "Ainda não abri" desfaz.
 * - Quem confirma de verdade é a equipe da Fatos Capital (passo futuro, fora do app por ora).
 * - Sem remuneração, sem custo, sem prazo e nunca "escritório da Dani": é a Fatos Capital.
 */
export type EstadoDaAssessoria = "nao_cliente" | "confirmando" | "cliente";

export function estadoDaAssessoria(valor: string | null | undefined): EstadoDaAssessoria {
  return valor === "confirmando" || valor === "cliente" ? valor : "nao_cliente";
}

/** O que o botão secundário faz: "Já abri" vai para confirmando; "Ainda não abri" volta. */
export function proximoEstado(atual: EstadoDaAssessoria, acao: "ja_abri" | "ainda_nao"): EstadoDaAssessoria {
  if (atual === "cliente") return "cliente"; // confirmada pela equipe: o app não desfaz sozinho
  return acao === "ja_abri" ? "confirmando" : "nao_cliente";
}

/** Os textos da linha do fim da Carteira, por estado. Nenhum promete prazo, custo ou conversa. */
export const TEXTOS_DA_ASSESSORIA = {
  nao_cliente: { titulo: "Abra sua conta na Fatos Capital", apoio: "Libera as Oportunidades", botao: "Abrir minha conta", secundario: "Já abri minha conta" },
  confirmando: { titulo: "Estamos conferindo sua conta", apoio: "Na EQI, pela Fatos Capital", botao: null, secundario: "Ainda não abri" },
  cliente: { titulo: "Sua conta está confirmada", apoio: "Na EQI, pela Fatos Capital", botao: null, secundario: null },
} as const;

/**
 * O que a equipe marca no Admin › Assessoria (15/10/2026), depois que o assessor confere na EQI:
 * "Confirmada" libera (cliente); "Não achou a conta" volta ao começo; "Desfazer" devolve uma
 * confirmada para a fila. Só sai de "confirmando" (ou volta para ele): nunca mexe em quem não pediu.
 */
export type DecisaoDaEquipe = "confirmar" | "nao_achou" | "desfazer";

export function estadoDepoisDaEquipe(atual: EstadoDaAssessoria, decisao: DecisaoDaEquipe): EstadoDaAssessoria | null {
  if (decisao === "desfazer") return atual === "cliente" ? "confirmando" : null;
  if (atual !== "confirmando") return null;
  return decisao === "confirmar" ? "cliente" : "nao_cliente";
}
