import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";

/** Trava a seção inteira (a lista e cada simulador) atrás do acesso premium — modelo freemium,
 * simuladores fazem parte do conteúdo do curso, junto com Carteira/Análises/Aposentadoria. */
export default async function SimuladoresLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const premium = await hasPremiumAccess(ctx.userId);

  if (!premium) return <PaywallCard feature="Simuladores" />;
  return <>{children}</>;
}
