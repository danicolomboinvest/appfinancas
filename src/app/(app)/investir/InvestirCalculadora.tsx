"use client";

import { useMemo, useState } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/components/money/MoneyProvider";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import { simularInvestimentoNaEmpresa } from "@/lib/simulators/investir-na-empresa";

/**
 * A calculadora "vale a pena investir na empresa?": tudo no cliente, recalcula a cada tecla.
 * A margem de contribuição e a taxa de comparação já vêm preenchidas com o que o app sabe
 * da empresa; a pessoa só digita quanto custa e quanto espera que renda.
 */
export function InvestirCalculadora({ margemInicial, taxaInicial }: { margemInicial: number; taxaInicial: number }) {
  const money = useMoney();
  const [investimento, setInvestimento] = useState(30000);
  const [receitaMensal, setReceitaMensal] = useState(6000);
  const [custoMensal, setCustoMensal] = useState(500);
  const [margemPct, setMargemPct] = useState(Math.round(margemInicial * 100));
  const [horizonte, setHorizonte] = useState(24);
  const [taxaPct, setTaxaPct] = useState(Math.round(taxaInicial * 1000) / 10);
  const [tipo, setTipo] = useState<"venda" | "economia">("venda");

  const r = useMemo(
    () =>
      simularInvestimentoNaEmpresa({
        investimento,
        receitaMensal,
        margem: tipo === "economia" ? 1 : margemPct / 100,
        custoMensal,
        horizonteMeses: horizonte,
        taxaAnualAlternativa: taxaPct / 100,
      }),
    [investimento, receitaMensal, custoMensal, margemPct, horizonte, taxaPct, tipo],
  );

  const VEREDITO = {
    vale: { titulo: "Vale a pena", cor: "text-success", fundo: "border-success/30 bg-success-soft/40", texto: `Se paga em ${r.paybackMeses} ${r.paybackMeses === 1 ? "mês" : "meses"} e rende mais que deixar o dinheiro aplicado.` },
    empata: { titulo: "Empata com a aplicação", cor: "text-accent-strong", fundo: "border-accent/30 bg-accent-soft/40", texto: `Se paga em ${r.paybackMeses} meses, mas o ganho fica parecido com o da aplicação. Decide pelo que o dinheiro faz pela empresa, não pela conta.` },
    "nao-vale": { titulo: "Não vale, por enquanto", cor: "text-danger", fundo: "border-danger/30 bg-danger-soft/40", texto: r.paybackMeses !== null && r.paybackMeses > horizonte ? `Só se paga em ${r.paybackMeses} meses, além dos ${horizonte} que você deu de prazo.` : "Deixar o dinheiro aplicado rende mais do que esse investimento devolve no prazo." },
    "nunca-se-paga": { titulo: "Não se paga", cor: "text-danger", fundo: "border-danger/30 bg-danger-soft/40", texto: "O custo novo por mês come toda a margem que a receita nova traz. Assim o investimento nunca devolve o dinheiro." },
  }[r.veredito];

  const compacto = (v: number) => money(v, { round: true }).replace(/,\d\d$/, "");

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start lg:gap-6">
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <CurrencyField label="Quanto custa o investimento?" name="investimento" defaultValue={investimento} onValueChange={setInvestimento} hint="Máquina, reforma, novo ponto, contratação: o valor à vista." />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">O que ele traz por mês?</span>
          <div className="flex gap-1.5">
            {(["venda", "economia"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${tipo === t ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"}`}
              >
                {t === "venda" ? "Mais vendas" : "Economia de custo"}
              </button>
            ))}
          </div>
        </div>

        <CurrencyField
          label={tipo === "venda" ? "Receita a mais por mês" : "Economia por mês"}
          name="receitaMensal"
          defaultValue={receitaMensal}
          onValueChange={setReceitaMensal}
          hint={tipo === "venda" ? "Quanto você espera vender a mais por causa dele. Seja realista: a média, não o melhor mês." : "Quanto deixa de gastar por mês (energia, terceiro, retrabalho)."}
        />

        {tipo === "venda" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Quanto de cada venda sobra depois dos custos dela</span>
            <div className="relative">
              <input type="number" inputMode="decimal" min={0} max={100} step={1} value={margemPct} onChange={(e) => setMargemPct(Number(e.target.value))} className={`${CONTROL_CLASSES} w-full pr-7`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">%</span>
            </div>
            <span className="text-caption text-ink-faint">A margem de contribuição da sua empresa, pela DRE. Vender mais só vale o que sobra depois de mercadoria, taxa e frete.</span>
          </label>
        )}

        <CurrencyField label="Custo fixo novo por mês" name="custoMensal" defaultValue={custoMensal} onValueChange={setCustoMensal} hint="O que o investimento passa a custar todo mês: manutenção, salário, aluguel maior, software. Zero se não tiver." />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Prazo pra avaliar</span>
            <div className="relative">
              <input type="number" inputMode="numeric" min={1} max={120} step={1} value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))} className={`${CONTROL_CLASSES} w-full pr-14`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">meses</span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Aplicação rende ao ano</span>
            <div className="relative">
              <input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={taxaPct} onChange={(e) => setTaxaPct(Number(e.target.value))} className={`${CONTROL_CLASSES} w-full pr-7`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">%</span>
            </div>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[12, 24, 36, 60].map((m) => (
            <button key={m} type="button" onClick={() => setHorizonte(m)} className={`rounded-full border px-2.5 py-0.5 text-xs ${horizonte === m ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-ink-muted"}`}>
              {m} meses
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <section className={`rounded-2xl border p-4 sm:p-5 ${VEREDITO.fundo}`}>
          <p className="text-caption font-semibold uppercase tracking-wider text-ink-muted">Veredito</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${VEREDITO.cor}`}>{VEREDITO.titulo}</p>
          <p className="mt-1.5 text-sm text-ink">{VEREDITO.texto}</p>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Ganho por mês" valor={money(r.ganhoMensal, { round: true })} tom={r.ganhoMensal > 0 ? "success" : "danger"} nota="já tirando o custo novo" />
          <Numero rotulo="Se paga em" valor={r.paybackMeses === null ? "nunca" : `${r.paybackMeses} ${r.paybackMeses === 1 ? "mês" : "meses"}`} tom={r.paybackMeses !== null && r.paybackMeses <= horizonte ? "success" : "danger"} nota="payback" />
          <Numero rotulo={`Resultado em ${horizonte} meses`} valor={money(r.resultadoNoHorizonte, { round: true })} tom={r.resultadoNoHorizonte >= 0 ? "success" : "danger"} nota={`${Math.round(r.retorno * 100)}% sobre o investido`} />
          <Numero rotulo="Na aplicação, renderia" valor={money(r.rendimentoDaAplicacao, { round: true })} tom="neutral" nota={`${taxaPct}% ao ano, sem IR`} />
        </div>

        <Card className="p-4 sm:p-5">
          <p className="text-[15px] font-semibold text-ink">Na empresa × na aplicação, mês a mês</p>
          <p className="mt-0.5 text-caption text-ink-faint">
            A linha da empresa começa negativa (o dinheiro saiu) e sobe com o ganho mensal. A da aplicação é o rendimento do mesmo dinheiro parado.
            {r.mesEmQueSupera !== null ? ` A empresa passa a aplicação no mês ${r.mesEmQueSupera}.` : " No prazo dado, a aplicação rende mais."}
          </p>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.curva} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="empresaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} />
                <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} width={64} tickFormatter={compacto} />
                <ReferenceLine y={0} stroke={CHART_COLORS.grid} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v, nome) => [money(Number(v)), nome === "naEmpresa" ? "Na empresa" : "Na aplicação"]} labelFormatter={(l) => `Mês ${l}`} />
                <Area type="monotone" dataKey="naEmpresa" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#empresaGrad)" dot={false} />
                <Line type="monotone" dataKey="naAplicacao" stroke={CHART_COLORS.accentStrong} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {r.receitaNecessariaParaSePagar !== null && tipo === "venda" && (
          <p className="text-sm text-ink-muted">
            Pra se pagar dentro de {horizonte} meses, esse investimento precisa trazer pelo menos{" "}
            <span className="font-semibold text-ink">{money(r.receitaNecessariaParaSePagar, { round: true })}</span> de vendas a mais por mês.
            {receitaMensal < r.receitaNecessariaParaSePagar ? " Você estimou menos que isso." : " Você estimou acima disso."}
          </p>
        )}
        <p className="text-caption text-ink-faint">
          Conta simples, sem inflação nem imposto sobre a aplicação, pra dar a ordem de grandeza. Se a decisão for apertada, converse com o contador antes de assinar.
        </p>
      </div>
    </div>
  );
}

function Numero({ rotulo, valor, tom, nota }: { rotulo: string; valor: string; tom: "success" | "danger" | "neutral"; nota?: string }) {
  const cor = tom === "success" ? "text-success" : tom === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="text-caption text-ink-muted">{rotulo}</p>
      <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${cor}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-[11px] text-ink-faint">{nota}</p>}
    </div>
  );
}
