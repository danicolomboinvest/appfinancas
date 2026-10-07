import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Connections } from "./Connections";
import { vozDoTema } from "@/lib/profiles/voice";

export default async function ConexoesPage() {
  const ctx = await getRequiredSession();
  const connections = await prisma.bankConnection.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } });
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.cfgConexoesTitulo} />
      <Connections
        configured={isPluggyConfigured()}
        connections={connections.map((c) => ({
          id: c.id,
          connectorName: c.connectorName,
          status: c.status,
          // O servidor roda em UTC: sem o fuso, "Atualizar" às 21h30 aparecia como 00:30 do dia seguinte.
          lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null,
          lastSyncCount: c.lastSyncCount,
          lastError: c.lastError,
        }))}
      />
    </div>
  );
}
