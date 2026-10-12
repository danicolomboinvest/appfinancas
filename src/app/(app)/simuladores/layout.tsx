import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { VoltarProDecidir } from "./VoltarProDecidir";

/** Trava a seção inteira (a lista e cada simulador) atrás do acesso premium — modelo freemium,
 * simuladores fazem parte do conteúdo do curso, junto com Carteira/Análises/Aposentadoria. */
export default async function SimuladoresLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/empresa");
  const premium = await hasPremiumAccess(ctx.userId);

  // Versão nova (11/10/2026): cada calculadora tem o próprio topo ("‹ Calculadoras", "1 de 3"),
  // como no protótipo. O "‹ Calculadoras" daqui fica só para o cadeado de quem não tem acesso.
  if (premium) return <>{children}</>;
  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto w-full max-w-5xl">
        <VoltarProDecidir />
      </div>
      <PaywallCard feature={vozDoTema(ctx.profileTheme, ctx.profileKind).titulos.simPaywallNome} />
    </div>
  );
}
