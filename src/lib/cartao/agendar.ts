import { after } from "next/server";
import { headers } from "next/headers";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Agenda o aviso do limite do cartão para depois da resposta (não atrasa o "Lançado" nem a
 * importação). O aviso é carregado só na hora: ele puxa o envio de e-mail, que é só do servidor.
 * Fora de uma requisição (testes, scripts) não há para quem avisar: não faz nada.
 */
export async function agendarAvisoDoCartao(ctx: AuthContext, ano: number, mes: number): Promise<void> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
    const baseUrl = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
    after(async () => (await import("./avisar")).avisarLimiteDoCartao(ctx, ano, mes, baseUrl));
  } catch {
    // Sem requisição: nada a agendar.
  }
}
