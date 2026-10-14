import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * O recibo do "Desfazer" depois de apagar uma meta ou uma dívida (13/10/2026).
 *
 * Apagar é de verdade (o modelo não tem "apagada em"), então o Desfazer recria o registro com o
 * mesmo id e religa o que estava ligado a ele. O que recriar vai no recibo, que fica só na tela
 * por alguns segundos. Assinado para a tela não poder inventar uma meta com campos que o app nunca
 * deixa ela digitar (o "Já guardado" de partida, os aportes de outra pessoa), e preso a quem
 * apagou: conta e perfil. Vence rápido: é para o aviso de 6 segundos, com folga para rede lenta.
 */

export const VALIDADE_DO_RECIBO_MS = 2 * 60 * 1000;

/** Prefixo assinado junto: o AUTH_SECRET assina outras coisas, e um recibo não pode valer lá. */
const PROPOSITO = "desfazer-apagar:v1";

type Dono = { userId: string; profileId: string };
type Envelope<T> = { t: string; u: string; p: string; x: number; d: T };

function segredo(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function assinar(corpo: string, chave: string): Buffer {
  return createHmac("sha256", chave).update(`${PROPOSITO}.${corpo}`).digest();
}

/** Monta o recibo. Sem segredo configurado devolve null: o aviso sai sem o Desfazer. */
export function criarRecibo<T>(tipo: string, dono: Dono, dados: T, agora: number = Date.now()): string | null {
  const chave = segredo();
  if (!chave) return null;
  const envelope: Envelope<T> = { t: tipo, u: dono.userId, p: dono.profileId, x: agora + VALIDADE_DO_RECIBO_MS, d: dados };
  const corpo = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${corpo}.${assinar(corpo, chave).toString("base64url")}`;
}

/** Lê o recibo: os dados, ou null se foi mexido, venceu, é de outro tipo ou de outro dono. */
export function lerRecibo<T>(tipo: string, dono: Dono, recibo: unknown, agora: number = Date.now()): T | null {
  const chave = segredo();
  if (!chave || typeof recibo !== "string" || recibo.length > 500_000) return null;
  const partes = recibo.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;
  const esperada = assinar(corpo, chave);
  const recebida = Buffer.from(assinatura, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  let e: Partial<Envelope<T>>;
  try {
    e = JSON.parse(Buffer.from(corpo, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (e.t !== tipo || e.u !== dono.userId || e.p !== dono.profileId) return null;
  if (typeof e.x !== "number" || e.x < agora) return null;
  return (e.d ?? null) as T | null;
}
