import Link from "next/link";
import { headers } from "next/headers";
import { after } from "next/server";
import { Check, CircleAlert } from "lucide-react";
import { BOTAO, Mola, Selo, Sub, TelaDeEntrada, Titulo } from "@/components/entrada/pecas";
import { lerTokenDeConfirmacao } from "@/lib/auth/confirmacao-email";
import { marcarEmailConfirmado } from "@/lib/repositories/user.repo";
import { sendEmail } from "@/lib/email/send";
import { enviarBoasVindasSeDevido } from "@/lib/onboarding/enviar-boas-vindas";

/**
 * Destino do link "Confirmar meu e-mail". Pública (está em PUBLIC_PATHS): o link costuma abrir
 * no navegador do celular, sem sessão nenhuma. Quem vale é o código assinado do link, não a
 * sessão — então abrir logada em outra conta não confirma a conta errada.
 */
export default async function ConfirmarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  const lido = lerTokenDeConfirmacao(typeof t === "string" ? t : null);
  const confirmado = lido ? await marcarEmailConfirmado(lido.userId, lido.email) : false;

  // Boas-vindas na hora em que a conta abre (texto aprovado pela Dani em 30/09/2026). Depois da
  // resposta, pra página não esperar o SMTP. Reabrir o link não manda de novo: a trava é o
  // NotificationLog, e se o envio falhar aqui o cron das boas-vindas manda no dia seguinte.
  if (confirmado && lido) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const userId = lido.userId;
    after(() => enviarBoasVindasSeDevido(userId, `${proto}://${host}`, sendEmail));
  }

  // Mockup A: o selo, uma frase e um botão. O link vencido diz o que fazer em seguida.
  if (confirmado) {
    return (
      <TelaDeEntrada centro>
        <Mola />
        <Selo icone={Check} tipo="ok" />
        <Titulo>E-mail confirmado</Titulo>
        <Sub>Sua conta está liberada.</Sub>
        <Mola />
        {/* /login manda quem já está logada direto pro app. */}
        <Link href="/login" className={BOTAO}>
          Entrar no SPI Finance
        </Link>
      </TelaDeEntrada>
    );
  }

  return (
    <TelaDeEntrada centro>
      <Mola />
      <Selo icone={CircleAlert} tipo="ruim" />
      <Titulo>Este link não vale mais</Titulo>
      <Sub>
        Ele pode ter vencido (vale 7 dias) ou chegado cortado. Entre e toque em Reenviar e-mail para receber um novo.
      </Sub>
      <Mola />
      <Link href="/login" className={BOTAO}>
        Entrar e pedir outro link
      </Link>
    </TelaDeEntrada>
  );
}
