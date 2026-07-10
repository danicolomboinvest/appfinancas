import Link from "next/link";
import {
  ArrowLeftRight,
  Briefcase,
  Calculator,
  Compass,
  FileSearch,
  LayoutDashboard,
  Plus,
  Settings,
  Wallet,
} from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { computeInsights, type Insight } from "@/lib/insights";
import { HomeSectionCard } from "@/components/ui/HomeSectionCard";
import { Card } from "@/components/ui/Card";

const SECTIONS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Visão Geral",
    subtitle: "Veja como está sua evolução até aqui.",
  },
  {
    href: "/mensal",
    icon: ArrowLeftRight,
    title: "Fluxo Financeiro",
    subtitle: "Como está seu dinheiro este mês? Vamos organizar.",
  },
  {
    href: "/orcamento",
    icon: Wallet,
    title: "Orçamento",
    subtitle: "Planeje quanto quer gastar em cada categoria.",
  },
  {
    href: "/planejamento/acumulo",
    icon: Compass,
    title: "Planejamento Financeiro",
    subtitle: "Vamos planejar seus próximos objetivos?",
  },
  {
    href: "/carteira",
    icon: Briefcase,
    title: "Carteira de Investimentos",
    subtitle: "Vamos acompanhar sua carteira de investimentos?",
  },
  {
    href: "/simuladores",
    icon: Calculator,
    title: "Simuladores",
    subtitle: "Vamos descobrir quanto seu dinheiro pode render?",
  },
  {
    href: "/fichas",
    icon: FileSearch,
    title: "Análises",
    subtitle: "Veja o que seus números têm a dizer.",
  },
  {
    href: "/configuracoes/perfil",
    icon: Settings,
    title: "Configurações",
    subtitle: "Hora de atualizar seus dados e preferências.",
  },
];

const INSIGHT_TONE_CLASSES: Record<Insight["tone"], string> = {
  success: "border-l-4 border-l-success bg-success-soft/40",
  warning: "border-l-4 border-l-accent bg-accent-soft/40",
  danger: "border-l-4 border-l-danger bg-danger-soft/40",
  info: "border-l-4 border-l-border-strong bg-surface-2",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function InicioPage() {
  const ctx = await getRequiredSession();
  const now = new Date();
  const [summary, insights] = await Promise.all([
    getMonthlySummary(ctx, now.getFullYear(), now.getMonth() + 1),
    computeInsights(ctx),
  ]);
  const topInsights = insights.slice(0, 2);
  const balanceTone = summary.balance >= 0 ? "text-success" : "text-danger";

  return (
    <div className="flex flex-col gap-8">
      {/* Mobile: tela "Hoje" acionável — saldo em destaque, insights e um botão primário.
          A navegação entre módulos já está coberta pela tab bar, então não repetimos o
          menu de cards aqui (ver bloco "hidden md:flex" abaixo, só para desktop). */}
      <div className="flex flex-col gap-4 md:hidden">
        <Card className="p-5">
          <p className="text-xs text-ink-muted">Saldo este mês</p>
          <p className={`mt-1 text-display font-semibold tracking-tight ${balanceTone}`}>{formatBRL(summary.balance)}</p>
          <p className="mt-1.5 text-xs text-ink-faint">
            {formatBRL(summary.totalIncome)} de renda · {formatBRL(summary.totalExpense)} de gastos
          </p>
        </Card>

        {topInsights.length > 0 && (
          <div className="flex flex-col gap-2">
            {topInsights.map((insight) => (
              <Card key={insight.id} className={`p-3.5 text-sm text-ink ${INSIGHT_TONE_CLASSES[insight.tone]}`}>
                {insight.message}
                {insight.href && insight.actionLabel && (
                  <Link href={insight.href} className="ml-1.5 font-medium text-accent-strong hover:underline">
                    {insight.actionLabel}
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}

        <Link
          href="/mensal"
          className="flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-on-accent shadow-premium"
        >
          <Plus size={18} strokeWidth={2.25} />
          Lançar
        </Link>
      </div>

      {/* Desktop: hub com todos os módulos (a sidebar já cobre a navegação, mas o hub
          funciona como uma tela de aterrissagem depois do login). */}
      <div className="hidden md:flex md:flex-col md:gap-8">
        <h1 className="text-display font-semibold tracking-tight text-ink">O que você quer organizar hoje?</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <HomeSectionCard key={section.href} {...section} />
          ))}
        </div>
      </div>
    </div>
  );
}
