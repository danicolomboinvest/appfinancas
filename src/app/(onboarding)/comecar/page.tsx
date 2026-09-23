import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth.config";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { BrandMark } from "@/components/brand/BrandMark";
import { EscolhaInicial } from "./EscolhaInicial";

/**
 * A tela de boas-vindas. Fica fora do grupo (app) de propósito: o layout de lá manda pra cá
 * quem ainda não passou por aqui, e um layout que redireciona pra si mesmo é um laço.
 * Quem já passou e volta por link cai no mês.
 */
export default async function ComecarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getOwnUser({ userId: session.user.id, role: session.user.role });
  if (user.onboardedAt !== null) redirect("/mensal");

  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas p-6 sm:items-center">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Bem-vinda ao SPI Finance{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
            <p className="mt-1 text-sm text-ink-muted">Duas escolhas rápidas e o app já fica com a sua cara. Dá pra mudar depois.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <EscolhaInicial nome={user.name ?? undefined} />
        </div>
      </div>
    </main>
  );
}
