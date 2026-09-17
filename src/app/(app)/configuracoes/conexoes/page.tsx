import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Connections } from "./Connections";

export default async function ConexoesPage() {
  const ctx = await getRequiredSession();
  const connections = await prisma.bankConnection.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes/perfil" }, { label: "Conexões" }]} />
      <PageHeader title="Conectar meu banco" subtitle="Open Finance: os lançamentos da conta e do cartão chegam sozinhos, toda noite." />
      <Connections
        configured={isPluggyConfigured()}
        connections={connections.map((c) => ({
          id: c.id,
          connectorName: c.connectorName,
          status: c.status,
          lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null,
          lastSyncCount: c.lastSyncCount,
          lastError: c.lastError,
        }))}
      />
    </div>
  );
}
