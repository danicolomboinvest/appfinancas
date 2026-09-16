import { after } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { getOwnUser, touchLastSeen } from "@/lib/repositories/user.repo";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import type { AuthContext } from "@/lib/auth/session";
import { MoneyProvider } from "@/components/money/MoneyProvider";
import { toCurrencyCode, type CurrencyCode } from "@/lib/money";


function timeOfDayGreeting(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Ancorado no fuso do Brasil, não no do servidor, sem isso a saudação ("Bom dia"/"Boa noite")
  // e o mês do resumo trocariam umas horas antes da hora certa pra quem está no Brasil.
  const now = nowInBrazil();

  const firstName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];
  const greeting = `${timeOfDayGreeting(now)}${firstName ? `, ${firstName}` : ""}.`;
  const dateLabel = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  let theme = "dark";
  let currency: CurrencyCode = toCurrencyCode(null);
  let isPremium = false;
  if (session?.user) {
    const ctx: AuthContext = { userId: session.user.id, role: session.user.role };
    // Uma consulta a menos em TODA navegação: o resumo do mês só existia pra alimentar a
    // faixa de saudação, que não mostra mais números.
    const [user, premium] = await Promise.all([getOwnUser(ctx), hasPremiumAccess(ctx.userId)]);
    currency = toCurrencyCode(user.currency);
    theme = user.theme;
    isPremium = premium;
    // `after` roda DEPOIS que a resposta já foi enviada. Isto aqui é métrica de engajamento,
    // não conteúdo da página — com `await`, uma vez a cada 15 minutos a pessoa esperava uma
    // escrita no banco antes de a tela aparecer. Não dá pra só soltar a promessa sem esperar:
    // em serverless a função congela ao responder e o trabalho solto morre pela metade.
    after(() => touchLastSeen(user.id, user.lastSeenAt));
  }

  return (
    <>
      <ThemeSync theme={theme} />
      <MoneyProvider currency={currency}>
      <AppShell
        isAdmin={session?.user.role === "ADMIN"}
        isPremium={isPremium}
        userEmail={session?.user.email ?? undefined}
        greeting={greeting}
        dateLabel={dateLabel}
        theme={theme === "light" ? "light" : "dark"}
      >
        {children}
      </AppShell>
      </MoneyProvider>
    </>
  );
}
