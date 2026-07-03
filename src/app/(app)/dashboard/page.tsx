import { getRequiredSession } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { userId } = await getRequiredSession();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-black/60">
        Usuário autenticado: {userId}. O consolidado mensal e os gráficos de patrimônio entram na Fase 2.
      </p>
    </div>
  );
}
