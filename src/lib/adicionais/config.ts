/**
 * Adicionais pagos à parte (11/10/2026). Decisão da Dani: o plano sobe para R$ 97 por ano e dois
 * pedaços passam a ser vendidos separados.
 * - Perfil Empresa, por R$ 37 por ano: abre a criação do perfil Empresa (DRE, caixa, ponto de
 *   equilíbrio).
 * - Conta do parceiro, por R$ 27 por ano: a outra pessoa do casal ganha o próprio login e vê SÓ o
 *   perfil Casal. O perfil Casal com um login só continua grátis.
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
  /** Id da assinatura em App Store Connect (grupo próprio, para valer junto com a do app). */
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
    hubla: null,
  },
  conta_parceiro: {
    nome: "Conta do parceiro",
    frase: "Vocês dois no mesmo perfil Casal, cada um com o seu login.",
    precoAno: 27,
    apple: "com.danicolombo.spifinance.casal.anual",
    hubla: null,
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
