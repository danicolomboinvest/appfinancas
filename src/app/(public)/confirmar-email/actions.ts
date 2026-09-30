"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth.config";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { emailConfirmado } from "@/lib/auth/confirmacao-email";
import { enviarConfirmacaoDeEmail } from "@/lib/auth/enviar-confirmacao";
import { LIMITES_CONFIRMACAO, enviosRecentes, esperaAteProximoEnvio } from "@/lib/auth/limite-de-envio";

export type ReenvioState = { enviado?: boolean; erro?: string };

/** "Espere 40 segundos" / "espere 3 horas": o bastante pra ela saber se vale ficar esperando. */
function quantoFalta(ms: number): string {
  const segundos = Math.max(1, Math.ceil(ms / 1000));
  if (segundos < 60) return `${segundos} segundo${segundos === 1 ? "" : "s"}`;
  const minutos = Math.ceil(segundos / 60);
  if (minutos < 60) return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
  const horas = Math.ceil(minutos / 60);
  return `${horas} hora${horas === 1 ? "" : "s"}`;
}

/**
 * "Reenviar" da tela de confirmação. Só pra quem está logada (o e-mail vai pro endereço da
 * própria conta, nunca pra um digitado) e com o limite de 1 por minuto e 5 por dia. Sem
 * parâmetros de propósito: não lê nada do formulário.
 */
export async function reenviarConfirmacaoAction(): Promise<ReenvioState> {
  const session = await auth();
  if (!session?.user) return { erro: "Sua sessão acabou. Entre de novo pra pedir outro link." };
  const user = await getOwnUser({ userId: session.user.id, role: session.user.role });
  // Já confirmou (em outra aba, pelo link): nada a mandar. Revalidar refaz o layout, que agora
  // deixa passar, e o app abre no lugar desta tela.
  if (emailConfirmado(user)) {
    revalidatePath("/", "layout");
    return {};
  }

  const resultado = await enviarConfirmacaoDeEmail(user);
  if (resultado === "enviado") return { enviado: true };
  if (resultado === "falhou") return { erro: "Não conseguimos mandar o e-mail agora. Tente de novo daqui a pouco." };

  const espera = esperaAteProximoEnvio(await enviosRecentes(user.id, "confirmar-email"), new Date(), LIMITES_CONFIRMACAO);
  return {
    erro: `Acabamos de mandar um link. Dê uma olhada na caixa de entrada e no spam, ou peça outro em ${quantoFalta(espera)}.`,
  };
}
