import { prisma } from "@/lib/db/prisma";

/**
 * Limite de e-mails que QUALQUER UM pode fazer o app mandar pra uma conta ("Esqueci minha
 * senha", "Reenviar confirmação").
 *
 * Existe porque essas ações são públicas (ou quase) e cada chamada saía pelo SMTP do Hostinger,
 * que tem cota diária por caixa. Um script em laço enchia a caixa da cliente, invalidava o link
 * anterior a cada pedido e, pior, estourava a cota: resumo do mês, avisos e recuperação de senha
 * de TODO MUNDO paravam de sair naquele dia, sem erro nenhum na tela.
 *
 * Sem tabela nova: cada envio vira uma linha em NotificationLog (que já é "o que foi mandado pra
 * quem") com a chave `envio:<tipo>:<instante>`. As chaves dos avisos do mês não começam assim,
 * então as duas coisas não se misturam.
 */

export type TipoDeEnvio = "senha" | "confirmar-email";

export type Limites = { intervaloMs: number; porDia: number };

/** Um por minuto (o e-mail às vezes demora pra chegar, e ela aperta de novo) e 5 por dia. */
export const LIMITES_CONFIRMACAO: Limites = { intervaloMs: 60 * 1000, porDia: 5 };

/**
 * "Esqueci minha senha": dois minutos entre pedidos. Cada link novo invalida o anterior, então
 * pedir em sequência só atrapalhava a própria pessoa; dentro do intervalo, o link que já foi
 * continua valendo.
 */
export const LIMITES_SENHA: Limites = { intervaloMs: 2 * 60 * 1000, porDia: 5 };

const DIA_MS = 24 * 60 * 60 * 1000;

function prefixo(tipo: TipoDeEnvio): string {
  return `envio:${tipo}:`;
}

/**
 * Cabe mais um envio? `anteriores` são os instantes dos envios das últimas 24 horas (sem contar
 * o que se quer fazer agora). Sem banco, pra testar a regra.
 */
export function cabeMaisUmEnvio(anteriores: Date[], agora: Date, limites: Limites): boolean {
  const doDia = anteriores.filter((d) => agora.getTime() - d.getTime() < DIA_MS);
  if (doDia.length >= limites.porDia) return false;
  return !doDia.some((d) => agora.getTime() - d.getTime() < limites.intervaloMs);
}

/** Quanto falta pra poder pedir de novo (0 = já pode). Pra tela dizer "tente em 40 segundos". */
export function esperaAteProximoEnvio(anteriores: Date[], agora: Date, limites: Limites): number {
  const doDia = anteriores.filter((d) => agora.getTime() - d.getTime() < DIA_MS);
  if (doDia.length >= limites.porDia) {
    const maisAntigo = Math.min(...doDia.map((d) => d.getTime()));
    return maisAntigo + DIA_MS - agora.getTime();
  }
  const ultimo = Math.max(0, ...doDia.map((d) => d.getTime()));
  return Math.max(0, ultimo + limites.intervaloMs - agora.getTime());
}

/**
 * Reserva um envio pra conta, se couber no limite. Devolve true = pode mandar (e já contou),
 * false = não manda. A reserva é gravada ANTES de conferir: dois pedidos ao mesmo tempo gravam
 * os dois, cada um olha só os que vieram antes dele, e o segundo desiste (e apaga o seu). Uma
 * falha do SMTP depois disso também conta — senão o laço seguia batendo no Hostinger.
 */
export async function reservarEnvio(userId: string, tipo: TipoDeEnvio, limites: Limites): Promise<boolean> {
  const agora = new Date();
  const desde = new Date(agora.getTime() - DIA_MS);
  // Faxina: o que tem mais de um dia não entra mais na conta de ninguém.
  await prisma.notificationLog.deleteMany({ where: { userId, key: { startsWith: prefixo(tipo) }, sentAt: { lt: desde } } });

  const minha = await prisma.notificationLog.create({
    data: { userId, key: `${prefixo(tipo)}${agora.toISOString()}:${Math.random().toString(36).slice(2, 8)}`, sentAt: agora },
  });
  const doDia = await prisma.notificationLog.findMany({
    where: { userId, key: { startsWith: prefixo(tipo) }, sentAt: { gte: desde } },
    select: { id: true, sentAt: true },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
  });
  const anteriores = doDia.slice(0, Math.max(0, doDia.findIndex((l) => l.id === minha.id)));
  if (cabeMaisUmEnvio(anteriores.map((l) => l.sentAt), agora, limites)) return true;

  // Pedido recusado não conta: senão quem insiste ficaria trancado pra sempre.
  await prisma.notificationLog.delete({ where: { id: minha.id } }).catch(() => undefined);
  return false;
}

/** Os envios das últimas 24h, pra tela calcular a espera. */
export async function enviosRecentes(userId: string, tipo: TipoDeEnvio): Promise<Date[]> {
  const desde = new Date(Date.now() - DIA_MS);
  const linhas = await prisma.notificationLog.findMany({
    where: { userId, key: { startsWith: prefixo(tipo) }, sentAt: { gte: desde } },
    select: { sentAt: true },
  });
  return linhas.map((l) => l.sentAt);
}
