"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

const NUMBERS_KEY = "spi.laudo.numeros";
import { Card } from "@/components/ui/Card";
import { FRIENDLY_LABEL, compactValue, sectionSummary, technicalLabel, type Laudo, type LaudoChange, type LaudoItem } from "@/lib/analysis/laudo";
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
  // Resumo por padrão: uma frase por pergunta. Os quadradinhos ficam atrás de "Ver os
  // números" — quem está começando lê quatro frases; quem quer, abre os treze. A escolha é
  // lembrada no aparelho (conveniência de quem vê, não dado).
  const [showNumbers, setShowNumbers] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê uma preferência do aparelho na montagem; no servidor não existe localStorage, então não pode ser o estado inicial
      if (window.localStorage.getItem(NUMBERS_KEY) === "1") setShowNumbers(true);
    } catch {
      /* sem localStorage: fica no resumo */
    }
  }, []);
  function toggleNumbers() {
    setShowNumbers((v) => {
      try {
        window.localStorage.setItem(NUMBERS_KEY, v ? "0" : "1");
      } catch {
        /* ignora */
      }
      return !v;
    });
  }

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

      {/* Cada pergunta, respondida em UMA frase. É o que uma iniciante lê inteiro. Os
          quadradinhos (um por indicador, nome de gente em cima, sigla embaixo) ficam atrás
          de "Ver os números"; os de atenção já vêm explicados quando os números abrem. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-label text-ink-faint">Pergunta por pergunta</p>
          <button type="button" onClick={toggleNumbers} className="text-caption font-medium text-accent-strong hover:underline">
            {showNumbers ? "Só o resumo" : "Ver os números"}
          </button>
        </div>

        {laudo.sections.map((section) => {
          const resumo = sectionSummary(section);
          const aberto = section.items.find((i) => i.key === openKey) ?? null;
          const atencao = section.items.filter((i) => i.signal === "atencao" && i.key !== openKey);
          return (
            <Card key={section.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${SIGNAL_DOT[resumo.signal]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{section.question}</p>
                  <p className={`mt-0.5 text-sm leading-relaxed ${resumo.signal === "atencao" ? "text-danger" : "text-ink-muted"}`}>
                    {resumo.text}
                  </p>
                </div>
              </div>

              {showNumbers && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {section.items.map((item) => (
                      <LaudoTile
                        key={item.key}
                        item={item}
                        open={openKey === item.key}
                        onToggle={() => setOpenKey(openKey === item.key ? null : item.key)}
                      />
                    ))}
                  </div>
                  {(aberto || atencao.length > 0) && (
                    <div className="flex flex-col gap-1.5">
                      {aberto && <Explanation item={aberto} />}
                      {atencao.map((item) => (
                        <Explanation key={item.key} item={item} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })}
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

/** Rótulos curtos pro quadradinho (duas colunas no celular): o nome cheio continua na explicação. */
const SHORT_LABEL: Record<string, string> = {
  divida_liquida_ebitda: "Dívida / EBITDA",
  divida_liquida_patrimonio: "Dívida / Patrim.",
  liquidez_corrente: "Liquidez corrente",
  evolucao_receita: "Receita 5 anos",
  evolucao_lucro: "Lucro 5 anos",
  patrimonio_liquido_etf: "Patrimônio",
  rentabilidade_12m: "12 meses",
  rentabilidade_5anos: "5 anos",
  taxa_administracao: "Taxa de adm.",
  vacancia_atual: "Vacância",
  liquidez_fii: "Liquidez diária",
};

const TILE: Record<OverviewSignal, string> = {
  favoravel: "border-success/30 bg-success-soft/50",
  neutro: "border-border bg-surface-2/60",
  atencao: "border-danger/40 bg-danger-soft/50",
};

function LaudoTile({ item, open, onToggle }: { item: LaudoItem; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex min-h-[4.5rem] flex-col justify-between rounded-xl border p-3 text-left transition-all ${TILE[item.signal]} ${
        open ? "ring-2 ring-accent/60" : "hover:brightness-105"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${SIGNAL_DOT[item.signal]}`} />
        <span className="truncate text-caption font-medium text-ink">{FRIENDLY_LABEL[item.key] ?? SHORT_LABEL[item.key] ?? technicalLabel(item)}</span>
      </span>
      <span className="mt-1 block text-lg font-semibold leading-tight tabular-nums tracking-tight text-ink">{compactValue(item.value)}</span>
      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wide text-ink-faint">{SHORT_LABEL[item.key] ?? technicalLabel(item)}</span>
    </button>
  );
}

function Explanation({ item }: { item: LaudoItem }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-surface-2/60 px-3 py-2">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SIGNAL_DOT[item.signal]}`} />
      <p className={`text-caption leading-relaxed ${item.signal === "atencao" ? "text-danger" : "text-ink"}`}>
        <span className="font-medium">{FRIENDLY_LABEL[item.key] ?? technicalLabel(item)}:</span> {item.plain}
        <span className="text-ink-faint"> · régua: {item.reference}</span>
      </p>
    </div>
  );
}
