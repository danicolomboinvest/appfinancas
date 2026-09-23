"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check, Lock } from "lucide-react";
import type { AssetClass } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
  parsePortfolioAction,
  importPortfolioAction,
  type ParsedHoldingItem,
  type ConfirmedHolding,
} from "@/app/(app)/carteira/import-actions";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { UPLOAD_MAX_BYTES } from "@/lib/import/limites";

type Phase = "upload" | "password" | "confirm" | "done";

const CLASS_LABEL: Record<AssetClass, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  INTERNACIONAL: "Internacional",
  OUTRO: "Outro",
};
const CLASS_VALUES = Object.keys(CLASS_LABEL) as AssetClass[];


function formatQty(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

/** O arquivo vai CRU num FormData (string grande de base64 estoura o limite de serialização
 * das actions). O encoding diz ao servidor como interpretar os bytes. */
function buildUploadForm(file: File): FormData {
  const name = file.name.toLowerCase();
  const encoding = name.endsWith(".xlsx") || name.endsWith(".xls") ? "xlsx" : name.endsWith(".pdf") ? "pdf" : "text";
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", encoding);
  return formData;
}

/**
 * Importação da carteira: sobe o extrato de posição da corretora/B3 (CSV/Excel/PDF) e o
 * servidor compara com a carteira atual, a revisão mostra só o que interessa: NOVOS
 * (entram na carteira) e MUDANÇAS (quantidade/valor atualizados, "antes → depois").
 * O que não mudou é só um contador; reimportar o mesmo extrato nunca duplica nada.
 */
export function PortfolioImport({ onDone }: { onDone: () => void }) {
  const money = useMoney();
  // O que a pessoa lê vem da voz do tema; a comparação com a carteira não sabe de tema nenhum.
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [holdings, setHoldings] = useState<ParsedHoldingItem[]>([]);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Excel da corretora pode vir protegido por senha: guardamos o arquivo e pedimos a senha.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");

  function handleFile(file: File) {
    setError(null);
    // Barra aqui o que a Vercel recusaria com 413 lá fora, onde não sobra nem registro.
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(t.impCarteiraArquivoGrande);
      return;
    }
    runParse(file);
  }

  /** Lê o arquivo no servidor. Se o Excel estiver protegido, cai na tela de senha; com a senha,
   * reenvia o MESMO arquivo pra descriptografar e seguir. */
  function runParse(file: File, pwd?: string) {
    setError(null);
    const formData = buildUploadForm(file);
    if (pwd) formData.set("password", pwd);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof parsePortfolioAction>>;
      try {
        result = await parsePortfolioAction(formData);
      } catch (err) {
        console.error("parsePortfolioAction falhou no envio", err);
        setError(t.impErroEnvio);
        return;
      }
      if (!result.ok) {
        if (result.needsPassword) {
          setPendingFile(file);
          setPhase("password");
          setError(pwd ? result.error : null);
          return;
        }
        setError(result.error);
        return;
      }
      // Sem mudança fica fora da revisão, só conta no aviso.
      setSummary(result.summary);
      setHoldings(result.holdings.filter((h) => h.status !== "unchanged"));
      setUnchangedCount(result.holdings.filter((h) => h.status === "unchanged").length);
      setPhase("confirm");
    });
  }

  function setClass(key: number, assetClass: AssetClass) {
    setHoldings((prev) => prev.map((h) => (h.key === key ? { ...h, assetClass } : h)));
  }

  function remove(key: number) {
    setHoldings((prev) => prev.filter((h) => h.key !== key));
  }

  function handleImport() {
    const confirmed: ConfirmedHolding[] = holdings.map((h) => ({
      ticker: h.ticker,
      quantity: h.quantity,
      value: h.value,
      investedValue: h.investedValue,
      assetClass: h.assetClass,
      fixedIncomeIndex: h.fixedIncomeIndex,
      mode: h.status === "changed" ? "update" : "create",
    }));
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof importPortfolioAction>>;
      try {
        result = await importPortfolioAction(confirmed);
      } catch (err) {
        console.error("importPortfolioAction falhou no envio", err);
        setError(t.impErroSalvar);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setUpdatedCount(result.updated);
      setPhase("done");
    });
  }

  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pill text-on-pill">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? t.impLendoArquivo : t.impCarteiraEscolher}</span>
          <span className="text-caption text-ink-faint">{t.impCarteiraFormato}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  // --- SENHA (Excel protegido pela corretora) ---
  if (phase === "password") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <Lock size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-ink">{t.impProtegido}</p>
          <p className="text-caption text-ink-faint">{t.impSenhaDicaCorretora}</p>
        </div>

        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pendingFile && password) runParse(pendingFile, password);
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.impSenhaPlaceholder}
            autoFocus
            autoComplete="off"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={isPending || !password}>
            {isPending ? t.impAbrindo : t.impDesbloquear}
          </Button>
          <button
            type="button"
            onClick={() => {
              setPhase("upload");
              setPendingFile(null);
              setPassword("");
              setError(null);
            }}
            className="text-center text-xs font-medium text-ink-faint hover:text-ink"
          >
            {t.impOutroArquivo}
          </button>
        </form>
      </div>
    );
  }

  if (phase === "confirm") {
    const news = holdings.filter((h) => h.status === "new");
    const changes = holdings.filter((h) => h.status === "changed");
    const nothingToDo = holdings.length === 0;

    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {summary && <p className="text-caption text-ink-muted">{t.impCarteiraLiTudo(summary)}</p>}

        {nothingToDo ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-muted">{t.impCarteiraEmDia(unchangedCount)}</p>
        ) : (
          <>
            {news.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink">
                  {t.impCarteiraNovos} <span className="text-ink-faint">({news.length})</span>
                </p>
                <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {news.map((h) => (
                    <li key={h.key} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{h.ticker}</p>
                        <p className="text-caption text-ink-faint">
                          {h.quantity > 0 ? `${formatQty(h.quantity)} · ` : ""}
                          {h.value > 0 ? money(h.value) : t.impCarteiraSemValor}
                        </p>
                      </div>
                      <select
                        value={h.assetClass}
                        onChange={(e) => setClass(h.key, e.target.value as AssetClass)}
                        className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                      >
                        {CLASS_VALUES.map((c) => (
                          <option key={c} value={c}>
                            {CLASS_LABEL[c]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => remove(h.key)}
                        className="text-caption text-ink-faint hover:text-danger"
                        aria-label={`Remover ${h.ticker}`}
                      >
                        {t.impRemover}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {changes.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink">
                  {t.impCarteiraMudancas} <span className="text-ink-faint">({changes.length})</span>
                </p>
                <ul className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {changes.map((h) => {
                    const qtyChanged =
                      h.quantity > 0 && h.prevQuantity !== null && Math.abs(h.quantity - h.prevQuantity) > 1e-6;
                    return (
                      <li key={h.key} className="flex items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{h.ticker}</p>
                          <p className="text-caption text-ink-faint">
                            {qtyChanged && (
                              <>
                                {formatQty(h.prevQuantity as number)} → <span className="text-ink">{formatQty(h.quantity)}</span>
                                {" · "}
                              </>
                            )}
                            {h.prevValue !== null ? `${money(h.prevValue)} → ` : ""}
                            <span className="text-ink">{money(h.value)}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(h.key)}
                          className="text-caption text-ink-faint hover:text-danger"
                          aria-label={`Não atualizar ${h.ticker}`}
                        >
                          {t.impPular}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {unchangedCount > 0 && (
              <p className="text-caption text-ink-faint">{t.impCarteiraSemMudanca(unchangedCount)}</p>
            )}
          </>
        )}

        {nothingToDo ? (
          <Button type="button" onClick={onDone}>
            {t.impConcluir}
          </Button>
        ) : (
          <Button type="button" onClick={handleImport} disabled={isPending}>
            {isPending ? t.impAplicando : t.impCarteiraBotao(news.length, changes.length)}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">{t.impCarteiraFeito(createdCount, updatedCount)}</p>
      <Button type="button" onClick={onDone}>
        {t.impConcluir}
      </Button>
    </div>
  );
}
