import type { ParentCategory } from "@prisma/client";
import { classifyDictionaryOnly } from "@/lib/import/classify";

/** O nome da conta diz a categoria quando o dicionário não sabe ("Luz", "Água", "Diarista"). */
const PELO_NOME: [RegExp, ParentCategory, string | null][] = [
  [/\bluz\b|energia|eletricidade/i, "MORADIA", "Luz"],
  [/\bagua\b|\bágua\b|saneamento|esgoto/i, "MORADIA", "Água"],
  [/\bgas\b|\bgás\b/i, "MORADIA", "Gás"],
  [/condom/i, "MORADIA", "Condomínio"],
  [/aluguel/i, "MORADIA", "Aluguel"],
  [/internet|fibra|wi-?fi|celular|telefone/i, "MORADIA", "Internet"],
  [/diarista|faxina|empregada|bab[aá]/i, "MORADIA", null],
  [/\biptu\b/i, "IMPOSTOS", "IPTU"],
  [/\bdas\b|guia do mei|simples nacional/i, "IMPOSTOS", "DAS (Simples Nacional)"],
];

export type CategoriaDoPaguei = { parentCategory: ParentCategory | null; customCategoryId: string | null; subcategory: string | null };

/**
 * A categoria do gasto do "Paguei", nesta ordem:
 * 1. a do último gasto desta conta (se ela trocou a categoria depois, o próximo já vem certo);
 * 2. a da própria conta (as achadas no extrato guardam a categoria de onde vieram);
 * 3. o nome da conta (Luz, Água, Guia do MEI) e o dicionário do app (Aluguel, Netflix);
 * 4. Outros: nunca sem categoria, para o gasto não sumir do orçamento.
 */
export function categoriaDoPaguei(e: {
  nome: string;
  categoria: ParentCategory | null;
  ultima?: CategoriaDoPaguei | null;
  profileKind?: string | null;
}): CategoriaDoPaguei {
  if (e.ultima && (e.ultima.parentCategory || e.ultima.customCategoryId)) return e.ultima;
  const pelo = PELO_NOME.find(([r]) => r.test(e.nome));
  if (e.categoria) return { parentCategory: e.categoria, customCategoryId: null, subcategory: pelo && pelo[1] === e.categoria ? pelo[2] : null };
  if (pelo) return { parentCategory: pelo[1], customCategoryId: null, subcategory: pelo[2] };
  const dic = classifyDictionaryOnly(e.nome, e.profileKind ?? undefined);
  if (dic) return { parentCategory: dic.parentCategory, customCategoryId: null, subcategory: dic.subcategory ?? null };
  return { parentCategory: "OUTROS", customCategoryId: null, subcategory: null };
}
