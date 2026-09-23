import { after } from "next/server";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { auth } from "@/lib/auth/auth.config";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { getOwnUser, touchLastSeen } from "@/lib/repositories/user.repo";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import type { AccountContext } from "@/lib/auth/session";
import type { ProfileKind } from "@prisma/client";
import { MoneyProvider } from "@/components/money/MoneyProvider";
import { toCurrencyCode, type CurrencyCode } from "@/lib/money";
import { listProfiles, getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { modoEfetivo, profileThemeCss, temaDeixaEscolherModo } from "@/lib/profiles/themes";
import { periodoDoDia, vozDoTema } from "@/lib/profiles/voice";


function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Ancorado no fuso do Brasil, não no do servidor, sem isso a saudação ("Bom dia"/"Boa noite")
  // e o mês do resumo trocariam umas horas antes da hora certa pra quem está no Brasil.
  const now = nowInBrazil();

  const firstName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];
  const hoje = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  const mesLabel = capitalize(now.toLocaleDateString("pt-BR", { month: "long" }));
  let theme = "dark";
  let profileTheme = "padrao";
  let profileKind: ProfileKind = "PESSOAL";
  let currency: CurrencyCode = toCurrencyCode(null);
  let isPremium = false;
  let perfis: { id: string; name: string; icon: string; theme: string; isDefault: boolean }[] = [];
  let cssDoTema = "";
  if (session?.user) {
    const ctx: AccountContext = { userId: session.user.id, role: session.user.role };
    // Uma consulta a menos em TODA navegação: o resumo do mês só existia pra alimentar a
    // faixa de saudação, que não mostra mais números.
    const [user, premium, ativo, todos] = await Promise.all([
      getOwnUser(ctx),
      hasPremiumAccess(ctx.userId),
      getOrCreateActiveProfile(ctx.userId),
      listProfiles(ctx.userId),
    ]);
    currency = toCurrencyCode(user.currency);
    theme = user.theme;
    isPremium = premium;
    perfis = todos.map((p) => ({ id: p.id, name: p.name, icon: p.icon, theme: p.theme, isDefault: p.id === ativo.id }));
    profileTheme = ativo.theme;
    profileKind = ativo.kind;
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
      <MoneyProvider currency={currency}>
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
        podeEscolherModo={podeEscolherModo}
      >
        {children}
      </AppShell>
      </MoneyProvider>
    </>
  );
}
