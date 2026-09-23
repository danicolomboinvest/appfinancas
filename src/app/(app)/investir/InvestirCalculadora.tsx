"use client";

import { useMemo, useState } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import { simularInvestimentoNaEmpresa } from "@/lib/simulators/investir-na-empresa";

/**
 * A calculadora "vale a pena investir na empresa?": tudo no cliente, recalcula a cada tecla.
 * A margem de contribuição e a taxa de comparação já vêm preenchidas com o que o app sabe
 * da empresa; a pessoa só digita quanto custa e quanto espera que renda.
 */
export function InvestirCalculadora({ margemInicial, taxaInicial }: { margemInicial: number; taxaInicial: number }) {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
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
    vale: { titulo: t.invVeredictoValeTitulo, cor: "text-success", fundo: "border-success/30 bg-success-soft/40", texto: t.invVeredictoValeTexto(r.paybackMeses ?? 0) },
    empata: { titulo: t.invVeredictoEmpataTitulo, cor: "text-accent-strong", fundo: "border-accent/30 bg-accent-soft/40", texto: t.invVeredictoEmpataTexto(r.paybackMeses ?? 0) },
    "nao-vale": {
      titulo: t.invVeredictoNaoValeTitulo,
      cor: "text-danger",
      fundo: "border-danger/30 bg-danger-soft/40",
      texto: r.paybackMeses !== null && r.paybackMeses > horizonte ? t.invVeredictoNaoValeTextoForaDoPrazo(r.paybackMeses, horizonte) : t.invVeredictoNaoValeTextoRendeMais,
    },
    "nunca-se-paga": { titulo: t.invVeredictoNuncaSePagaTitulo, cor: "text-danger", fundo: "border-danger/30 bg-danger-soft/40", texto: t.invVeredictoNuncaSePagaTexto },
  }[r.veredito];

  const compacto = (v: number) => money(v, { round: true }).replace(/,\d\d$/, "");

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start lg:gap-6">
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <CurrencyField label={t.invCusto} name="investimento" defaultValue={investimento} onValueChange={setInvestimento} hint={t.invCustoHint} />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">{t.invTipoLabel}</span>
          <div className="flex gap-1.5">
            {(["venda", "economia"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setTipo(opcao)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${tipo === opcao ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"}`}
              >
                {opcao === "venda" ? t.invTipoVenda : t.invTipoEconomia}
              </button>
            ))}
          </div>
        </div>

        <CurrencyField
          label={tipo === "venda" ? t.invReceitaLabelVenda : t.invReceitaLabelEconomia}
          name="receitaMensal"
          defaultValue={receitaMensal}
          onValueChange={setReceitaMensal}
          hint={tipo === "venda" ? t.invReceitaHintVenda : t.invReceitaHintEconomia}
        />

        {tipo === "venda" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">{t.invMargemLabel}</span>
            <div className="relative">
              <input type="number" inputMode="decimal" min={0} max={100} step={1} value={margemPct} onChange={(e) => setMargemPct(Number(e.target.value))} className={`${CONTROL_CLASSES} w-full pr-7`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">%</span>
            </div>
            <span className="text-caption text-ink-faint">{t.invMargemHint}</span>
          </label>
        )}

        <CurrencyField label={t.invCustoMensal} name="custoMensal" defaultValue={custoMensal} onValueChange={setCustoMensal} hint={t.invCustoMensalHint} />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">{t.invPrazoLabel}</span>
            <div className="relative">
              <input type="number" inputMode="numeric" min={1} max={120} step={1} value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))} className={`${CONTROL_CLASSES} w-full pr-14`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">meses</span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">{t.invTaxaLabel}</span>
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
          <p className="text-caption font-semibold uppercase tracking-wider text-ink-muted">{t.invVeredictoEyebrow}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${VEREDITO.cor}`}>{VEREDITO.titulo}</p>
          <p className="mt-1.5 text-sm text-ink">{VEREDITO.texto}</p>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo={t.invGanhoMes} valor={money(r.ganhoMensal, { round: true })} tom={r.ganhoMensal > 0 ? "success" : "danger"} nota={t.invGanhoMesNota} />
          <Numero rotulo={t.invSePagaEm} valor={r.paybackMeses === null ? t.invSePagaNunca : `${r.paybackMeses} ${r.paybackMeses === 1 ? "mês" : "meses"}`} tom={r.paybackMeses !== null && r.paybackMeses <= horizonte ? "success" : "danger"} nota={t.invSePagaNota} />
          <Numero rotulo={t.invResultadoEm(horizonte)} valor={money(r.resultadoNoHorizonte, { round: true })} tom={r.resultadoNoHorizonte >= 0 ? "success" : "danger"} nota={t.invResultadoNota(Math.round(r.retorno * 100))} />
          <Numero rotulo={t.invNaAplicacao} valor={money(r.rendimentoDaAplicacao, { round: true })} tom="neutral" nota={t.invNaAplicacaoNota(taxaPct)} />
        </div>

        <Card className="p-4 sm:p-5">
          <p className="text-[15px] font-semibold text-ink">{t.invGraficoTitulo}</p>
          <p className="mt-0.5 text-caption text-ink-faint">
            A linha da empresa começa negativa (o dinheiro saiu) e sobe com o ganho mensal. A da aplicação é o rendimento do mesmo dinheiro parado.{" "}
            {r.mesEmQueSupera !== null ? t.invGraficoDescSupera(r.mesEmQueSupera) : t.invGraficoDescNaoSupera}
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
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v, nome) => [money(Number(v)), nome === "naEmpresa" ? t.invGraficoLegendaEmpresa : t.invGraficoLegendaAplicacao]} labelFormatter={(l) => `Mês ${l}`} />
                <Area type="monotone" dataKey="naEmpresa" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#empresaGrad)" dot={false} />
                <Line type="monotone" dataKey="naAplicacao" stroke={CHART_COLORS.accentStrong} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {r.receitaNecessariaParaSePagar !== null && tipo === "venda" && (
          <p className="text-sm text-ink-muted">
            {t.invReceitaNecessariaAntes(horizonte)}
            <span className="font-semibold text-ink">{money(r.receitaNecessariaParaSePagar, { round: true })}</span>
            {t.invReceitaNecessariaDepois}
            {receitaMensal < r.receitaNecessariaParaSePagar ? t.invReceitaAbaixo : t.invReceitaAcima}
          </p>
        )}
        <p className="text-caption text-ink-faint">{t.invRodapeNota}</p>
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
