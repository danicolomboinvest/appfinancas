import type { PrintLido, Segmento } from "./print-fatura";

/**
 * Print de NOTIFICAÇÃO de compra no cartão (26/10/2026, cliente mandou a notificação do Nubank:
 * "Compra de R$ 40,08 APROVADA em 99Food *Pastelito pend para o cartão com final 6322"). Não é
 * uma lista de fatura, então `lerPrint` não acha nada; aqui cada notificação vira uma compra.
 *
 * Só crédito: "Compra no débito" sai da conta, não entra na fatura. A data é o dia do envio (a
 * notificação só diz "há 2h"). Funções puras, sem banco e sem OCR.
 */
const SEM_ACENTO = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// "Compra de R$ 40,08 APROVADA em NOME [pend] para o cartão com final 6322" (Nubank).
const NUBANK = /compra\s+de\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s+aprovada\s+em\s+(.+?)(?:\s+pend\w*)?\s+para\s+o\s+cart[aã]o/gi;
// "Compra aprovada: R$ 12,00 em NOME" / "no NOME" (outros bancos), até "cartão", "final" ou o ponto final.
const GENERICO = /compra\s+(?:no\s+cr[eé]dito\s+)?aprovada\W{0,3}\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s+(?:em|no|na)\s+(.+?)(?:\s+pend\w*)?(?=\s+(?:para\s+o\s+)?cart[aã]o|\s+final\b|\.\s|\.$|$)/gi;

function limpaNome(bruto: string): string {
  return bruto.replace(/\*/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function lerNotificacoes(segmentos: Segmento[], envio: string): PrintLido | null {
  const texto = segmentos.map((s) => s.texto).join(" ").replace(/\s+/g, " ");
  // Débito: a compra sai da conta, não do cartão. "crédito" na mesma notificação vale.
  const t = SEM_ACENTO(texto).toLowerCase();
  if (/compra no debito/.test(t) && !/credito/.test(t)) return null;
  const linhas: PrintLido["linhas"] = [];
  const vistos = new Set<string>();
  for (const re of [NUBANK, GENERICO]) {
    re.lastIndex = 0;
    for (const m of texto.matchAll(re)) {
      const valor = Number(m[1].replace(/\./g, "").replace(",", "."));
      const nome = limpaNome(m[2]);
      if (!nome || !(valor > 0) || valor >= 1e7) continue;
      // O mesmo trecho pode casar nos dois padrões.
      const chave = `${valor}|${nome.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      linhas.push({ data: envio, nome, valor, sinal: null, credito: false, parcela: null });
    }
  }
  return linhas.length > 0 ? { linhas, cabecalhoNoFim: null, totalDaFatura: null } : null;
}
