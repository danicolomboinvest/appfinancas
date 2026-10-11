import type { AssetClass, FixedIncomeIndex, StrategyAssetClass } from "@prisma/client";

/**
 * A classificação de cada ativo na Carteira da versão nova (rodada 23, adendo da Dani).
 *
 * O app classifica sozinho (pela classe do cadastro, pelo indexador e pela moeda), e ela pode
 * trocar no detalhe do ativo: o TIPO (renda fixa pós, IPCA+, prefixado, ações, FIIs, multimercado,
 * outros) e ONDE está (Brasil ou Exterior). A escolha dela manda em todo lugar: no "Por tipo", na
 * Estratégia e no total Brasil × Exterior. "Voltar ao automático" apaga a escolha.
 *
 * Exterior conta tudo que está fora do Brasil, inclusive renda fixa lá fora.
 */

export const TIPOS = ["pos", "ipca", "pre", "acoes", "fiis", "multimercado", "outros"] as const;
export type Tipo = (typeof TIPOS)[number];
export const ONDES = ["brasil", "exterior"] as const;
export type Onde = (typeof ONDES)[number];

export const NOME_DO_TIPO: Record<Tipo, string> = {
  pos: "Renda fixa pós",
  ipca: "IPCA+",
  pre: "Prefixado",
  acoes: "Ações",
  fiis: "FIIs",
  multimercado: "Multimercado",
  outros: "Outros",
};

export function ehTipo(v: unknown): v is Tipo {
  return typeof v === "string" && (TIPOS as readonly string[]).includes(v);
}
export function ehOnde(v: unknown): v is Onde {
  return typeof v === "string" && (ONDES as readonly string[]).includes(v);
}

export type AtivoParaClassificar = {
  assetClass: AssetClass;
  fixedIncomeIndex: FixedIncomeIndex | null;
  currency?: string | null;
  tipoEscolhido?: string | null;
  ondeEscolhido?: string | null;
};

/** O tipo que o app daria sozinho. Fundo sem a classe oficial fica em "Outros" até ela dizer. */
export function tipoAutomatico(a: Pick<AtivoParaClassificar, "assetClass" | "fixedIncomeIndex">): Tipo {
  switch (a.assetClass) {
    case "RENDA_FIXA":
    case "TESOURO_DIRETO":
      return a.fixedIncomeIndex === "IPCA" ? "ipca" : a.fixedIncomeIndex === "PREFIXADO" ? "pre" : "pos";
    case "ACAO":
      return "acoes";
    case "FII":
      return "fiis";
    // ETF/stock lá fora: é renda variável. O "onde" é que leva para o Exterior.
    case "INTERNACIONAL":
      return "acoes";
    default:
      return "outros";
  }
}

/** Onde o app diria que o ativo está: em outra moeda, ou da classe Internacional, é Exterior. */
export function ondeAutomatico(a: Pick<AtivoParaClassificar, "assetClass" | "currency">): Onde {
  if (a.currency && a.currency !== "BRL") return "exterior";
  return a.assetClass === "INTERNACIONAL" ? "exterior" : "brasil";
}

export type Classificacao = { tipo: Tipo; onde: Onde; escolhida: boolean };

export function classificar(a: AtivoParaClassificar): Classificacao {
  const tipo = ehTipo(a.tipoEscolhido) ? a.tipoEscolhido : tipoAutomatico(a);
  const onde = ehOnde(a.ondeEscolhido) ? a.ondeEscolhido : ondeAutomatico(a);
  return { tipo, onde, escolhida: ehTipo(a.tipoEscolhido) || ehOnde(a.ondeEscolhido) };
}

/** A linha da Estratégia: tudo que está fora do Brasil é Exterior; multimercado conta em Outros. */
export function classeDaEstrategia(a: AtivoParaClassificar): StrategyAssetClass {
  const { tipo, onde } = classificar(a);
  if (onde === "exterior") return "EXTERIOR";
  const mapa: Record<Tipo, StrategyAssetClass> = {
    pos: "RENDA_FIXA_POS_FIXADA",
    ipca: "RENDA_FIXA_IPCA",
    pre: "PREFIXADO",
    acoes: "ACOES_BRASIL",
    fiis: "FIIS",
    multimercado: "OUTROS",
    outros: "OUTROS",
  };
  return mapa[tipo];
}

/** Os grupos do "Por tipo" (a lista da Carteira), na ordem em que a tela mostra. */
export const GRUPOS = ["tesouro", "rendafixa", "fiis", "acoes", "exterior", "fundos", "cripto", "outros"] as const;
export type Grupo = (typeof GRUPOS)[number];

export const NOME_DO_GRUPO: Record<Grupo, string> = {
  tesouro: "Tesouro",
  rendafixa: "Renda fixa",
  fiis: "FIIs",
  acoes: "Ações",
  exterior: "Exterior",
  fundos: "Fundos",
  cripto: "Cripto",
  outros: "Outros",
};

/**
 * Em que grupo do "Por tipo" o ativo aparece. Exterior primeiro (a escolha de "onde" manda);
 * depois o tipo que ela escolheu; sem escolha, a classe do cadastro.
 */
export function grupoDoAtivo(a: AtivoParaClassificar): Grupo {
  const c = classificar(a);
  if (c.onde === "exterior") return "exterior";
  if (ehTipo(a.tipoEscolhido)) {
    if (c.tipo === "acoes") return "acoes";
    if (c.tipo === "fiis") return "fiis";
    if (c.tipo === "multimercado") return "fundos";
    if (c.tipo === "outros") return "outros";
    return a.assetClass === "TESOURO_DIRETO" ? "tesouro" : "rendafixa";
  }
  switch (a.assetClass) {
    case "TESOURO_DIRETO":
      return "tesouro";
    case "RENDA_FIXA":
      return "rendafixa";
    case "FII":
      return "fiis";
    case "ACAO":
      return "acoes";
    case "FUNDO":
      return "fundos";
    case "CRIPTO":
      return "cripto";
    default:
      return "outros";
  }
}
