import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { AbasDasFichas } from "./AbasDasFichas";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";

export default async function FichasLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/empresa");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const premium = await hasPremiumAccess(ctx.userId);

  return (
    <>
      <AbasDasFichas insights={voz.titulos.fichasTabInsights} />
      {premium ? children : <PaywallCard feature={voz.titulos.fichasTitulo} />}
    </>
  );
}
