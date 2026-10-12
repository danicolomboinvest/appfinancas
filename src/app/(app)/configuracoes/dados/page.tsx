import { ExportCsvButton, ExportAssetsCsvButton } from "./ExportCsvButton";

/**
 * Exportar (protótipo, #configuracoes-exportar): duas linhas, lançamentos e carteira em CSV.
 * Apagar a conta mora em /configuracoes/apagar.
 */
export default function ExportarPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="titulo-tema text-2xl font-medium text-ink">Exportar</h1>
      <div className="overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] [&>*+*]:border-t [&>*+*]:border-border">
        <ExportCsvButton />
        <ExportAssetsCsvButton />
      </div>
    </div>
  );
}
