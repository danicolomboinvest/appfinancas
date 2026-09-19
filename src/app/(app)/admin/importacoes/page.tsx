import { requireAdmin } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { IMPORT_FILE_RETENTION_DAYS, listStoredImportFiles } from "@/lib/repositories/import-file.repo";

export const metadata = { title: "Importações que falharam · SPI Finance" };

/**
 * Os arquivos que o app não conseguiu ler, pra baixar e ensinar o formato pro leitor.
 *
 * Só aparece aqui o que deu errado: falha total ou leitura pela metade. Importação que deu
 * certo não fica guardada. Tudo apaga sozinho em {IMPORT_FILE_RETENTION_DAYS} dias.
 */
export default async function AdminImportacoesPage() {
  await requireAdmin();
  const arquivos = await listStoredImportFiles();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Importações que falharam"
        subtitle={`Os arquivos que o app não conseguiu ler, pra baixar e consertar o leitor. Apagam sozinhos em ${IMPORT_FILE_RETENTION_DAYS} dias.`}
      />

      {arquivos.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink">Nenhum arquivo guardado. Nenhuma importação falhou no período.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {arquivos.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{a.fileName ?? "(sem nome)"}</p>
                  <p className="truncate text-xs text-ink-faint">{a.email}</p>
                </div>
                <span
                  className={
                    a.reason === "falha"
                      ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                      : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                  }
                >
                  {a.reason === "falha" ? "não leu nada" : "leu pela metade"}
                </span>
              </div>

              {a.diagnostico && (
                <div className="flex flex-col gap-1 text-xs text-ink-faint">
                  <p>
                    {a.diagnostico.target} · viu {a.diagnostico.moneyLines} linhas com valor · leu{" "}
                    {a.diagnostico.parsed}
                  </p>
                  {a.diagnostico.message && <p className="text-ink">{a.diagnostico.message}</p>}
                  {a.diagnostico.header && (
                    <code className="block overflow-x-auto whitespace-pre rounded bg-black/5 p-2 text-[11px]">
                      {a.diagnostico.header}
                    </code>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
                <span>
                  {a.createdAt.toLocaleString("pt-BR")} · {formatarTamanho(a.bytes)} · apaga em{" "}
                  {a.expiresAt.toLocaleDateString("pt-BR")}
                </span>
                <a
                  href={`/api/admin/importacoes/${a.id}`}
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white"
                >
                  Baixar arquivo
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
