import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

export type DocumentSlot = "ESTATUTO_SOCIAL" | "RELATORIO_GERENCIAL" | "OUTRO";

/**
 * Critérios-alvo de cada slot de upload, com base no `helpText` já catalogado em
 * prisma/criteria-catalog.ts sobre onde cada critério normalmente é encontrado.
 * "OUTRO" não tem lista fixa — o chamador passa os critérios ainda vazios da ficha.
 */
export const SLOT_CRITERION_KEYS: Record<Exclude<DocumentSlot, "OUTRO">, string[]> = {
  ESTATUTO_SOCIAL: ["tag_along", "socios_majoritarios"],
  RELATORIO_GERENCIAL: [
    "divida_liquida_patrimonio",
    "divida_liquida_ebitda",
    "evolucao_receita",
    "evolucao_lucro",
    "evolucao_fluxo_caixa",
    "margem_liquida",
    "roe",
    "roic",
    "payout",
    "dividend_yield",
  ],
};

export type ExtractionCriterion = { key: string; label: string; helpText: string | null };
export type ExtractedCriterionValue = { key: string; value: string | null };

/** Um critério de ficha com o `id` do banco junto — precisa dos dois pra casar sugestão da IA (por key) com resposta salva (por id). */
export type SheetCriterion = { id: string; key: string; label: string; helpText: string | null };

/**
 * Critérios-alvo de um slot de upload. "OUTRO" é o complemento estático dos outros dois — os
 * critérios qualitativos que tipicamente dependem de pesquisa externa (Glassdoor, Reclame Aqui,
 * notícias), não de um documento financeiro específico.
 */
export function getCriteriaForSlot(slot: DocumentSlot, allCriteria: SheetCriterion[]): SheetCriterion[] {
  if (slot === "OUTRO") {
    const curatedKeys = new Set([...SLOT_CRITERION_KEYS.ESTATUTO_SOCIAL, ...SLOT_CRITERION_KEYS.RELATORIO_GERENCIAL]);
    return allCriteria.filter((c) => !curatedKeys.has(c.key));
  }
  const keys = new Set(SLOT_CRITERION_KEYS[slot]);
  return allCriteria.filter((c) => keys.has(c.key));
}

/** Extrai o texto puro de um PDF (assume PDF gerado digitalmente — sem OCR pra documentos escaneados). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

const SYSTEM_PROMPT = `Você extrai dados financeiros de documentos de empresas de capital aberto para preencher uma ficha de análise de ações. Receberá o texto de um documento e uma lista de critérios. Para cada critério, procure o valor correspondente no texto e retorne-o de forma sucinta (número, percentual ou frase curta, como apareceria no documento). Se um critério não aparecer claramente no texto, retorne null para ele — nunca invente ou estime um valor que não esteja no documento.`;

/**
 * Manda o texto extraído + a lista de critérios-alvo pra IA, usando tool-use com um schema
 * JSON (um campo opcional por critério) pra garantir resposta estruturada. Critério não
 * encontrado no documento volta como null.
 */
export async function extractCriteriaValues(
  text: string,
  criteria: ExtractionCriterion[],
): Promise<ExtractedCriterionValue[]> {
  if (criteria.length === 0) return [];

  const anthropic = new Anthropic();

  const properties: Record<string, { type: "string"; description: string }> = {};
  for (const criterion of criteria) {
    properties[criterion.key] = {
      type: "string",
      description: criterion.helpText
        ? `${criterion.label} — ${criterion.helpText}`
        : criterion.label,
    };
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "record_extraction",
        description: "Registra o valor encontrado (ou null) para cada critério.",
        input_schema: {
          type: "object",
          properties,
          required: criteria.map((c) => c.key),
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_extraction" },
    messages: [
      {
        role: "user",
        content: `Texto do documento:\n\n${text.slice(0, 100_000)}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return criteria.map((c) => ({ key: c.key, value: null }));

  const input = toolUse.input as Record<string, unknown>;
  return criteria.map((c) => {
    const raw = input[c.key];
    const value = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
    return { key: c.key, value };
  });
}
