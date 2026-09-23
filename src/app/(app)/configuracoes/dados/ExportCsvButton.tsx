"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { exportEntriesCsvAction, exportAssetsCsvAction } from "./actions";

/** Botão genérico de exportação: chama a action, baixa o CSV com o prefixo do arquivo. */
function CsvDownloadButton({
  label,
  filePrefix,
  fetchCsv,
}: {
  label: string;
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
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={handleExport} disabled={isPending} className="w-fit">
        <Download size={16} />
        {isPending ? t.cfgExportando : label}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ExportCsvButton() {
  const { titulos: t } = useProfileTheme().voz;
  return <CsvDownloadButton label={t.cfgExportLancamentos} filePrefix="lancamentos" fetchCsv={exportEntriesCsvAction} />;
}

export function ExportAssetsCsvButton() {
  const { titulos: t } = useProfileTheme().voz;
  return <CsvDownloadButton label={t.cfgExportCarteira} filePrefix="carteira" fetchCsv={exportAssetsCsvAction} />;
}
