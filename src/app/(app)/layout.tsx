import { Fragment } from "react";
import { perfilTemLimiteDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { auth } from "@/lib/auth/auth.config";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { getOwnUser, touchLastSeen } from "@/lib/repositories/user.repo";
import { compraComOCelular, contaConfirmada, situacaoDoAcesso, usoDoApp } from "@/lib/repositories/allowedEmail.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import type { AccountContext } from "@/lib/auth/session";
import type { ProfileKind } from "@prisma/client";
import { MoneyProvider } from "@/components/money/MoneyProvider";
import { valoresOcultos } from "@/lib/money-server";
import { toCurrencyCode, type CurrencyCode } from "@/lib/money";
import { listProfiles, getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { modoEfetivo, profileThemeCss, temaDeixaEscolherModo } from "@/lib/profiles/themes";
import { periodoDoDia, vozDoTema } from "@/lib/profiles/voice";
import { TelaConfirmeEmail } from "@/components/auth/TelaConfirmeEmail";
import { TelaSemAcesso } from "@/components/auth/TelaSemAcesso";
import { AssinarPelaApple } from "@/components/auth/AssinarPelaApple";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { IDS_DOS_PRODUTOS } from "@/lib/apple/config";
import { guardarTokenApple } from "@/lib/repositories/assinaturaApple.repo";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";
import { mensagemDeContaSemAcesso } from "@/lib/support/contato";
import { lerPreferenciasDeCategoria, type PreferenciasDeCategoria } from "@/lib/categories";
import { lerConfigCasal } from "@/lib/casal/acerto";


function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Ancorado no fuso do Brasil, não no do servidor, sem isso a saudação ("Bom dia"/"Boa noite")
  // e o mês do resumo trocariam umas horas antes da hora certa pra quem está no Brasil.
  const now = nowInBrazil();

  // Do token da sessão só como reserva: o nome ali é o do dia do login e nunca atualiza. Quem
  // corrigia o nome em Perfil via "Salvo" e a saudação continuava com o antigo até sair e entrar.
  let firstName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];
  const hoje = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  const mesLabel = capitalize(now.toLocaleDateString("pt-BR", { month: "long" }));
  let theme = "dark";
  let profileTheme = "padrao";
  let profileKind: ProfileKind = "PESSOAL";
  let prefsDeCategoria: PreferenciasDeCategoria = {};
  let nomesDoCasal: { A: string; B: string } | null = null;
  // Limite do cartão é opcional (06/10/2026): o "No cartão" do + só aparece para quem montou um.
  let cartaoComLimite = false;
  let currency: CurrencyCode = toCurrencyCode(null);
  let isPremium = false;
  let perfis: { id: string; name: string; icon: string; theme: string; isDefault: boolean }[] = [];
  let cssDoTema = "";
  let perfilAtivoId = "";
  if (session?.user) {
    const ctx: AccountContext = { userId: session.user.id, role: session.user.role };
    // Uma consulta a menos em TODA navegação: o resumo do mês só existia pra alimentar a
    // faixa de saudação, que não mostra mais números.
    const [user, ativo, todos] = await Promise.all([getOwnUser(ctx), getOrCreateActiveProfile(ctx.userId), listProfiles(ctx.userId)]);
    // Só quem comprou usa o app (fim do freemium, 30/09/2026); quem criou conta no tempo do
    // grátis continua com a parte grátis (ver usoDoApp). Vem antes da confirmação do e-mail:
    // quem não tem compra não precisa confirmar nada, precisa saber o que fazer. O e-mail é o da
    // conta no banco, não o do token, que é o do dia do login.
    const acesso = ctx.role === "ADMIN" ? "ativo" : await situacaoDoAcesso(user.email);
    const uso = usoDoApp(acesso, user.createdAt);
    if (uso === "bloqueado" && acesso !== "ativo") {
      // No app da Apple, quem não tem acesso assina ali mesmo (guideline 3.1.1); a tela do
      // cadeado, que fala de compra feita fora, não pode aparecer lá.
      if (await naAppDaApple()) return <AssinarPelaApple token={await guardarTokenApple(user)} produtosIds={[...IDS_DOS_PRODUTOS]} />;
      const compraDoCelular = acesso === "sem-compra" ? await compraComOCelular(user.phone) : null;
      return <TelaSemAcesso email={user.email} situacao={acesso} compraDoCelular={compraDoCelular} whatsapp={linkDoSuporte(mensagemDeContaSemAcesso(user.email))} />;
    }
    // Conta nova só abre depois de confirmar o e-mail: sem isso qualquer um criava a conta com
    // o e-mail de outra pessoa (de uma compradora, inclusive). Vem antes do /comecar, que
    // também manda de volta pra cá quem não confirmou. Admin sempre passa.
    // Exceção: quem assinou pela Apple a partir desta conta. A compra já prova que a conta é
    // dela, e o revisor da Apple, que assina no Sandbox, não abre e-mail de confirmação.
    if (ctx.role !== "ADMIN" && !(await contaConfirmada(user))) return <TelaConfirmeEmail email={user.email} />;
    // Primeira entrada: antes de ver qualquer tela, a pessoa escolhe o tipo e o tema do
    // perfil dela em /comecar. Uma vez só; quem já usava o app nasceu com a data preenchida.
    if (user.onboardedAt === null) redirect("/comecar");
    firstName = user.name?.split(" ")[0] || user.email.split("@")[0];
    currency = toCurrencyCode(user.currency);
    theme = user.theme;
    // Compra valendo e e-mail confirmado: a área de investimentos abre toda. Quem sobrou do
    // grátis vê o cadeado nela, como antes.
    isPremium = uso === "completo";
    perfis = todos.map((p) => ({ id: p.id, name: p.name, icon: p.icon, theme: p.theme, isDefault: p.id === ativo.id }));
    perfilAtivoId = ativo.id;
    profileTheme = ativo.theme;
    profileKind = ativo.kind;
    prefsDeCategoria = lerPreferenciasDeCategoria(ativo.categorias);
    cartaoComLimite = await perfilTemLimiteDoCartao(ctx.userId, ativo.id);
    if (ativo.kind === "CASAL") {
      const casal = lerConfigCasal(ativo.casal);
      nomesDoCasal = { A: casal.nomeA, B: casal.nomeB };
    }
    // O TEMA do perfil ativo redefine a paleta do app inteiro — fundo, cartão, tinta e
    // destaque. Como tudo já pinta com var(--color-*), a tela toda muda junto sem nenhum
    // componente saber que existe tema. Trocar de perfil troca a cara do app.
    cssDoTema = profileThemeCss(ativo.theme);
    // `after` roda DEPOIS que a resposta já foi enviada. Isto aqui é métrica de engajamento,
    // não conteúdo da página — com `await`, uma vez a cada 15 minutos a pessoa esperava uma
    // escrita no banco antes de a tela aparecer. Não dá pra só soltar a promessa sem esperar:
    // em serverless a função congela ao responder e o trabalho solto morre pela metade.
    after(() => touchLastSeen(user.id, user.lastSeenAt));
  }

  // A saudação já sai na voz do tema: "Oi, Dani ✨" no Girly, "Bom dia. Vamos fazer o que
  // precisa ser feito?" no Disciplina, nenhuma no Game (ele abre no ranking).
  const voz = vozDoTema(profileTheme, profileKind);
  const greeting = voz.saudacao(periodoDoDia(now.getHours()), firstName);
  const dateLabel = voz.subSaudacao(mesLabel) ?? hoje;
  // O modo (claro/escuro) que vale: o do tema, quando ele tem um só; o da pessoa, no Padrão.
  const modo = modoEfetivo(profileTheme, theme);
  const podeEscolherModo = temaDeixaEscolherModo(profileTheme);

  return (
    <>
      <ThemeSync theme={modo === "claro" ? "light" : "dark"} />
      <MoneyProvider currency={currency} ocultos={await valoresOcultos()}>
      {cssDoTema && <style dangerouslySetInnerHTML={{ __html: cssDoTema }} />}
      <AppShell
        perfis={perfis}
        isAdmin={session?.user.role === "ADMIN"}
        isPremium={isPremium}
        userEmail={session?.user.email ?? undefined}
        greeting={greeting}
        dateLabel={dateLabel}
        theme={modo === "claro" ? "light" : "dark"}
        openFinance={isPluggyConfigured()}
        profileTheme={profileTheme}
        profileKind={profileKind}
        prefsDeCategoria={prefsDeCategoria}
        nomesDoCasal={nomesDoCasal}
        cartaoComLimite={cartaoComLimite}
        podeEscolherModo={podeEscolherModo}
      >
        {/* Trocar de perfil só revalida a página, e o React guarda o estado dos formulários que
            re-renderizam: o orçamento continuava com os números do perfil anterior e o "Salvar"
            gravava no perfil novo. A chave do perfil ativo remonta a tela inteira na troca. */}
        <Fragment key={perfilAtivoId}>{children}</Fragment>
      </AppShell>
      </MoneyProvider>
    </>
  );
}
