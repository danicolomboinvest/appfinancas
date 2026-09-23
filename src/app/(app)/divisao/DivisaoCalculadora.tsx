"use client";

import { useMemo, useState } from "react";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { dividirDespesasDoCasal } from "@/lib/simulators/divisao-casal";

/**
 * "Quanto cada um contribui?": recalcula a cada tecla, no cliente. Sem servidor no meio
 * porque a conta é simples e a pessoa quer ver o número mudar enquanto ajusta os valores.
 * As despesas comuns já vêm preenchidas com o gasto do mês (dado real); a renda de cada um
 * a pessoa digita, porque o app não sabe quem ganhou quanto dentro do casal.
 *
 * O percentual é sugerido pela proporção da renda (a prática mais recomendada), mas o casal
 * pode já ter combinado outro número — por isso o campo de % é editável: manter em branco
 * segue a sugestão; digitar um valor passa a usar esse valor, mesmo que não seja nem
 * proporcional à renda nem 50/50.
 */
export function DivisaoCalculadora({ despesasComunsInicial }: { despesasComunsInicial: number }) {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [rendaA, setRendaA] = useState(0);
  const [rendaB, setRendaB] = useState(0);
  const [despesasComuns, setDespesasComuns] = useState(despesasComunsInicial);
  /** null = segue a sugestão da renda; número (0–100) = a pessoa digitou o próprio percentual. */
  const [pctBTexto, setPctBTexto] = useState("");

  const pctBManual = pctBTexto.trim() === "" ? undefined : Number(pctBTexto.replace(",", ".")) / 100;
  const r = useMemo(
    () => dividirDespesasDoCasal({ rendaA, rendaB, despesasComuns, pctBManual }),
    [rendaA, rendaB, despesasComuns, pctBManual],
  );
  const semRenda = rendaA === 0 && rendaB === 0;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-6">
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <CurrencyField label={t.casRendaA} name="rendaA" defaultValue={rendaA} onValueChange={setRendaA} hint={t.casRendaAHint} />
        <CurrencyField label={t.casRendaB} name="rendaB" defaultValue={rendaB} onValueChange={setRendaB} hint={t.casRendaBHint} />
        <CurrencyField
          label={t.casDespesas}
          name="despesasComuns"
          defaultValue={despesasComuns}
          onValueChange={setDespesasComuns}
          suggestion={despesasComunsInicial > 0 ? { value: despesasComunsInicial, label: t.casDespesasSugestao(money(despesasComunsInicial, { round: true })) } : undefined}
          hint={t.casDespesasHint}
        />

        {/* Editável de propósito: o app sugere pela renda, mas o casal pode já ter combinado
            outro número — nem proporcional, nem 50/50. Em branco, segue a sugestão. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">{t.casPctLabel}</span>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder={!semRenda ? String(Math.round(r.pctBSugeridoPelaRenda * 100)) : "—"}
              value={pctBTexto}
              onChange={(ev) => setPctBTexto(ev.target.value)}
              className={`${CONTROL_CLASSES} w-full pr-32`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">{t.casPctSufixo}</span>
          </div>
          {r.manual ? (
            <button type="button" onClick={() => setPctBTexto("")} className="w-fit text-xs font-medium text-accent-strong hover:underline">
              {t.casPctVoltar(Math.round(r.pctBSugeridoPelaRenda * 100))}
            </button>
          ) : (
            <span className="text-caption text-ink-faint">{t.casPctDica}</span>
          )}
        </label>
      </Card>

      <div className="flex flex-col gap-4">
        {semRenda ? (
          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <p className="text-sm text-ink-muted">{t.casSemRenda}</p>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-4 sm:p-5">
              <p className="text-caption font-semibold uppercase tracking-wider text-ink-muted">{r.manual ? t.casHeaderManual : t.casHeaderAuto}</p>
              <p className="mt-1 text-sm text-ink">{r.manual ? t.casTextoManual : t.casTextoAuto}</p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <Contribuicao rotulo={t.casContribA} pct={r.pctA} valor={r.contribuicaoA} sobra={r.sobraA} money={money} t={t} />
              <Contribuicao rotulo={t.casContribB} pct={r.pctB} valor={r.contribuicaoB} sobra={r.sobraB} money={money} t={t} />
            </div>

            <Card className="p-4 sm:p-5">
              <p className="text-[15px] font-semibold text-ink">{t.casComparandoTitulo}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {t.casComparandoIgual(money(r.contribuicaoIgual, { round: true }))}{" "}
                {r.diferencaParaB > 0.5
                  ? t.casComparandoMenos(money(r.diferencaParaB, { round: true }))
                  : r.diferencaParaB < -0.5
                    ? t.casComparandoMais(money(-r.diferencaParaB, { round: true }))
                    : t.casComparandoParecido}
              </p>
              {r.manual && <p className="mt-1.5 text-caption text-ink-faint">{t.casComparandoManualNota(Math.round(r.pctBSugeridoPelaRenda * 100))}</p>}
            </Card>

            <p className="text-caption text-ink-faint">{t.casRendaConjunta(money(r.rendaConjunta, { round: true }))}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Contribuicao({
  rotulo,
  pct,
  valor,
  sobra,
  money,
  t,
}: {
  rotulo: string;
  pct: number;
  valor: number;
  sobra: number;
  money: (n: number, o?: { round?: boolean }) => string;
  t: { casContribPct(pct: number): string; casSobraLivre(valor: string): string };
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="text-caption text-ink-muted">{rotulo}</p>
      <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{money(valor, { round: true })}</p>
      <p className="mt-0.5 text-[11px] text-ink-faint">{t.casContribPct(Math.round(pct * 100))}</p>
      <p className="mt-1.5 text-[11px] text-ink-faint">{t.casSobraLivre(money(Math.max(0, sobra), { round: true }))}</p>
    </div>
  );
}
