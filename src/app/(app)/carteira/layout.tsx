import { PillTabs } from "@/components/shell/PillTabs";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { vozDoTema } from "@/lib/profiles/voice";
import { ehEmpresa } from "@/lib/profiles/empresa";

const HREFS = ["/carteira", "/carteira/por-objetivo", "/carteira/estrategia"] as const;

export default async function CarteiraLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const premium = await hasPremiumAccess(ctx.userId);
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const tabs = HREFS.map((href, i) => ({ href, label: voz.titulos.carteiraTabs[i] }));

  // Empresa: o caixa e os ativos bastam. Estratégia e "por objetivo" são de quem monta
  // carteira de investimento pessoal; a Dani não quis esse peso no perfil de negócio.
  return (
    <>
      {!ehEmpresa(ctx.profileKind) && <PillTabs tabs={tabs} />}
      {premium ? children : <PaywallCard feature="Carteira de Investimentos" />}
    </>
  );
}
