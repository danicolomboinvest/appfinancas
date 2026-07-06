import {
  ArrowLeftRight,
  Briefcase,
  Calculator,
  Compass,
  FileSearch,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { HomeSectionCard } from "@/components/ui/HomeSectionCard";

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

export default async function InicioPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display font-semibold tracking-tight text-ink">O que você quer organizar hoje?</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <HomeSectionCard key={section.href} {...section} />
        ))}
      </div>
    </div>
  );
}
