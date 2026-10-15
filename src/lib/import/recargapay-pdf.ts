import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta RecargaPay em PDF.
 *
 * Cada movimento abre com o número da ordem ("#1801609143"); a data só aparece no primeiro
 * movimento do dia, e o valor (com o sinal) fica no FIM da linha. Quando o movimento tem detalhe
 * (para quem foi o Pix), o valor desce para uma linha própria, "Pagamento com a carteira":
 *
 *   Data ID da Ordem Movimentações Valor
 *   08/10/2026 #1801609143 Recebido - Pix com chave + R$ 70,00     ← data, ordem e valor juntos
 *   De Fulana de Tal
 *   #1801052801 Rendimento CDI + R$ 0,03                            ← mesmo dia, sem data
 *   07/10/2026 #1799781931 Enviado - Pix com chave                  ← abre o movimento…
 *   Para Loja Exemplo
 *   Pagamento com a carteira - R$ 35,00                             ← …e o valor vem aqui
 *
 * Os nomes de banco do outro lado ("BANCO INTER", "MERCADO PAGO IP LTDA.") faziam o arquivo passar
 * por extrato do Inter, e o leitor genérico, que procura data no começo de cada linha, lia só 43
 * de 116 movimentos. O topo traz "Entradas" e "Saídas", que a conferência usa.
 *
 * Fica de fora o que o próprio resumo do extrato não conta no saldo da carteira (conferido no
 * centavo com dois extratos reais, de 3 e de 12 meses):
 * - "Rendimento CDI" e "Recebimento de cashback": caem fora do saldo da carteira;
 * - a ordem paga com cartão ("Adição de saldo na carteira com cartão + R$ 20" e logo depois
 *   "Pagamento com a carteira - R$ 20"): o dinheiro entra e sai no mesmo instante, e o gasto de
 *   verdade vem na fatura do cartão. Contar aqui também o lançaria duas vezes.
 */

const FORA_DO_SALDO_RE = /^(rendimento cdi|recebimento de cashback)\b/i;
const SALDO_COM_CARTAO_RE = /^adi[çc][ãa]o de saldo na carteira com cart[ãa]o\b/i;

const ORDEM_RE = /^(?:(\d{2})\/(\d{2})\/(\d{4})\s+)?#\d{5,}\s+(.*)$/;
const VALOR_NO_FIM_RE = /^(.*?)\s*([+-])\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const CONTRAPARTE_RE = /^(?:Para|De)\s+(.+)$/;

export function isRecargaPayStatement(texto: string): boolean {
  return /recargapay/i.test(texto) && /Detalhes dos movimentos/i.test(texto) && /#\d{5,}/.test(texto);
}

export function parseRecargaPayStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim());
  const inicio = linhas.findIndex((l) => /^Detalhes dos movimentos/i.test(l));
  if (inicio === -1) return out;

  let data: string | null = null;
  /** O movimento aberto: o nome da ordem e, se vier, quem está do outro lado. */
  let aberto: { nome: string; contraparte: string | null; pagoNoCartao: boolean } | null = null;

  for (const linha of linhas.slice(inicio + 1)) {
    const ordem = linha.match(ORDEM_RE);
    if (ordem) {
      if (ordem[1]) data = `${ordem[3]}-${ordem[2]}-${ordem[1]}`;
      const comValor = ordem[4].match(VALOR_NO_FIM_RE);
      if (comValor) {
        aberto = null;
        if (!FORA_DO_SALDO_RE.test(comValor[1].trim())) lancar(comValor[1], comValor[2], comValor[3]);
      } else aberto = { nome: ordem[4].trim(), contraparte: null, pagoNoCartao: false };
      continue;
    }
    if (!aberto) continue;
    const contraparte = linha.match(CONTRAPARTE_RE);
    if (contraparte && !aberto.contraparte) {
      aberto.contraparte = contraparte[1].trim();
      continue;
    }
    const valor = linha.match(VALOR_NO_FIM_RE);
    if (!valor) continue;
    if (SALDO_COM_CARTAO_RE.test(valor[1].trim())) aberto.pagoNoCartao = true;
    if (aberto.pagoNoCartao) continue;
    // "Pagamento com a carteira" é só o meio de pagamento: o nome é o da ordem. Outra redação na
    // linha do valor entra junto, para a pessoa reconhecer o que foi.
    const comoPagou = /^pagamento com a carteira$/i.test(valor[1].trim());
    const nome = [aberto.nome, comoPagou ? null : valor[1].trim(), aberto.contraparte].filter(Boolean).join(" · ");
    lancar(nome, valor[2], valor[3]);
  }
  return out;

  function lancar(descricao: string, sinal: string, numero: string) {
    const magnitude = parseBrazilianNumber(numero);
    if (!data || Number.isNaN(magnitude) || magnitude === 0) return;
    out.push({ date: data, description: descricao.trim() || "Movimento RecargaPay", amount: sinal === "-" ? -magnitude : magnitude });
  }
}
