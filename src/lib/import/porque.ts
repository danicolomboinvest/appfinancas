/**
 * O "porquê" de cada linha separada na revisão da importação (caminho B, 12/10/2026).
 *
 * A tela lê o que o motor de categorização (lib/import/motor.ts) põe em cada linha, `motivo` e
 * `confianca`, e traduz para uma etiqueta curta. `porque` aceita um objeto pronto, e sem nenhum
 * dos dois a função deduz pelos campos que a linha já tem (investimento, resgate, devolução).
 */
export type PorqueDaLinha = {
  /** O rótulo do que o app escolheu ("Alimentação", "Guardei"), quando o motor quiser dizer. */
  categoria: string | null;
  /** Curto, para a etiqueta: "mesmo nome que o seu", "investimento", "devolução", "você já disse antes". */
  motivo: string;
  /** De 0 a 1. Abaixo de 0,6 a linha volta para as perguntas. */
  confianca: number;
};

/** O que o motor (lib/import/motor.ts) devolve por linha: o código do motivo e a confiança. */
const TEXTO_DO_MOTIVO: Record<string, string | null> = {
  regra_sua: "você já disse antes",
  comunidade: "outras pessoas classificam assim",
  ramo_do_banco: "o banco diz o ramo da loja",
  dicionario: "pelo nome do lugar",
  parece_comida: "o nome parece de comida",
  mesmo_nome: "igual à que você respondeu",
  investimento: "investimento",
  devolucao: "devolução",
  pergunta: null,
};

type Linha = {
  porque?: PorqueDaLinha | null;
  motivo?: string;
  confianca?: "alta" | "media" | "baixa";
  category: string;
  parentCategory: string | null;
  customCategoryId: string | null;
  autoClassified: boolean;
  estorno?: boolean;
  resgate?: boolean;
  ignorar?: boolean;
  duvida?: string | null;
  nota?: string | null;
};

export function porqueDaLinha(it: Linha): PorqueDaLinha | null {
  if (it.porque) return it.porque;
  if (it.duvida) return null; // ainda é pergunta
  // O motor de verdade (12/10/2026): motivo e confiança por linha.
  if (it.motivo && it.motivo in TEXTO_DO_MOTIVO) {
    const texto = TEXTO_DO_MOTIVO[it.motivo];
    if (texto === null) return null;
    // Média (o nome parece de comida): passa da linha de corte (0,6), entra separada, com o porquê.
    return { categoria: null, motivo: texto, confianca: it.confianca === "baixa" ? 0.4 : it.confianca === "media" ? 0.7 : 0.9 };
  }
  if (it.resgate) return { categoria: null, motivo: "resgate do que você guardou", confianca: 0.9 };
  if (it.category === "INVESTMENT_CONTRIBUTION") return { categoria: null, motivo: "investimento", confianca: 0.9 };
  if (it.estorno) return { categoria: null, motivo: "devolução", confianca: 0.9 };
  if (it.ignorar && it.nota && /mudando de lugar|conta/i.test(it.nota)) return { categoria: null, motivo: "mesmo nome que o seu", confianca: 0.9 };
  if (it.ignorar && it.nota && /fatura/i.test(it.nota)) return { categoria: null, motivo: "pagamento da fatura", confianca: 0.9 };
  if (it.category === "INCOME") return { categoria: null, motivo: "entrada", confianca: 0.8 };
  if (it.autoClassified && (it.parentCategory || it.customCategoryId)) return { categoria: null, motivo: "pelo nome do lugar", confianca: 0.7 };
  return null;
}

/** Separada = o app tem um porquê e confiança suficiente; o resto vira pergunta. */
export function foiSeparada(it: Linha): boolean {
  const p = porqueDaLinha(it);
  return p !== null && p.confianca >= 0.6;
}
