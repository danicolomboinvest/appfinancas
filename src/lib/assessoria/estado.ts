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
