import Link from "next/link";
import { requireAdmin } from "@/lib/auth/rbac";
import { getAdminOverview, type AdminUserSort } from "@/lib/repositories/admin-metrics.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatBRL, formatPercentNumber } from "@/lib/format";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const SORT_KEYS: AdminUserSort[] = ["patrimonio", "poupanca", "aporte", "recente"];

function firstOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Cabeçalho de coluna clicável que reordena a tabela via ?sort= na URL. */
function SortHeader({ label, sortKey, active, className = "" }: { label: string; sortKey: AdminUserSort; active: boolean; className?: string }) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <Link
        href={`/admin/usuarios?sort=${sortKey}`}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? "text-accent-strong" : ""}`}
      >
        {label}
        {active && <span aria-hidden>↓</span>}
      </Link>
    </th>
  );
}

export default async function AdminUsuariosPage(props: PageProps<"/admin/usuarios">) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const sortParam = firstOf(searchParams.sort);
  const sort: AdminUserSort = SORT_KEYS.includes(sortParam as AdminUserSort) ? (sortParam as AdminUserSort) : "patrimonio";

  const { users, totals } = await getAdminOverview(sort);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Usuários"
        subtitle="Mapa dos cadastrados: patrimônio investido e capacidade de poupança. Use para priorizar contato comercial. Ordene clicando nas colunas."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usuários cadastrados" value={String(totals.totalUsuarios)} hint={`${totals.comCarteira} com carteira registrada`} />
        <StatCard label="Patrimônio investido (todos)" value={formatBRL(totals.patrimonioTotal)} tone="accent" />
        <StatCard label="Poupança/mês somada" value={formatBRL(totals.poupancaMediaMensalSomada)} tone="success" hint="Soma da média mensal de cada um" />
        <StatCard
          label="Ticket médio de patrimônio"
          value={formatBRL(totals.comCarteira > 0 ? totals.patrimonioTotal / totals.comCarteira : 0)}
          hint="Entre quem tem carteira"
        />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <SortHeader label="Patrimônio investido" sortKey="patrimonio" active={sort === "patrimonio"} className="text-right" />
              <SortHeader label="Poupança/mês" sortKey="poupanca" active={sort === "poupanca"} className="text-right" />
              <th className="px-4 py-3 text-right font-medium">Taxa de poupança</th>
              <SortHeader label="Aporte/mês" sortKey="aporte" active={sort === "aporte"} className="text-right" />
              <th className="px-4 py-3 text-center font-medium">Meses</th>
              <SortHeader label="Últ. atividade" sortKey="recente" active={sort === "recente"} className="text-right" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <div className="text-ink">{u.name ?? "—"}</div>
                  <div className="text-xs text-ink-faint">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">{formatBRL(u.patrimonioInvestido)}</td>
                <td className={`px-4 py-3 text-right ${u.poupancaMediaMensal < 0 ? "text-danger" : "text-ink"}`}>
                  {formatBRL(u.poupancaMediaMensal)}
                </td>
                <td className="px-4 py-3 text-right text-ink-muted">
                  {u.taxaPoupanca == null ? "—" : formatPercentNumber(u.taxaPoupanca * 100, 0)}
                </td>
                <td className="px-4 py-3 text-right text-ink-muted">{formatBRL(u.aporteMedioMensal)}</td>
                <td className="px-4 py-3 text-center text-ink-muted">{u.mesesAtivos}</td>
                <td className="px-4 py-3 text-right text-ink-muted">
                  {u.ultimoLancamento ? dateFmt.format(u.ultimoLancamento) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-ink-faint">
        Patrimônio = valor atual da carteira. Poupança/mês = (renda − despesa) média dos meses com movimentação. Aporte/mês
        = quanto foi de fato para investimentos. As médias ignoram meses sem lançamento.
      </p>
    </div>
  );
}
