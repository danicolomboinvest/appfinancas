import type { ParsedTransaction } from "./statement-parser";

/**
 * "Meus Dados" do Safra: o banco exporta um JSON e a cliente o converte em PDF, então o texto do
 * PDF é o JSON inteiro, com marcadores de página ("-- 3 of 9 --") no meio:
 *
 *   "lancamentos": [ { "data": "30-09-2026", "descricao": "PIX RECEBIDO — FULANA",
 *                      "tipo": "crédito", "valor": 16.4 }, ... ]
 *
 * "tipo" diz o sinal (crédito entra, débito sai); "disponivel" é o saldo do dia, não lançamento.
 * O leitor genérico via 16 linhas com valor e não lia nenhuma (04/10/2026).
 */

type Lancamento = { data?: unknown; descricao?: unknown; tipo?: unknown; valor?: unknown };

export function isSafraJsonPdf(texto: string): boolean {
  return /Meus Dados/i.test(texto) && /"lancamentos"\s*:/.test(texto) && /"tipo"\s*:/.test(texto);
}

function paraLancamentos(texto: string): Lancamento[] {
  const limpo = texto.replace(/^\s*--\s*\d+ of \d+\s*--\s*$/gm, "");
  const inicio = limpo.indexOf("{");
  try {
    const json = JSON.parse(limpo.slice(inicio)) as { extratos?: Record<string, { lancamentos?: Lancamento[] }> };
    return Object.values(json.extratos ?? {}).flatMap((e) => e?.lancamentos ?? []);
  } catch {
    // JSON quebrado (página perdida): lê objeto por objeto, o que der.
    const objetos = limpo.match(/\{[^{}]*\}/g) ?? [];
    return objetos.flatMap((o) => {
      try {
        return [JSON.parse(o) as Lancamento];
      } catch {
        return [];
      }
    });
  }
}

export function parseSafraJsonPdf(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const l of paraLancamentos(texto)) {
    const data = String(l.data ?? "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
    const tipo = String(l.tipo ?? "").toLowerCase();
    const valor = typeof l.valor === "number" ? Math.abs(l.valor) : NaN;
    if (!data || Number.isNaN(valor) || valor === 0) continue;
    const sinal = tipo.startsWith("cr") ? 1 : tipo.startsWith("d") && tipo !== "disponivel" ? -1 : 0;
    if (sinal === 0) continue;
    out.push({ date: `${data[3]}-${data[2]}-${data[1]}`, description: String(l.descricao ?? "").trim() || "Lançamento", amount: sinal * valor });
  }
  return out;
}
