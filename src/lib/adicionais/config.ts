/**
 * Adicionais pagos à parte (11/10/2026). Decisão da Dani: o plano sobe para R$ 97 por ano e dois
 * pedaços passam a ser vendidos separados.
 * - Perfil Empresa, por R$ 37 por ano: abre a criação do perfil Empresa (DRE, caixa, ponto de
 *   equilíbrio).
 * - Conta do parceiro, por R$ 27 por ano: é o "Nós dois" inteiro. Abre o perfil Casal e a outra
 *   pessoa do casal ganha o próprio login, que vê SÓ o perfil Casal (na junção com a versão nova,
 *   11/10/2026, o perfil Casal deixou de ser grátis: ver lib/perfis/extras-liberados.ts).
 *
 * Tudo começa desligado. A cobrança liga no dia do lançamento pela variável
 * ADICIONAIS_COBRAR_DESDE (uma data, ex. "2026-11-03"). Sem ela, ou antes dela, ninguém é
 * cobrado. Quem já era cliente antes dessa data fica com tudo, porque comprou com "pessoal, casal
 * e empresa" incluídos (ver acesso.ts).
 */

import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";

export type Adicional = "perfil_empresa" | "conta_parceiro";

export type DadosDoAdicional = {
  nome: string;
  /** Uma linha: o que ela ganha. */
  frase: string;
  /** Preço anual em reais, o mesmo na Hubla. Na Apple a tela mostra o preço que a loja mandar. */
  precoAno: number;
  /**
   * Id da assinatura em App Store Connect, num grupo próprio para valer junto com a do app.
   * Na Apple o preço é maior, para cobrir a comissão dela (como o app: R$ 87,90 lá e R$ 67 na
   * Hubla): Empresa R$ 47,90 e Conta do parceiro R$ 39,90, decisão da Dani em 11/10/2026.
   */
  apple: string;
  /** Checkout da oferta avulsa na Hubla (quem já é cliente compra só o adicional). */
  hubla: string | null;
};

export const ADICIONAIS: Record<Adicional, DadosDoAdicional> = {
  perfil_empresa: {
    nome: "Perfil Empresa",
    frase: "O dinheiro da empresa separado do seu, com DRE, caixa e ponto de equilíbrio.",
    precoAno: 37,
    apple: "com.danicolombo.spifinance.empresa.anual",
    // Produto "SPI Finance Perfil Empresa" na Hubla (criado em 11/10/2026, em rascunho até o lançamento).
    hubla: "https://pay.hub.la/N7FPjwnnNhgaPZyqmQDF",
  },
  conta_parceiro: {
    nome: "Conta do parceiro",
    frase: "O perfil Casal para vocês dois, cada um com o seu login.",
    precoAno: 27,
    apple: "com.danicolombo.spifinance.casal.anual",
    // Produto "SPI Finance Conta do parceiro" na Hubla (criado em 11/10/2026, em rascunho até o lançamento).
    hubla: "https://pay.hub.la/nFN5de8EstNY7v6r1gma",
  },
};

/**
 * O preço como a tela mostra. A Hubla cobra em real, então é sempre real, mesmo para quem usa o
 * app em outra moeda (no iPhone, vale o preço que a Apple mandar).
 */
export function precoDoAdicional(adicional: Adicional): string {
  return formatMoney(ADICIONAIS[adicional].precoAno, DEFAULT_CURRENCY, { round: true });
}

export const LISTA_DE_ADICIONAIS = Object.keys(ADICIONAIS) as Adicional[];

export function ehAdicional(x: unknown): x is Adicional {
  return typeof x === "string" && (LISTA_DE_ADICIONAIS as string[]).includes(x);
}

/** As assinaturas dos adicionais na Apple. */
export const IDS_APPLE_ADICIONAIS: readonly string[] = LISTA_DE_ADICIONAIS.map((a) => ADICIONAIS[a].apple);

/** Qual adicional uma assinatura da Apple libera; null se for o app ou outra coisa. */
export function adicionalDoProdutoApple(productId: string | null | undefined): Adicional | null {
  return LISTA_DE_ADICIONAIS.find((a) => ADICIONAIS[a].apple === productId) ?? null;
}

/**
 * O dia em que a cobrança começa, lido de ADICIONAIS_COBRAR_DESDE. Data inválida conta como
 * desligada: errar a favor de quem usa é melhor do que travar o perfil de todo mundo por um erro
 * de digitação na Vercel.
 */
export function inicioDaCobranca(valor: string | undefined = process.env.ADICIONAIS_COBRAR_DESDE): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}/.test(valor.trim())) return null;
  // Meia-noite de Brasília do dia escrito.
  const d = new Date(`${valor.trim().slice(0, 10)}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
