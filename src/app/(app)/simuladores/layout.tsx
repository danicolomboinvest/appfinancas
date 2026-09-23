import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";

/** Trava a seção inteira (a lista e cada simulador) atrás do acesso premium — modelo freemium,
 * simuladores fazem parte do conteúdo do curso, junto com Carteira/Análises/Aposentadoria. */
export default async function SimuladoresLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/dashboard");
  const premium = await hasPremiumAccess(ctx.userId);

  if (!premium) return <PaywallCard feature={vozDoTema(ctx.profileTheme, ctx.profileKind).titulos.simPaywallNome} />;
  return <>{children}</>;
}
