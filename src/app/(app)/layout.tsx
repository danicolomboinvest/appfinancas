import { auth } from "@/lib/auth/auth.config";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getOwnUser, touchLastSeen } from "@/lib/repositories/user.repo";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import type { AuthContext } from "@/lib/auth/session";
import { MoneyProvider } from "@/components/money/MoneyProvider";
import { toCurrencyCode, formatMoney, type CurrencyCode } from "@/lib/money";


function timeOfDayGreeting(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthSummaryLine(
  summary: { totalIncome: number; totalExpense: number; totalInvestment: number; balance: number },
  currency: CurrencyCode,
) {
  const money = (value: number) => formatMoney(value, currency);
  const hasAnyEntry = summary.totalIncome > 0 || summary.totalExpense > 0 || summary.totalInvestment > 0;
  if (!hasAnyEntry) return "Você ainda não lançou nada este mês.";
  if (summary.balance > 0) return `Seu saldo este mês está positivo em ${money(summary.balance)}.`;
  if (summary.balance < 0) return `Seu saldo este mês está negativo em ${money(Math.abs(summary.balance))}.`;
  return "Seu saldo este mês está zerado.";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Ancorado no fuso do Brasil, não no do servidor, sem isso a saudação ("Bom dia"/"Boa noite")
  // e o mês do resumo trocariam umas horas antes da hora certa pra quem está no Brasil.
  const now = nowInBrazil();

  const firstName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];
  const greeting = `${timeOfDayGreeting(now)}${firstName ? `, ${firstName}` : ""}.`;
  const dateLabel = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));

  let summary = "";
  let theme = "dark";
  let currency: CurrencyCode = toCurrencyCode(null);
  let isPremium = false;
  let flow: { income: number; expense: number; investment: number } | undefined;
  if (session?.user) {
    const ctx: AuthContext = { userId: session.user.id, role: session.user.role };
    const [monthlySummary, user, premium] = await Promise.all([
      getMonthlySummary(ctx, now.getFullYear(), now.getMonth() + 1),
      getOwnUser(ctx),
      hasPremiumAccess(ctx.userId),
    ]);
    currency = toCurrencyCode(user.currency);
    summary = monthSummaryLine(monthlySummary, currency);
    theme = user.theme;
    isPremium = premium;
    // Registra o "visto por último" pra métrica de engajamento (throttle interno de 15min).
    await touchLastSeen(user.id, user.lastSeenAt);
    flow = {
      income: monthlySummary.totalIncome,
      expense: monthlySummary.totalExpense,
      investment: monthlySummary.totalInvestment,
    };
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
        summary={summary}
        flow={flow}
      >
        {children}
      </AppShell>
      </MoneyProvider>
    </>
  );
}
