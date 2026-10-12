import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth.config";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { contaConfirmada, situacaoDoAcesso, usoDoApp } from "@/lib/repositories/allowedEmail.repo";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { lerComecoDaConta } from "@/lib/repositories/comeco.repo";
import { MoneyProvider } from "@/components/money/MoneyProvider";
import { ToastProvider } from "@/components/ui/toast-context";
import { ProfileThemeProvider } from "@/components/profiles/ProfileThemeProvider";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { valoresOcultos } from "@/lib/money-server";
import { toCurrencyCode } from "@/lib/money";
import { chaveDoTema, preferenciaDeModo, profileThemeCss, profileTheme as temaDoPerfil } from "@/lib/profiles/themes";
import { lerPreferenciasDeCategoria } from "@/lib/categories";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { bancoDoComeco, nomeDoMes, passoDeVolta, PASSOS_LANCAMENTO } from "@/lib/onboarding/comeco";
import { Comeco } from "./Comeco";

/**
 * O começo (onboarding) da versão nova. Fica fora do grupo (app) de propósito: o layout de lá
 * manda pra cá quem ainda não passou por aqui, e um layout que redireciona pra si mesmo é um laço.
 *
 * Quem já usava o app (onboardedAt preenchido e sem `comeco`) nunca cai aqui: volta para o mês.
 * Quem passou pelo começo novo e pulou pode voltar pelos convites da Visão geral
 * (`?passo=banco`, `?passo=digitar`...), e o resgate abre direto no banco dela (`?passo=volta`).
 */
export default async function ComecarPage({ searchParams }: { searchParams: Promise<{ passo?: string; banco?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getOwnUser({ userId: session.user.id, role: session.user.role });
  const comeco = await lerComecoDaConta(user.id);
  const { passo: pedido, banco: bancoPedido } = await searchParams;
  // Quem já usava e ainda não trouxe dados entra direto nos passos do lançamento pelos cartões da
  // Visão geral ("Enviar o extrato", "Digitar um gasto"); o resto do começo continua fechado para ela.
  const pedidoDeLancamento = !!pedido && (PASSOS_LANCAMENTO as readonly string[]).includes(pedido);
  if (user.onboardedAt !== null && (!pedido || (!comeco && !pedidoDeLancamento))) redirect("/mensal/foco");
  // Sem e-mail confirmado, o layout do app mostra a tela "Confirme seu e-mail": o começo antes
  // disso seria abrir a porta por aqui. A MESMA regra do layout (quem assinou pela Apple passa).
  if (session.user.role !== "ADMIN" && !(await contaConfirmada(user))) redirect("/mensal/foco");
  // Sem compra valendo, idem: o layout mostra "Seu acesso não está ativo".
  if (session.user.role !== "ADMIN" && usoDoApp(await situacaoDoAcesso(user.email), user.createdAt) === "bloqueado") redirect("/mensal/foco");

  const perfil = await getOrCreateActiveProfile(user.id);
  const tema = chaveDoTema(perfil.theme);
  const modo = preferenciaDeModo(user.theme);
  const primeiroNome = user.name?.trim().split(/\s+/)[0] || null;

  return (
    <ToastProvider>
      <ProfileThemeProvider theme={tema} kind={perfil.kind} profileId={perfil.id} prefsDeCategoria={lerPreferenciasDeCategoria(perfil.categorias)}>
        <MoneyProvider currency={toCurrencyCode(user.currency)} ocultos={await valoresOcultos()}>
          <ThemeSync theme={modo} />
          <style dangerouslySetInnerHTML={{ __html: profileThemeCss(tema) }} />
          <link rel="icon" type="image/svg+xml" href={`${temaDoPerfil(tema).logo}/favicon.svg`} />
          <Comeco
            inicial={comeco}
            passoInicial={passoDeVolta(comeco, pedido)}
            bancoInicial={bancoDoComeco(bancoPedido) ? bancoPedido : null}
            nomeDaConta={primeiroNome}
            temaAtual={tema}
            moedaAtual={toCurrencyCode(user.currency)}
            mesAtual={nomeDoMes(nowInBrazil())}
          />
        </MoneyProvider>
      </ProfileThemeProvider>
    </ToastProvider>
  );
}
