import {
  ArrowLeftRight,
  Briefcase,
  Calculator,
  Compass,
  FileSearch,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { auth } from "@/lib/auth/auth.config";
import { HomeSectionCard } from "@/components/ui/HomeSectionCard";

const SECTIONS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Visão Geral",
    subtitle: "O resumo do seu mês, do seu ano e da evolução do seu patrimônio.",
  },
  {
    href: "/mensal",
    icon: ArrowLeftRight,
    title: "Fluxo Financeiro",
    subtitle: "Lance renda, gastos e aportes e acompanhe seu saldo mês a mês.",
  },
  {
    href: "/planejamento/acumulo",
    icon: Compass,
    title: "Planejamento Financeiro",
    subtitle: "Acúmulo, Liberdade Financeira, projeção patrimonial, reserva e metas.",
  },
  {
    href: "/carteira",
    icon: Briefcase,
    title: "Carteira de Investimentos",
    subtitle: "Seus ativos, alocação por objetivo e comparação com o ideal.",
  },
  {
    href: "/simuladores",
    icon: Calculator,
    title: "Simuladores",
    subtitle: "Financiar vs. alugar, consórcio, marcação a mercado e mais.",
  },
  {
    href: "/fichas",
    icon: FileSearch,
    title: "Análises",
    subtitle: "Insights automáticos e fichas de análise fundamentalista de ações e FIIs.",
  },
  {
    href: "/configuracoes/perfil",
    icon: Settings,
    title: "Configurações",
    subtitle: "Perfil, categorias, preferências, notificações e taxas do sistema.",
  },
];

export default async function InicioPage() {
  const session = await auth();
  const displayName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-ink-muted">Bem-vinda de volta{displayName ? `, ${displayName}` : ""}.</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">O que você quer organizar hoje?</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <HomeSectionCard key={section.href} {...section} />
        ))}
      </div>
    </div>
  );
}
