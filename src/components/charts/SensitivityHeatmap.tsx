"use client";

import type { SensitivityRow } from "@/lib/simulators/mark-to-market";
import { formatPercentNumber } from "@/lib/format";

function formatDuration(years: number) {
  if (years < 1 / 12) return `${Math.round(years * 365)} dias`;
  if (years < 1) return `${Math.round(years * 12)} meses`;
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

function cellColor(value: number) {
  if (value > 0.005) return "bg-success-soft text-success";
  if (value < -0.005) return "bg-danger-soft text-danger";
  return "bg-surface-2 text-ink-muted";
}

export function SensitivityHeatmap({ rows }: { rows: SensitivityRow[] }) {
  if (rows.length === 0) return null;
  const rateChanges = rows[0].cells.map((cell) => cell.rateChange);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            <th className="p-2 font-medium text-ink-muted">Duration</th>
            {rateChanges.map((delta) => (
              <th key={delta} className="p-2 text-center font-medium text-ink-muted">
                {formatPercentNumber(delta * 100, 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.durationYears}>
              <td className="p-2 font-medium text-ink">{formatDuration(row.durationYears)}</td>
              {row.cells.map((cell) => (
                <td key={cell.rateChange} className={`rounded-md p-2 text-center ${cellColor(cell.priceDeviation)}`}>
                  {formatPercentNumber(cell.priceDeviation * 100, 2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
