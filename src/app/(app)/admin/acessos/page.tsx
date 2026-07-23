import { requireAdmin } from "@/lib/auth/rbac";
import { listAllowedEmails } from "@/lib/repositories/allowedEmail.repo";
import { listAllowedProducts } from "@/lib/repositories/allowedProduct.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddEmailsForm } from "./AddEmailsForm";
import { ProductsSection } from "./ProductsSection";
import { RowActions } from "./RowActions";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AdminAcessosPage() {
  await requireAdmin();
  const [emails, products] = await Promise.all([listAllowedEmails(), listAllowedProducts()]);
  const active = emails.filter((e) => e.active).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Acessos"
        subtitle="Quem pode criar conta e entrar no app. O acesso é fechado: só e-mails desta lista (e ativos) entram. Compras dos produtos liberados no Hubla entram sozinhas."
      />

      <ProductsSection products={products} />

      <AddEmailsForm />

      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 text-sm text-ink-muted">
          <span>
            {emails.length} e-mail{emails.length === 1 ? "" : "s"} na lista · {active} ativo{active === 1 ? "" : "s"}
          </span>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Anotação</th>
              <th className="px-4 py-3 font-medium">Liberado em</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                  Nenhum e-mail liberado ainda. Cole a lista de compradores acima para liberar o acesso.
                </td>
              </tr>
            )}
            {emails.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-border/60 last:border-0 hover:bg-surface-2/40 ${!entry.active ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 text-ink">{entry.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={entry.source === "HUBLA" ? "accent" : "info"}>
                    {entry.source === "HUBLA" ? "Hubla" : "Manual"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink-muted">{entry.note ?? "—"}</td>
                <td className="px-4 py-3 text-ink-muted">{dateFmt.format(entry.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={entry.active ? "success" : "neutral"}>{entry.active ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <RowActions id={entry.id} active={entry.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
