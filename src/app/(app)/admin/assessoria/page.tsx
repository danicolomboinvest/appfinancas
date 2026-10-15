import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { BotoesDaEquipe } from "./BotoesDaEquipe";

export const metadata = { title: "Assessoria · SPI Finance" };

/**
 * Quem tocou "Já abri minha conta" na Carteira e espera a Fatos conferir na EQI (15/10/2026).
 * "Confirmada na EQI" libera as Oportunidades para a pessoa; "Não achou a conta" devolve o
 * convite de abrir conta. Embaixo, as já confirmadas, com Desfazer para um toque errado.
 */
export default async function AdminAssessoriaPage() {
  await requireAdmin();
  const select = { id: true, name: true, email: true, phone: true, assessoriaEstadoEm: true } as const;
  const [esperando, confirmadas] = await Promise.all([
    prisma.user.findMany({ where: { assessoriaEstado: "confirmando" }, orderBy: { assessoriaEstadoEm: "asc" }, select }),
    prisma.user.findMany({ where: { assessoriaEstado: "cliente" }, orderBy: { assessoriaEstadoEm: "desc" }, select }),
  ]);
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Assessoria" subtitle="Quem disse que abriu a conta na EQI e espera a confirmação." />
      <p className="text-sm font-semibold text-ink">Esperando ({esperando.length})</p>
      {esperando.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink">Ninguém esperando agora.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {esperando.map((u) => (
            <Card key={u.id} className="flex flex-col gap-1.5 p-5">
              <p className="text-sm font-semibold text-ink">{u.name ?? "Sem nome"}</p>
              <p className="break-all text-sm text-ink">{u.email}</p>
              {u.phone && <p className="text-sm text-ink-muted">WhatsApp {u.phone}</p>}
              {u.assessoriaEstadoEm && <p className="text-caption text-ink-faint">Disse que abriu em {quando.format(u.assessoriaEstadoEm)}</p>}
              <BotoesDaEquipe userId={u.id} confirmada={false} />
            </Card>
          ))}
        </div>
      )}
      {confirmadas.length > 0 && (
        <>
          <p className="text-sm font-semibold text-ink">Confirmadas ({confirmadas.length})</p>
          <div className="flex flex-col gap-3">
            {confirmadas.map((u) => (
              <Card key={u.id} className="flex flex-col gap-1 p-5">
                <p className="text-sm font-semibold text-ink">{u.name ?? "Sem nome"}</p>
                <p className="break-all text-sm text-ink-muted">{u.email}</p>
                {u.assessoriaEstadoEm && <p className="text-caption text-success">Confirmada em {quando.format(u.assessoriaEstadoEm)}</p>}
                <BotoesDaEquipe userId={u.id} confirmada />
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
