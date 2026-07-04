"use client";

import type { SensitivityRow } from "@/lib/simulators/mark-to-market";

function formatDuration(years: number) {
  if (years < 1 / 12) return `${Math.round(years * 365)} dias`;
  if (years < 1) return `${Math.round(years * 12)} meses`;
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

function cellColor(value: number) {
  if (value > 0.005) return "bg-green-100";
  if (value < -0.005) return "bg-red-100";
  return "bg-black/5";
}

export function SensitivityHeatmap({ rows }: { rows: SensitivityRow[] }) {
  if (rows.length === 0) return null;
  const rateChanges = rows[0].cells.map((cell) => cell.rateChange);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            <th className="p-2 text-black/60">Duration</th>
            {rateChanges.map((delta) => (
              <th key={delta} className="p-2 text-center text-black/60">
                {(delta * 100).toFixed(1)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.durationYears}>
              <td className="p-2 font-medium">{formatDuration(row.durationYears)}</td>
              {row.cells.map((cell) => (
                <td key={cell.rateChange} className={`p-2 text-center ${cellColor(cell.approxReturn)}`}>
                  {(cell.approxReturn * 100).toFixed(2)}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
