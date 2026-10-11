import { createHash } from "node:crypto";
import type { Limites } from "@/lib/auth/limite-de-envio";

/**
 * Limites do convite do par.
 *
 * Criar e mandar de novo: pela conta da titular, no mesmo esquema do "Esqueci minha senha"
 * (NotificationLog, ver limite-de-envio.ts). Cada link novo mata o anterior, então apertar em
 * sequência só atrapalha; e um laço não pode encher a tabela.
 *
 * Página pública (/par/...): por aparelho de origem. O código tem 256 bits e não dá pra adivinhar;
 * o limite existe pra um robô não usar a página como porta de cadastro e de tentativa de senha.
 */

export const LIMITES_DO_CONVITE: Limites = { intervaloMs: 5 * 1000, porDia: 20 };

/** Na página pública: 30 tentativas a cada 15 minutos por origem (abrir com código errado, criar
 * conta, entrar). Gente de verdade erra a senha umas poucas vezes; isto só pega robô. */
export const LIMITE_DA_PAGINA = { janelaMs: 15 * 60 * 1000, maximo: 30 } as const;

export function cabeMaisUmaTentativa(anteriores: Date[], agora: Date, limite: { janelaMs: number; maximo: number } = LIMITE_DA_PAGINA): boolean {
  const naJanela = anteriores.filter((d) => agora.getTime() - d.getTime() < limite.janelaMs);
  return naJanela.length < limite.maximo;
}

/**
 * A chave da origem: um resumo do IP com o segredo do app. O IP nunca é gravado (LGPD: não
 * precisamos dele, só de saber que é a mesma origem).
 */
export function chaveDaOrigem(ip: string | null | undefined, segredo: string = process.env.AUTH_SECRET || "spi-local"): string {
  const limpo = (ip ?? "").split(",")[0].trim() || "sem-ip";
  return createHash("sha256").update(`convite-par|${segredo}|${limpo}`).digest("hex");
}
