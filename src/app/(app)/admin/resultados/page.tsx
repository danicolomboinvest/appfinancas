import { requireAdmin } from "@/lib/auth/rbac";
import { getCommunityResults, frasesDosResultados, MIN_AMOSTRA, TETO_LANCAMENTO_CONFIAVEL, type ResultadoNumero } from "@/lib/repositories/community-results.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { serverMoney } from "@/lib/money-server";
import { CopiarFrase } from "./CopiarFrase";

export const metadata = { title: "Resultados da comunidade · SPI Finance" };

/**
 * "Olha o que a galera que usa o SPI Finance fez": os números do conjunto, pra Dani poder
 * mostrar resultado sem pedir depoimento a ninguém.
 *
 * Tudo aqui é agregado e anônimo, e nenhum número sai de um grupo com menos de MIN_AMOSTRA
 * pessoas — com três alunas, "guardaram R$ 12.000" conta a vida de alguém que ela sabe quem é.
 * Também não existe "a que mais guardou": extremo individual é uma pessoa só, com outro nome.
 */
export default async function AdminResultadosPage() {
  await requireAdmin();
  const money = await serverMoney();
  const r = await getCommunityResults();
  const frases = frasesDosResultados(r, (n) => money(n, { round: true }));

  const faltaGente = (n: ResultadoNumero) => `Aparece com ${MIN_AMOSTRA}+ pessoas (hoje: ${n.pessoas})`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Resultados da comunidade"
        subtitle="O que as pessoas que usam o app conseguiram, em número e sem nome. Para mostrar resultado sem precisar de depoimento."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Para copiar e mostrar</h2>
        {frases.length === 0 ? (
          <Card className="p-4 text-sm text-ink-muted">
            Ainda não há gente suficiente com mês fechado para gerar um número que dê pra publicar sem expor ninguém.
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {frases.map((f) => (
              <li key={f} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                <p className="text-sm leading-relaxed text-ink">{f}</p>
                <CopiarFrase frase={f} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption text-ink-faint">
          Os números saem de meses fechados: o mês corrente fica de fora, porque ainda está acontecendo. Só entram meses
          com entradas <em>e</em> gastos lançados, e o tamanho da amostra vai sempre junto — ninguém pode ler
          &ldquo;78%&rdquo; achando que são 78% de 500 pessoas.
        </p>
        <p className="text-caption text-ink-faint">
          Um cuidado ao publicar a taxa de poupança: ela tende a sair otimista enquanto muita gente ainda lança a renda
          inteira e só parte dos gastos. É número real do que está registrado, não uma projeção — mas se alguém
          perguntar como foi medido, é essa a resposta honesta.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Quanto a comunidade guardou</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Guardado no total"
            value={r.totalGuardado.valor === null ? "—" : money(r.totalGuardado.valor)}
            tone="success"
            hint={r.totalGuardado.valor === null ? faltaGente(r.totalGuardado) : `${r.pessoasQueGuardaram} pessoas aportaram`}
          />
          <StatCard
            label="Taxa de poupança típica"
            value={r.taxaPoupancaMediana.valor === null ? "—" : `${Math.round(r.taxaPoupancaMediana.valor * 100)}%`}
            tone="accent"
            hint={
              r.taxaPoupancaMediana.valor === null
                ? faltaGente(r.taxaPoupancaMediana)
                : `mediana de ${r.taxaPoupancaMediana.pessoas} pessoas`
            }
          />
          <StatCard
            label="Melhoraram a poupança"
            value={r.melhoraram.valor === null ? "—" : `${Math.round(r.melhoraram.valor * 100)}%`}
            tone="success"
            hint={r.melhoraram.valor === null ? faltaGente(r.melhoraram) : `de ${r.melhoraram.pessoas} com 2+ meses`}
          />
          <StatCard
            label="Guardado para metas"
            value={r.guardadoEmMetas.valor === null ? "—" : money(r.guardadoEmMetas.valor)}
            hint={r.guardadoEmMetas.valor === null ? faltaGente(r.guardadoEmMetas) : `${r.guardadoEmMetas.pessoas} pessoas com meta`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">O tamanho da base</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Contas" value={String(r.totalContas)} />
          <StatCard label="Ativas em 30 dias" value={String(r.ativas30d)} tone="success" />
          <StatCard label="Dinheiro organizado" value={money(r.totalOrganizado)} hint={`${r.lancamentos} lançamentos`} />
          <StatCard label="Meses fechados no app" value={String(r.mesesConsiderados)} />
        </div>
        <p className="text-caption text-ink-faint">
          &ldquo;Dinheiro organizado&rdquo; é a soma de tudo que passou pelo app — entradas, gastos e aportes. Não é
          patrimônio nem economia: é o volume que as pessoas colocaram pra dentro pra enxergar.
        </p>
      </section>

      {r.contasForaDaConta > 0 && (
        <Card className="border-danger/30 bg-danger-soft/30 p-4">
          <p className="text-sm font-medium text-ink">
            {r.contasForaDaConta} conta{r.contasForaDaConta === 1 ? "" : "s"} ficaram de fora destes números
          </p>
          <p className="text-caption text-ink-muted">
            São contas com sinal de extrato lido errado na importação: lançamento acima de{" "}
            {money(TETO_LANCAMENTO_CONFIAVEL, { round: true })} (valor com a vírgula perdida) ou uma leva inteira de
            lançamentos em que nada é saída (fatura de cartão que entrou como renda). Elas distorceriam tudo. Vale olhar
            essas contas uma a uma: para a pessoa dona delas, o app inteiro está mostrando número errado.
          </p>
        </Card>
      )}

      <p className="text-caption text-ink-faint">
        Nenhum número aqui sai de um grupo com menos de {MIN_AMOSTRA} pessoas, e não existe recorde individual: com
        grupo pequeno ou extremo, o &ldquo;anônimo&rdquo; deixa de ser anônimo pra quem conhece as alunas.
      </p>
    </div>
  );
}
