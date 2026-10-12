import { getRequiredSession } from "@/lib/auth/session";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { CHAVE_CDI, CHAVE_IPCA, CHAVE_SELIC, lerIndicadores } from "@/lib/indicadores/indicadores";
import { getExchangeRate } from "@/lib/fx/rates";
import { formatPercentNumber } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ReferenceRateForm } from "./ReferenceRateForm";
import { DeleteRateButton } from "./DeleteRateButton";

const BASE: Record<string, string> = { ANNUAL_252: "ao ano", ANNUAL_365: "ao ano", MONTHLY: "ao mês" };
const dia = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/**
 * Taxas de referência (protótipo, #configuracoes-taxas): "Do sistema" (CDI, Selic, IPCA e o dólar
 * de hoje, com a fonte e a data), que atualizam sozinhas; "Suas taxas", que valem mais que as do
 * sistema; e o Adicionar com nome e taxa ao ano.
 */
export default async function TaxasDeReferenciaPage() {
  const ctx = await getRequiredSession();
  const [rates, ind, dolar] = await Promise.all([
    listReferenceRates(ctx),
    lerIndicadores([CHAVE_CDI, CHAVE_SELIC, CHAVE_IPCA]),
    getExchangeRate("USD", "BRL").catch(() => null),
  ]);
  const suas = rates.filter((r) => r.userId === ctx.userId);
  const doSistema: { nome: string; valor: string; origem: string }[] = [];
  for (const [chave, nome] of [
    [CHAVE_CDI, "CDI"],
    [CHAVE_SELIC, "Selic"],
    [CHAVE_IPCA, "IPCA"],
  ] as const) {
    const i = ind.get(chave);
    if (i) doSistema.push({ nome, valor: `${formatPercentNumber(i.valor * 100, 2)} ao ano`, origem: `Banco Central · ${dia(i.referenteA)}` });
  }
  if (dolar) doSistema.push({ nome: "Dólar", valor: formatMoney(dolar.rate, "BRL"), origem: `Cotação · ${dia(`${dolar.date}T00:00:00Z`)}` });

  const grupo = "overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]";
  const titulo = "px-1 pt-2 text-[15px] font-medium text-ink";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <h1 className="titulo-tema text-2xl font-medium text-ink">Taxas de referência</h1>
      <p className="-mt-1 text-sm text-ink-muted">Usadas nas metas, nos simuladores e na Carteira.</p>

      <h2 className={titulo}>Do sistema</h2>
      <div className={grupo} data-taxas-sistema>
        {doSistema.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">As taxas ainda não foram buscadas hoje.</p>
        ) : (
          doSistema.map((t) => (
            <div key={t.nome} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-medium text-ink">{t.nome}</b>
                <small className="text-[13px] text-ink-muted">{t.origem}</small>
              </span>
              <em className="shrink-0 not-italic tabular-nums text-ink">{t.valor}</em>
            </div>
          ))
        )}
      </div>
      <p className="px-1 text-xs text-ink-muted">Atualizam sozinhas todo dia útil.</p>

      <h2 className={titulo}>Suas taxas</h2>
      <div className={grupo}>
        {suas.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">Nenhuma ainda. A sua vale mais que a do sistema.</p>
        ) : (
          suas.map((r) => (
            <div key={r.id} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
              <b className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{r.name}</b>
              <em className="shrink-0 not-italic tabular-nums text-ink">
                {formatPercentNumber(Number(r.rateValue) * 100, 2)} {BASE[r.basis]}
              </em>
              <DeleteRateButton id={r.id} />
            </div>
          ))
        )}
      </div>

      <h2 className={titulo}>Adicionar</h2>
      <ReferenceRateForm />
    </div>
  );
}
