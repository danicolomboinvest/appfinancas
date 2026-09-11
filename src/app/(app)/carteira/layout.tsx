import { PillTabs } from "@/components/shell/PillTabs";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";

const TABS = [
  { href: "/carteira", label: "Meus Ativos" },
  { href: "/carteira/por-objetivo", label: "Por Objetivo" },
  { href: "/carteira/estrategia", label: "Estratégia" },
];

export default async function CarteiraLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const premium = await hasPremiumAccess(ctx.userId);

  return (
    <>
      <PillTabs tabs={TABS} />
      {premium ? children : <PaywallCard feature="Carteira de Investimentos" />}
    </>
  );
}
