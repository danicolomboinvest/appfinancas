import { requireAdmin } from "@/lib/auth/rbac";
import { getPlatformReport } from "@/lib/repositories/admin-analytics.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatBRL, formatPercentNumber } from "@/lib/format";

export const metadata = { title: "Relatório da plataforma · SPI Finance" };

export default async function AdminRelatorioPage() {
  await requireAdmin();
  const report = await getPlatformReport();
  const { engagement: e, featureAdoption, simulators, sheets, financial: f } = report;

  const maxSignup = Math.max(1, ...e.signupsByWeek.map((w) => w.count));
  const maxSim = Math.max(1, ...simulators.map((s) => s.count));

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Relatório da plataforma"
        subtitle="Engajamento, o que a galera mais usa (e o que não usa) e o resultado financeiro da base. Para decidir o que melhorar."
      />

      {/* ENGAJAMENTO */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Engajamento</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Usuários cadastrados" value={String(e.totalUsers)} hint={`${e.nuncaVoltou} nunca abriram o app`} />
          <StatCard label="Ativos nas últimas 24h" value={String(e.active24h)} tone="success" />
          <StatCard label="Ativos nos últimos 7 dias" value={String(e.active7d)} tone="success" hint={pctOf(e.active7d, e.totalUsers)} />
          <StatCard label="Ativos nos últimos 30 dias" value={String(e.active30d)} tone="accent" hint={pctOf(e.active30d, e.totalUsers)} />
        </div>

        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink">Novos cadastros por semana</p>
            <p className="text-xs text-ink-faint">
              {e.newUsers7d} nos últimos 7 dias · {e.newUsers30d} nos últimos 30
            </p>
          </div>
          <div className="mt-4 flex items-end gap-2" style={{ height: 96 }}>
            {e.signupsByWeek.map((w, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-ink-muted">{w.count > 0 ? w.count : ""}</span>
                <div
                  className="w-full rounded-t bg-accent/70"
                  style={{ height: `${Math.max(2, (w.count / maxSignup) * 72)}px` }}
                  title={`Semana de ${w.weekLabel}: ${w.count} cadastro(s)`}
                />
                <span className="text-[10px] text-ink-faint">{w.weekLabel}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ADOÇÃO POR FUNCIONALIDADE */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight text-ink">O que a galera usa</h2>
        <Card className="flex flex-col gap-3 p-4">
          {featureAdoption.map((feat) => (
            <div key={feat.key} className="flex items-center gap-3">
              <div className="w-44 shrink-0 text-sm text-ink">{feat.label}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-surface-2">
                <div
                  className="h-full rounded bg-accent/70"
                  style={{ width: `${feat.percent}%` }}
                  title={`${feat.users} de ${e.totalUsers} usuários`}
                />
              </div>
              <div className="w-28 shrink-0 text-right text-sm text-ink-muted">
                {feat.users} <span className="text-ink-faint">({formatPercentNumber(feat.percent, 0)})</span>
              </div>
            </div>
          ))}
          <p className="mt-1 text-xs text-ink-faint">
            % de usuários que já criaram algo em cada área. O topo é o que mais engaja; o fim da lista é candidato a
            simplificar, dar destaque ou repensar.
          </p>
        </Card>
      </section>

      {/* SIMULADORES E FICHAS */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm font-medium text-ink">Simuladores mais rodados</p>
          {simulators.length === 0 && <p className="text-sm text-ink-faint">Ninguém rodou simuladores ainda.</p>}
          {simulators.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-sm text-ink">{s.label}</div>
              <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2">
                <div className="h-full rounded bg-info/70" style={{ width: `${(s.count / maxSim) * 100}%` }} />
              </div>
              <div className="w-8 shrink-0 text-right text-sm text-ink-muted">{s.count}</div>
            </div>
          ))}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm font-medium text-ink">Fichas de análise criadas</p>
          {sheets.length === 0 && <p className="text-sm text-ink-faint">Nenhuma ficha criada ainda.</p>}
          {sheets.map((s) => (
            <div key={s.label} className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
              <span className="text-ink">{s.label}</span>
              <span className="text-ink-muted">{s.count}</span>
            </div>
          ))}
        </Card>
      </section>

      {/* RESULTADO FINANCEIRO */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Resultado da galera</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Estão poupando" value={String(f.poupando)} tone="success" hint="Poupança média mensal positiva" />
          <StatCard label="No vermelho" value={String(f.noVermelho)} tone="danger" hint="Gastam mais do que ganham" />
          <StatCard
            label="Poupança mediana/mês"
            value={formatBRL(f.poupancaMediana)}
            hint={f.taxaPoupancaMedia != null ? `Taxa média: ${formatPercentNumber(f.taxaPoupancaMedia * 100, 0)}` : undefined}
          />
          <StatCard label="Patrimônio total da base" value={formatBRL(f.patrimonioTotal)} tone="accent" />
        </div>
        <p className="text-xs text-ink-faint">
          {f.semDados} usuário(s) ainda sem lançamentos, fora do cálculo de poupança. Mediana em vez de média para não
          distorcer com poucos casos extremos.
        </p>
      </section>
    </div>
  );
}

function pctOf(part: number, total: number): string | undefined {
  if (total <= 0) return undefined;
  return `${formatPercentNumber((part / total) * 100, 0)} da base`;
}
