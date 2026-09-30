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
  if (ehEmpresa(ctx.profileKind)) redirect("/dashboard");
  const premium = await hasPremiumAccess(ctx.userId);

  // O "‹ Decidir" mora aqui, no layout, pra valer em todo simulador, na lista e no cadeado de
  // uma vez — sem depender de cada tela lembrar de pôr. Alinhado com a largura do simulador.
  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto w-full max-w-5xl">
        <VoltarProDecidir />
      </div>
      {premium ? children : <PaywallCard feature={vozDoTema(ctx.profileTheme, ctx.profileKind).titulos.simPaywallNome} />}
    </div>
  );
}
