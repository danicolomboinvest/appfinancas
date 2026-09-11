import { PillTabs } from "@/components/shell/PillTabs";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";

/** Abas do módulo Análises, segmented control rolável (item 5.4). No mobile, é a única forma
 * de alternar entre Insights e as fichas de Ações/FIIs/Stocks/ETFs, que antes ficavam presas
 * dentro do "Mais" e não apareciam. As fichas de detalhe (/fichas/acoes/[id]) ativam a aba do
 * seu tipo pelo startsWith do PillTabs. */
const TABS = [
  { href: "/fichas", label: "Insights" },
  { href: "/fichas/acoes", label: "Ações" },
  { href: "/fichas/fiis", label: "FIIs" },
  { href: "/fichas/stocks", label: "Stocks" },
  { href: "/fichas/etfs", label: "ETFs" },
];

export default async function FichasLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const premium = await hasPremiumAccess(ctx.userId);

  return (
    <>
      <PillTabs tabs={TABS} />
      {premium ? children : <PaywallCard feature="Análises" />}
    </>
  );
}
