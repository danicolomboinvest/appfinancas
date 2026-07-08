"use server";

import { getRequiredSession } from "@/lib/auth/session";
import {
  extractPdfText,
  extractCriteriaValues,
  type DocumentSlot,
  type ExtractionCriterion,
  type ExtractedCriterionValue,
} from "@/lib/analysis/document-extraction";

/**
 * Extrai valores de critérios a partir de um PDF enviado pelo usuário — não persiste nada,
 * só devolve as sugestões pro cliente aplicar no formulário (o "Salvar ficha" continua sendo
 * a única ação que grava no banco).
 */
export async function extractDocumentAction(
  _slot: DocumentSlot,
  criteria: ExtractionCriterion[],
  formData: FormData,
): Promise<{ error?: string; results?: ExtractedCriterionValue[] }> {
  await getRequiredSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo PDF." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Só arquivos PDF são aceitos por enquanto." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer);
    if (text.trim().length === 0) {
      return { error: "Não consegui ler texto neste PDF (pode ser um documento escaneado/imagem)." };
    }
    const results = await extractCriteriaValues(text, criteria);
    return { results };
  } catch {
    return { error: "Não consegui processar esse documento. Tente novamente ou use outro arquivo." };
  }
}
