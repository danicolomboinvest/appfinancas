import type { ReactNode } from "react";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";

export type ResponsiveColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Colunas de ação (ex.: remover) não precisam repetir o rótulo no card mobile. */
  hideLabelOnMobile?: boolean;
  className?: string;
};

/**
 * >= 640px: tabela tradicional. < 640px: cada linha vira um card com pares
 * "label: valor" empilhados, nenhuma coluna fica inacessível no mobile.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  maxHeightClassName,
}: {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  /** Ex.: "max-h-[520px] overflow-y-auto" para listas longas, aplicado nos dois modos. */
  maxHeightClassName?: string;
}) {
  if (rows.length === 0) {
    return emptyMessage ? (
      <Card>
        <EmptyState message={emptyMessage} />
      </Card>
    ) : null;
  }

  return (
    <>
      <Card className={`hidden overflow-hidden sm:block ${maxHeightClassName ?? ""}`}>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-medium ${col.className ?? ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className={`flex flex-col gap-3 sm:hidden ${maxHeightClassName ?? ""}`}>
        {rows.map((row) => (
          <Card key={rowKey(row)} className="p-4">
            <div className="flex flex-col">
              {columns.map((col) => (
                <div
                  key={col.key}
                  className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0 last:pb-0"
                >
                  {!col.hideLabelOnMobile && <span className="shrink-0 pt-0.5 text-xs text-ink-muted">{col.label}</span>}
                  <span className="text-right text-sm text-ink">{col.render(row)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
