import Link from "next/link";
import { ChevronRight, LineChart } from "lucide-react";
import type { SheetType } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema, type Titulos } from "@/lib/profiles/voice";
import { listSheets } from "@/lib/repositories/analysis.repo";
import { listAssets } from "@/lib/repositories/asset.repo";
import { groupLatestSheetPerTicker } from "@/lib/analysis/sheet-history";
import { isLaudo } from "@/lib/analysis/laudo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SHEET_TYPE_META } from "./SheetPage";

const FII_TYPE_LABEL: Record<string, string> = {
  TIJOLO: "Tijolo",
  PAPEL: "Papel",
  HIBRIDO: "Híbrido",
  FUNDO_DE_FUNDOS: "Fundo de Fundos",
};

/** Título e subtítulo de cada tipo, na voz do tema. Mora aqui (e não nas páginas) pra não
 * abrir a sessão duas vezes só pra ler o tema: esta função já tem o ctx na mão. */
const CABECALHO: Record<SheetType, (t: Titulos) => { title: string; subtitle: string }> = {
  STOCK: (t) => ({ title: t.fichasAcoesTitulo, subtitle: t.fichasAcoesSub }),
  FII: (t) => ({ title: t.fichasFiisTitulo, subtitle: t.fichasFiisSub }),
  STOCK_INTL: (t) => ({ title: t.fichasStocksTitulo, subtitle: t.fichasStocksSub }),
  ETF: (t) => ({ title: t.fichasEtfsTitulo, subtitle: t.fichasEtfsSub }),
};

/**
 * A lista de análises de um tipo: cards com a resposta já na linha (os três sinais), um selo
 * "na sua carteira" pra ligar a análise ao que a pessoa já tem, e a data da última leitura.
 * A tabela de antes mostrava "Nota geral —" pra quase todo mundo, porque a nota dependia de
 * a pessoa dar 0–10 em 22 critérios.
 */
export async function SheetListPage({ sheetType, createForm }: { sheetType: SheetType; createForm: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const [sheets, assets] = await Promise.all([listSheets(ctx, sheetType), listAssets(ctx)]);
  const groups = groupLatestSheetPerTicker(sheets);
  const owned = new Set(assets.map((a) => (a.ticker ?? a.name).trim().toUpperCase()));
  const meta = SHEET_TYPE_META[sheetType];
  const { title, subtitle } = CABECALHO[sheetType](t);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} subtitle={subtitle} />

      {createForm}

      {groups.length === 0 ? (
        <EmptyState icon={LineChart} message={t.fichasAnalisesVazio} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-caption text-ink-faint">{t.fichasSuasAnalises}</p>
          {groups.map(({ latest: sheet, previousCount }) => {
            const laudo = isLaudo(sheet.laudo) ? sheet.laudo : null;
            const naCarteira = owned.has(sheet.ticker.trim().toUpperCase());
            const lida = sheet.laudoReadAt ?? null;
            return (
              <Link
                key={sheet.id}
                href={`${meta.basePath}/${sheet.id}`}
                className="block transition-opacity hover:opacity-90"
              >
                <Card className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-bold text-ink">{sheet.ticker.toUpperCase()}</span>
                      {naCarteira && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                          {t.fichasNaCarteira}
                        </span>
                      )}
                      {sheet.fiiType && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                          {FII_TYPE_LABEL[sheet.fiiType] ?? sheet.fiiType}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-caption text-ink-muted">
                      {sheet.companyName ? `${sheet.companyName} · ` : ""}
                      {lida ? t.fichasLidaEm(lida.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })) : t.fichasNaoLida}
                      {previousCount > 0 && ` · ${t.fichasAnteriores(previousCount)}`}
                    </p>
                  </div>
                  {laudo ? (
                    <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
                      <span className="text-success">{laudo.counts.favoravel}</span>
                      <span className="text-ink-muted">{laudo.counts.neutro}</span>
                      <span className="text-danger">{laudo.counts.atencao}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-caption text-ink-faint">—</span>
                  )}
                  <ChevronRight size={16} className="shrink-0 text-ink-faint" />
                </Card>
              </Link>
            );
          })}
          <p className="px-1 text-caption text-ink-faint">
            <span className="text-success">●</span> {t.fichasLegenda.favoravel} · <span className="text-ink-muted">●</span>{" "}
            {t.fichasLegenda.neutro} · <span className="text-danger">●</span> {t.fichasLegenda.atencao}
          </p>
        </div>
      )}
    </div>
  );
}
