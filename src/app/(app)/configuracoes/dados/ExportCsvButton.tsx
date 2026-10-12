"use client";

import { useState, useTransition } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { exportEntriesCsvAction, exportAssetsCsvAction } from "./actions";

/** Uma linha de exportação (protótipo): ícone, título, o que vem no arquivo e a seta. Toca e baixa o CSV. */
function CsvDownloadButton({
  label,
  sub,
  filePrefix,
  fetchCsv,
}: {
  label: string;
  sub: string;
  filePrefix: string;
  fetchCsv: () => Promise<string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { titulos: t } = useProfileTheme().voz;

  function handleExport() {
    setError(null);
    startTransition(async () => {
      try {
        const csv = await fetchCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setError(t.cfgExportFalhou);
      }
    });
  }

  return (
    <div>
      <button type="button" onClick={handleExport} disabled={isPending} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
          <FileText size={18} strokeWidth={1.7} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-medium text-ink">{label}</b>
          <small className="text-[13px] text-ink-muted">{isPending ? t.cfgExportando : sub}</small>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
      </button>
      {error && <p className="px-4 pb-3 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ExportCsvButton() {
  return <CsvDownloadButton label="Exportar lançamentos (CSV)" sub="Todos os lançamentos, em CSV." filePrefix="lancamentos" fetchCsv={exportEntriesCsvAction} />;
}

export function ExportAssetsCsvButton() {
  return <CsvDownloadButton label="Exportar carteira (CSV)" sub="Todos os ativos da carteira, em CSV." filePrefix="carteira" fetchCsv={exportAssetsCsvAction} />;
}
