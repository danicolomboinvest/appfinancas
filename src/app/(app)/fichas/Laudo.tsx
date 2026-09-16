"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Laudo, LaudoChange, LaudoItem } from "@/lib/analysis/laudo";
import type { OverviewSignal } from "@/lib/analysis/stock-overview";
import { readLaudoAction } from "./laudo-actions";

const SIGNAL_LABEL: Record<OverviewSignal, string> = { favoravel: "favoráveis", neutro: "na média", atencao: "atenção" };
const SIGNAL_DOT: Record<OverviewSignal, string> = {
  favoravel: "bg-success",
  neutro: "bg-ink-faint",
  atencao: "bg-danger",
};
const SIGNAL_TEXT: Record<OverviewSignal, string> = {
  favoravel: "text-success",
  neutro: "text-ink-muted",
  atencao: "text-danger",
};

function formatReadAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * A ficha abre com a resposta. Contagem de sinais, uma frase, a nota — e só depois os
 * indicadores, agrupados por pergunta de gente e lidos em uma linha cada.
 *
 * Contra o excesso de texto (a crítica certa da Dani ao mockup): cada indicador é UMA linha
 * (nome, valor, bolinha). A explicação em português aparece ao toque, e só fica aberta
 * sozinha nos pontos de atenção, que são os que a pessoa precisa entender sem pedir.
 */
export function LaudoView({
  sheetId,
  ticker,
  initialLaudo,
}: {
  sheetId: string;
  ticker: string;
  /** Snapshot guardado na ficha. null na primeira abertura: o componente lê sozinho. */
  initialLaudo: Laudo | null;
}) {
  const [laudo, setLaudo] = useState<Laudo | null>(initialLaudo);
  const [changes, setChanges] = useState<LaudoChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [openKey, setOpenKey] = useState<string | null>(null);

  function read() {
    startReading(async () => {
      const r = await readLaudoAction(sheetId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLaudo(r.laudo);
      setChanges(r.changes);
    });
  }

  // Primeira abertura: sem snapshot, lê agora. Nas seguintes a ficha abre na hora com o guardado.
  useEffect(() => {
    if (initialLaudo === null) read();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  if (!laudo) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        {error ? (
          <>
            <p className="text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                read();
              }}
              className="w-fit text-sm font-medium text-accent-strong hover:underline"
            >
              Tentar de novo
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-muted">Lendo os números de {ticker.toUpperCase()}…</p>
        )}
      </Card>
    );
  }

  const total = laudo.counts.favoravel + laudo.counts.neutro + laudo.counts.atencao;
  const tone = laudo.counts.atencao === 0 ? "success" : laudo.counts.favoravel > laudo.counts.atencao ? "success" : "danger";

  return (
    <div className="flex flex-col gap-5">
      {/* O veredito */}
      <Card
        className={`flex flex-col gap-3 p-5 ${
          tone === "success" ? "border-success/30 bg-success-soft/40" : "border-danger/30 bg-danger-soft/40"
        }`}
      >
        <p className="text-sm text-ink-muted">Lendo os números de hoje, {ticker.toUpperCase()} tem</p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {(["favoravel", "neutro", "atencao"] as OverviewSignal[]).map((s) => (
            <span key={s} className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-bold tracking-tight ${SIGNAL_TEXT[s]}`}>{laudo.counts[s]}</span>
              <span className={`text-sm ${SIGNAL_TEXT[s]}`}>{SIGNAL_LABEL[s]}</span>
            </span>
          ))}
        </div>
        {total > 0 && (
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
            {(["favoravel", "neutro", "atencao"] as OverviewSignal[]).map((s) => (
              <span key={s} className={SIGNAL_DOT[s]} style={{ width: `${(laudo.counts[s] / total) * 100}%` }} />
            ))}
          </div>
        )}
        <p className="text-sm leading-relaxed text-ink">{laudo.verdict}</p>
        {laudo.autoScore !== null && (
          <p className="text-caption text-ink-muted">
            Nota automática <span className="font-semibold text-ink">{laudo.autoScore.toFixed(1).replace(".", ",")}</span> de 10 ·
            só a partir dos números
          </p>
        )}
      </Card>

      {changes.length > 0 && (
        <Card className="flex flex-col gap-1.5 border-accent/40 bg-accent-soft/40 p-4">
          <p className="text-sm font-semibold text-ink">O que mudou desde a última leitura</p>
          {changes.map((c) => (
            <p key={c.key} className="text-caption text-ink-muted">
              {c.label}: {c.fromValue} → {c.toValue}{" "}
              <span className={SIGNAL_TEXT[c.to ?? "neutro"]}>({c.to ? SIGNAL_LABEL[c.to] : "—"})</span>
            </p>
          ))}
        </Card>
      )}

      {laudo.facts.length > 0 && (
        <p className="text-caption text-ink-muted">{laudo.facts.map((f) => `${f.label}: ${f.value}`).join(" · ")}</p>
      )}

      {/* Os indicadores, por pergunta */}
      <div className="flex flex-col gap-3">
        {laudo.sections.map((section) => (
          <Card key={section.id} className="overflow-hidden">
            <p className="px-4 pb-1 pt-3 text-label text-ink-faint">{section.question}</p>
            <ul>
              {section.items.map((item) => (
                <LaudoRow
                  key={item.key}
                  item={item}
                  open={openKey === item.key || item.signal === "atencao"}
                  onToggle={() => setOpenKey(openKey === item.key ? null : item.key)}
                />
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="text-caption leading-relaxed text-ink-faint">{laudo.caveat}</p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setError(null);
            read();
          }}
          disabled={reading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline disabled:opacity-50"
        >
          <RefreshCw size={14} strokeWidth={2} className={reading ? "animate-spin" : ""} />
          {reading ? "Lendo…" : "Reanalisar agora"}
        </button>
        <span className="text-caption text-ink-faint">última leitura {formatReadAt(laudo.readAt)}</span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function LaudoRow({ item, open, onToggle }: { item: LaudoItem; open: boolean; onToggle: () => void }) {
  return (
    <li className="border-t border-border/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className={`size-2 shrink-0 rounded-full ${SIGNAL_DOT[item.signal]}`} />
        <span className="min-w-0 flex-1 text-sm font-medium text-ink">{item.label.replace(/\s*\(.*?\)\s*/g, "")}</span>
        <span className="shrink-0 text-sm tabular-nums text-ink">{item.value}</span>
        <ChevronDown size={14} className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 pl-9">
          <p className={`text-caption leading-relaxed ${item.signal === "atencao" ? "text-danger" : "text-ink-muted"}`}>{item.plain}</p>
          <p className="mt-0.5 text-caption text-ink-faint">Régua: {item.reference}</p>
        </div>
      )}
    </li>
  );
}
