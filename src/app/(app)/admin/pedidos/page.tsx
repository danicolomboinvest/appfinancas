import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { MESES_GRATIS, MOTIVOS } from "@/lib/cancelar/regras";
import { MarcarFeito } from "./MarcarFeito";

export const metadata = { title: "Antes de cancelar · SPI Finance" };

const TIPO: Record<string, string> = {
  meses_gratis: `${MESES_GRATIS} meses grátis (entraram sozinhos no prazo do acesso)`,
  duvida: "Dúvida (respondida na hora pelo passo a passo)",
  contestacao: "Algo não está certo: responder em até 48 horas",
  aviso_renovacao: "Aviso 7 dias antes da renovação (sai sozinho)",
  aviso_reembolso: "Lembrete do prazo de reembolso (sai sozinho)",
  conversa: "Quer falar com a equipe",
};
const ESCOLHA: Record<string, string> = { aceitou_oferta: "ficou com a ajuda", foi_cancelar: "foi cancelar", abriu_hubla: "abriu a Hubla", abriu_apple: "abriu a Apple" };

/**
 * O registro do "antes de cancelar" (tudo automático, decisão da Dani em 11/10): os meses grátis,
 * as dúvidas respondidas, os avisos e a fila do "algo não está certo", com os dados para o
 * diagnóstico. Em cima, os motivos dos últimos 60 dias, para medir qual ajuda segura.
 */
export default async function AdminPedidosPage() {
  await requireAdmin();
  const desde = new Date(nowInBrazil().getTime() - 60 * 86_400_000);
  const [pedidos, motivos] = await Promise.all([
    prisma.pedidoAntesDeCancelar.findMany({ orderBy: [{ estado: "asc" }, { createdAt: "desc" }], take: 200, include: { user: { select: { name: true, email: true } } } }),
    prisma.motivoDeCancelamento.groupBy({ by: ["motivo", "escolha"], where: { createdAt: { gte: desde } }, _count: { _all: true } }),
  ]);
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const rotulo = (m: string) => (m === "reembolso" ? "Nos 7 dias do reembolso" : MOTIVOS.find((x) => x.chave === m)?.rotulo ?? "Sem motivo");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Antes de cancelar" subtitle="Os pedidos para a equipe e os motivos de quem abriu o cancelar." />
      <Card className="flex flex-col gap-2 p-5">
        <p className="text-sm font-semibold text-ink">Motivos dos últimos 60 dias</p>
        {motivos.length === 0 ? (
          <p className="text-sm text-ink-muted">Ninguém abriu o cancelar ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {motivos.map((m) => (
              <li key={`${m.motivo}${m.escolha}`} className="flex justify-between gap-3">
                <span>
                  {rotulo(m.motivo)}, {ESCOLHA[m.escolha] ?? m.escolha}
                </span>
                <span className="tabular-nums">{m._count._all}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {pedidos.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink">Nenhum pedido ainda.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <Card key={p.id} className="flex flex-col gap-1.5 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{TIPO[p.tipo] ?? p.tipo}</p>
                <p className="text-caption text-ink-faint">{quando.format(p.createdAt)}</p>
              </div>
              <p className="text-sm text-ink">
                {p.user.name ?? ""} {p.user.email}
              </p>
              {p.area && <p className="text-sm text-ink-muted">Onde: {p.area}</p>}
              {p.assunto && <p className="text-sm text-ink-muted">Assunto achado: {p.assunto}</p>}
              {p.tipo === "contestacao" && p.dados && <p className="break-all text-caption text-ink-faint">Diagnóstico: {JSON.stringify(p.dados)}</p>}
              {p.texto && <p className="whitespace-pre-wrap text-sm text-ink-muted">&ldquo;{p.texto}&rdquo;</p>}
              {p.avisarEm && <p className="text-caption text-ink-faint">E-mail em {p.avisarEm.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>}
              {p.emailEnviadoEm && <p className="text-caption text-ink-faint">E-mail enviado {quando.format(p.emailEnviadoEm)}</p>}
              {p.estado === "feito" ? (
                <p className="text-caption text-success">
                  Feito {p.feitoEm ? quando.format(p.feitoEm) : ""} {p.feitoPor ? `(${p.feitoPor})` : ""}
                </p>
              ) : p.tipo === "contestacao" ? (
                <MarcarFeito id={p.id} />
              ) : (
                <p className="text-caption text-ink-faint">Automático</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
