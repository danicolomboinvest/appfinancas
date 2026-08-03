/**
 * Normaliza a rota antes de gravar o evento de uso: ids e datas viram marcadores
 * ("/mensal/2026/8" → "/mensal/[ano]/[mes]", "/fichas/acoes/cm123..." → "/fichas/acoes/[id]").
 * Duas razões: agregar direito no relatório (senão cada mês/ficha seria uma "página" diferente)
 * e nunca persistir identificadores na tabela de rastreio.
 */

const KNOWN_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /^\/mensal\/\d{4}\/\d{1,2}$/, replacement: "/mensal/[ano]/[mes]" },
  { pattern: /^\/mensal\/\d{4}$/, replacement: "/mensal/[ano]" },
  { pattern: /^\/orcamento\/\d{4}$/, replacement: "/orcamento/[ano]" },
  { pattern: /^\/orcamento\/comparativo\/\d{4}$/, replacement: "/orcamento/comparativo/[ano]" },
  { pattern: /^\/fichas\/(acoes|fiis|stocks|etfs)\/[^/]+$/, replacement: "/fichas/$1/[id]" },
  { pattern: /^\/planejamento\/metas\/[^/]+$/, replacement: "/planejamento/metas/[id]" },
];

/** Segmento que parece um identificador (cuid/uuid/número longo), não um nome de rota. */
const ID_LIKE = /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f-]{27,}|\d{4,})$/i;

export function normalizeUsagePath(rawPath: string): string {
  // Sem query string nem hash; barra final fora (exceto a raiz).
  const path = rawPath.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

  for (const { pattern, replacement } of KNOWN_PATTERNS) {
    if (pattern.test(path)) return path.replace(pattern, replacement);
  }

  // Rota nova que ainda não está no mapa: troca só os segmentos que parecem id.
  const cleaned = path
    .split("/")
    .map((segment) => (ID_LIKE.test(segment) ? "[id]" : segment))
    .join("/");
  // Limite de tamanho: rota gigante/estranha não vira lixo no banco.
  return cleaned.slice(0, 120);
}
