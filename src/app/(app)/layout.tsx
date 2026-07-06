import { auth } from "@/lib/auth/auth.config";
import { AppShell } from "@/components/shell/AppShell";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import type { AuthContext } from "@/lib/auth/session";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeOfDayGreeting(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthSummaryLine(summary: { totalIncome: number; totalExpense: number; totalInvestment: number; balance: number }) {
  const hasAnyEntry = summary.totalIncome > 0 || summary.totalExpense > 0 || summary.totalInvestment > 0;
  if (!hasAnyEntry) return "Você ainda não lançou nada este mês.";
  if (summary.balance > 0) return `Seu saldo este mês está positivo em ${formatBRL(summary.balance)}.`;
  if (summary.balance < 0) return `Seu saldo este mês está negativo em ${formatBRL(Math.abs(summary.balance))}.`;
  return "Seu saldo este mês está zerado.";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const now = new Date();

  const firstName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];
  const greeting = `${timeOfDayGreeting(now)}${firstName ? `, ${firstName}` : ""}.`;
  const dateLabel = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));

  let summary = "";
  if (session?.user) {
    const ctx: AuthContext = { userId: session.user.id, role: session.user.role };
    const monthlySummary = await getMonthlySummary(ctx, now.getFullYear(), now.getMonth() + 1);
    summary = monthSummaryLine(monthlySummary);
  }

  return (
    <AppShell
      isAdmin={session?.user.role === "ADMIN"}
      userEmail={session?.user.email ?? undefined}
      greeting={greeting}
      dateLabel={dateLabel}
      summary={summary}
    >
      {children}
    </AppShell>
  );
}
