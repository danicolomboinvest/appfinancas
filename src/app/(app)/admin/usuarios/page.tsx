import Link from "next/link";
import { requireAdmin } from "@/lib/auth/rbac";
import { getAdminOverview, type AdminUserSort } from "@/lib/repositories/admin-metrics.repo";
import { getFeatureAdoption, getProfileAdoption, type ProfileAdoptionRow } from "@/lib/repositories/admin-analytics.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatPercentNumber } from "@/lib/format";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import { serverMoney } from "@/lib/money-server";

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
  const money = await serverMoney();
  await requireAdmin();
  const searchParams = await props.searchParams;
  const sortParam = firstOf(searchParams.sort);
  const sort: AdminUserSort = SORT_KEYS.includes(sortParam as AdminUserSort) ? (sortParam as AdminUserSort) : "patrimonio";

  const [{ users, totals }, { features }, { totalPerfis, temas, tipos }] = await Promise.all([
    getAdminOverview(sort),
    getFeatureAdoption(),
    getProfileAdoption(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Usuários"
        subtitle="Mapa dos cadastrados: patrimônio investido e capacidade de poupança. Use para priorizar contato comercial. Ordene clicando nas colunas."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usuários cadastrados" value={String(totals.totalUsuarios)} hint={`${totals.comCarteira} com carteira registrada`} />
        <StatCard label="Patrimônio investido (todos)" value={money(totals.patrimonioTotal)} tone="accent" />
        <StatCard label="Poupança/mês somada" value={money(totals.poupancaMediaMensalSomada)} tone="success" hint="Soma da média mensal de cada um" />
        <StatCard
          label="Ticket médio de patrimônio"
          value={money(totals.comCarteira > 0 ? totals.patrimonioTotal / totals.comCarteira : 0)}
          hint="Entre quem tem carteira"
        />
      </div>

      {/* O que a base mais usa: % de usuários com ao menos um registro em cada área, do mais
          pro menos adotado. Mesmo número que o Relatório da plataforma mostra — aqui fica ao
          lado de quem são as pessoas, pra quem está olhando lead já ver o que o app entrega. */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-ink">O que estão mais usando</p>
          <p className="text-xs text-ink-faint">% dos {totals.totalUsuarios} usuários com dado criado em cada área</p>
        </div>
        <AdoptionBars rows={features.map((f) => ({ key: f.key, label: f.label, perfis: f.users, percent: f.percent }))} unidade="usuários" />
        <p className="mt-1 text-xs text-ink-faint">
          O topo é o que mais prende a pessoa; o fim da lista é candidato a simplificar ou dar mais destaque.
        </p>
      </Card>

      {/* Quais TEMAS de personalidade (Girly, Game, Disciplina…) e quais TIPOS de perfil
          (Pessoal, Empresa, Casal…) as pessoas estão escolhendo. A unidade aqui é o PERFIL,
          não o usuário — cada perfil carrega o próprio tema e tipo. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink">Temas mais usados</p>
            <p className="text-xs text-ink-faint">{totalPerfis} perfis</p>
          </div>
          <AdoptionBars rows={temas} unidade="perfis" />
          <p className="mt-1 text-xs text-ink-faint">
            Inclui o &ldquo;Padrão&rdquo; que todo perfil já nasce com, sem a pessoa ter escolhido — é a base de
            comparação pros outros temas.
          </p>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink">Tipos de perfil</p>
            <p className="text-xs text-ink-faint">{totalPerfis} perfis</p>
          </div>
          <AdoptionBars rows={tipos} unidade="perfis" />
        </Card>
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
                  {u.phone ? (
                    <a
                      href={whatsappUrl(u.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-success hover:underline"
                    >
                      {formatPhone(u.phone)} · WhatsApp
                    </a>
                  ) : (
                    <div className="text-xs text-ink-faint">sem celular</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">{money(u.patrimonioInvestido)}</td>
                <td className={`px-4 py-3 text-right ${u.poupancaMediaMensal < 0 ? "text-danger" : "text-ink"}`}>
                  {money(u.poupancaMediaMensal)}
                </td>
                <td className="px-4 py-3 text-right text-ink-muted">
                  {u.taxaPoupanca == null ? "—" : formatPercentNumber(u.taxaPoupanca * 100, 0)}
                </td>
                <td className="px-4 py-3 text-right text-ink-muted">{money(u.aporteMedioMensal)}</td>
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

/** Lista de barras horizontais (label · barra · nº absoluto e %), o mesmo desenho usado pros
 * três rankings desta página (funcionalidades, temas, tipos de perfil) — um componente só pra
 * não repetir o mesmo JSX três vezes. */
function AdoptionBars({ rows, unidade }: { rows: ProfileAdoptionRow[]; unidade: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-faint">Sem dados ainda.</p>;
  return (
    <>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <div className="w-44 shrink-0 text-sm text-ink">{row.label}</div>
          <div className="h-5 flex-1 overflow-hidden rounded bg-surface-2">
            <div className="h-full rounded bg-accent/70" style={{ width: `${row.percent}%` }} title={`${row.perfis} ${unidade}`} />
          </div>
          <div className="w-28 shrink-0 text-right text-sm text-ink-muted">
            {row.perfis} <span className="text-ink-faint">({formatPercentNumber(row.percent, 0)})</span>
          </div>
        </div>
      ))}
    </>
  );
}
