import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { PillTabs } from "@/components/shell/PillTabs";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";

export default async function FichasLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/dashboard");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const premium = await hasPremiumAccess(ctx.userId);

  /** Abas do módulo Análises, segmented control rolável (item 5.4). No mobile, é a única forma
   * de alternar entre Insights e as fichas de Ações/FIIs/Stocks/ETFs, que antes ficavam presas
   * dentro do "Mais" e não apareciam. As fichas de detalhe (/fichas/acoes/[id]) ativam a aba do
   * seu tipo pelo startsWith do PillTabs. Só "Insights" tem voz: o resto é nome de mercado. */
  const tabs = [
    { href: "/fichas", label: voz.titulos.fichasTabInsights },
    { href: "/fichas/acoes", label: "Ações" },
    { href: "/fichas/fiis", label: "FIIs" },
    { href: "/fichas/stocks", label: "Stocks" },
    { href: "/fichas/etfs", label: "ETFs" },
  ];

  return (
    <>
      <PillTabs tabs={tabs} />
      {premium ? children : <PaywallCard feature={voz.titulos.fichasTitulo} />}
    </>
  );
}
