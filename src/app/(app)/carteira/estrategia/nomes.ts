import type { StrategyAssetClass } from "@prisma/client";

/** Os nomes curtos das linhas da Estratégia, como no protótipo. */
export const NOME_DA_LINHA: Record<StrategyAssetClass, string> = {
  RENDA_FIXA_POS_FIXADA: "Renda fixa pós",
  RENDA_FIXA_IPCA: "IPCA+",
  PREFIXADO: "Prefixado",
  ACOES_BRASIL: "Ações Brasil",
  FIIS: "FIIs",
  EXTERIOR: "Exterior",
  OUTROS: "Multimercado e outros",
};

export const ORDEM_DAS_LINHAS: StrategyAssetClass[] = ["RENDA_FIXA_POS_FIXADA", "RENDA_FIXA_IPCA", "PREFIXADO", "ACOES_BRASIL", "FIIS", "EXTERIOR", "OUTROS"];

/** Na voz da Dani, falando com uma mulher: "Moderada". */
export const NOME_DO_PERFIL: Record<string, string> = {
  conservador: "Conservadora",
  moderado: "Moderada",
  arrojado: "Arrojada",
  personalizado: "Personalizada",
};
