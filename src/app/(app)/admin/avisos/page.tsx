import { requireAdmin } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { listarRespostasErradas } from "@/lib/repositories/decisao.repo";

export const metadata = { title: "Isso está errado? · SPI Finance" };

/**
 * A fila do botão "Isso está errado?": cada vez que alguém acha que uma resposta do app está
 * errada. Guarda a tela, o motivo e a regra que rodou — nunca o extrato da pessoa. É por aqui
 * que um erro de conta aparece antes de virar pedido de reembolso.
 */
export default async function AdminAvisosPage() {
  await requireAdmin();
  const avisos = await listarRespostasErradas();
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Isso está errado?" subtitle="O que as pessoas marcaram como resposta errada. Só a tela, o motivo e a regra: nenhum dado do extrato." />
      {avisos.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink">Nenhum aviso ainda.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {avisos.map((a) => {
            const dados = (a.dados ?? {}) as { motivo?: string; texto?: string; regra?: string };
            return (
              <Card key={a.id} className="flex flex-col gap-1 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{a.descricao}</p>
                  <p className="text-caption text-ink-faint">{quando.format(a.createdAt)}</p>
                </div>
                <p className="text-sm text-ink">{dados.motivo}</p>
                {dados.texto && <p className="text-sm text-ink-muted">&ldquo;{dados.texto}&rdquo;</p>}
                {dados.regra && <p className="text-caption text-ink-faint">Regra: {dados.regra}</p>}
                <p className="text-caption text-ink-faint">{a.user.name ?? ""} · {a.user.email}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
