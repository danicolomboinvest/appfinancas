import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Confere a assinatura dos webhooks da Resend, que usa o padrão Svix (30/10/2026). Sem pacote:
 * é um HMAC-SHA256 do `${svix-id}.${svix-timestamp}.${corpo}` com o segredo (`whsec_...`, base64)
 * e a comparação em tempo constante. O header `svix-signature` pode trazer várias assinaturas
 * separadas por espaço ("v1,abc v1,def"), basta uma bater.
 *
 * O segredo (RESEND_WEBHOOK_SECRET) vem SEMPRE do ambiente, nunca do código nem do Git.
 */

/** Quanto o carimbo de hora pode estar fora do relógio (o Svix usa 5 minutos). */
export const TOLERANCIA_SEGUNDOS = 5 * 60;

export type ResultadoDaAssinatura = { ok: true } | { ok: false; motivo: "sem-cabecalho" | "carimbo-invalido" | "fora-do-prazo" | "assinatura-invalida" | "segredo-invalido" };

export type CabecalhosSvix = { id: string | null; timestamp: string | null; signature: string | null };

export function lerCabecalhosSvix(headers: Headers): CabecalhosSvix {
  return { id: headers.get("svix-id"), timestamp: headers.get("svix-timestamp"), signature: headers.get("svix-signature") };
}

/** Assina como o Svix assina (serve para o teste montar uma chamada válida). */
export function assinarSvix(segredo: string, id: string, timestamp: string, corpo: string): string {
  const chave = chaveDoSegredo(segredo);
  if (!chave) throw new Error("segredo inválido");
  return `v1,${createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest("base64")}`;
}

export function conferirAssinaturaSvix(
  segredo: string,
  cabecalhos: CabecalhosSvix,
  corpo: string,
  agora: Date = new Date(),
): ResultadoDaAssinatura {
  const chave = chaveDoSegredo(segredo);
  if (!chave) return { ok: false, motivo: "segredo-invalido" };
  const { id, timestamp, signature } = cabecalhos;
  if (!id || !timestamp || !signature) return { ok: false, motivo: "sem-cabecalho" };

  const segundos = Number(timestamp);
  if (!Number.isInteger(segundos)) return { ok: false, motivo: "carimbo-invalido" };
  if (Math.abs(Math.floor(agora.getTime() / 1000) - segundos) > TOLERANCIA_SEGUNDOS) return { ok: false, motivo: "fora-do-prazo" };

  const esperada = createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest();
  for (const parte of signature.split(" ")) {
    const [versao, valor] = parte.split(",");
    if (versao !== "v1" || !valor) continue;
    let recebida: Buffer;
    try {
      recebida = Buffer.from(valor, "base64");
    } catch {
      continue;
    }
    if (recebida.length === esperada.length && timingSafeEqual(recebida, esperada)) return { ok: true };
  }
  return { ok: false, motivo: "assinatura-invalida" };
}

/** O segredo vem como `whsec_<base64>`; o HMAC usa os bytes decodificados. */
function chaveDoSegredo(segredo: string): Buffer | null {
  const limpo = segredo.trim().replace(/^whsec_/, "");
  if (!limpo) return null;
  const bytes = Buffer.from(limpo, "base64");
  return bytes.length > 0 ? bytes : null;
}
