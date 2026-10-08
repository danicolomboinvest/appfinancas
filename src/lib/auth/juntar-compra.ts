import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { isExpired, normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { sendEmail } from "@/lib/email/send";
import { codigoDaCompraEmail } from "@/lib/email/templates";

/**
 * Juntar a compra à conta sozinha (07/10/2026). Quem comprou com um e-mail e criou a conta com
 * outro caía no cadeado e tinha de escrever para o suporte. Agora digita o e-mail da compra,
 * recebe um código NELE e, com o código certo, a conta passa a usar o e-mail da compra: o acesso
 * é conferido pelo e-mail da conta, e a renovação da Hubla continua ligada ao mesmo e-mail.
 *
 * Sem tabela nova: os códigos moram na de "esqueci a senha" (PasswordResetToken), com prefixo
 * próprio. O hash junta código + e-mail da compra + conta, então um código só vale para aquela
 * compra naquela conta, e nada legível fica no banco.
 */

const PREFIXO = "juntar:";
const PREFIXO_FALHA = "juntar-falha:";
const VALIDADE_MS = 20 * 60 * 1000;
const PEDIDOS_POR_HORA = 4;
const TENTATIVAS_ERRADAS = 5;

function hashDoCodigo(codigo: string, email: string, userId: string): string {
  return PREFIXO + createHash("sha256").update(`${codigo}:${email}:${userId}`).digest("hex");
}

type Resultado = { ok: true; email: string } | { ok: false; erro: string };

/** A compra pode ser juntada? (existe, está valendo e o e-mail ainda não tem conta). */
async function conferirCompra(email: string, userId: string): Promise<string | null> {
  const compra = await prisma.allowedEmail.findUnique({ where: { email }, select: { active: true, expiresAt: true } });
  if (!compra || !compra.active || isExpired(compra.expiresAt)) return "Não achamos uma compra valendo com esse e-mail. Confira se é o mesmo do pagamento.";
  const outra = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, NOT: { id: userId } }, select: { id: true } });
  if (outra) return "Esse e-mail já tem uma conta no app. Saia desta e entre com ele.";
  return null;
}

export async function pedirCodigoDaCompra(userId: string, emailDigitado: string): Promise<Resultado> {
  const email = normalizeEmail(emailDigitado);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "Digite o e-mail inteiro, como no pagamento." };
  const conta = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!conta) return { ok: false, erro: "Entre de novo no app e tente outra vez." };
  if (normalizeEmail(conta.email) === email) return { ok: false, erro: "Esse já é o e-mail desta conta. Use o e-mail em que chegou o recibo da compra." };
  const problema = await conferirCompra(email, userId);
  if (problema) return { ok: false, erro: problema };

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  const pedidos = await prisma.passwordResetToken.count({ where: { userId, tokenHash: { startsWith: PREFIXO }, createdAt: { gte: umaHoraAtras } } });
  if (pedidos >= PEDIDOS_POR_HORA) return { ok: false, erro: "Já mandamos vários códigos. Espere um pouco e tente de novo." };

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashDoCodigo(codigo, email, userId), expiresAt: new Date(Date.now() + VALIDADE_MS) } });
  const enviado = await sendEmail({ to: email, ...codigoDaCompraEmail({ codigo, emailDaConta: conta.email }) });
  if (!enviado.ok) return { ok: false, erro: "Não consegui mandar o e-mail agora. Tente de novo em instantes." };
  return { ok: true, email };
}

export async function confirmarCodigoDaCompra(userId: string, emailDigitado: string, codigoDigitado: string): Promise<Resultado> {
  const email = normalizeEmail(emailDigitado);
  const codigo = codigoDigitado.replace(/\D/g, "");
  const janela = new Date(Date.now() - VALIDADE_MS);
  const erradas = await prisma.passwordResetToken.count({ where: { userId, tokenHash: { startsWith: PREFIXO_FALHA }, createdAt: { gte: janela } } });
  if (erradas >= TENTATIVAS_ERRADAS) return { ok: false, erro: "Muitas tentativas. Peça um código novo daqui a pouco." };

  const token = codigo.length === 6 ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashDoCodigo(codigo, email, userId) } }) : null;
  if (!token || token.userId !== userId || token.usedAt || token.expiresAt < new Date()) {
    // Cada erro fica registrado (sem nada legível) para travar quem tenta adivinhar.
    await prisma.passwordResetToken.create({ data: { userId, tokenHash: PREFIXO_FALHA + randomBytes(16).toString("hex"), expiresAt: new Date(), usedAt: new Date() } });
    return { ok: false, erro: "Código errado ou vencido. Confira o e-mail ou peça outro." };
  }

  const problema = await conferirCompra(email, userId);
  if (problema) return { ok: false, erro: problema };
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    // O código chegou no e-mail da compra: ele está confirmado.
    prisma.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: new Date() } }),
  ]);
  return { ok: true, email };
}
