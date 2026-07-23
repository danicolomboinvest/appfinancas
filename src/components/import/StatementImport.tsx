"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check, ArrowRight, Lock, Plus } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast-context";
import { createCategoryAction } from "@/lib/actions/category";
import {
  parseStatementAction,
  importTransactionsAction,
  type ReviewItem,
  type ConfirmedItem,
} from "@/app/(app)/mensal/import-actions";

type Phase = "upload" | "password" | "review" | "confirm" | "done";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** O arquivo vai CRU num FormData (string grande de base64 estoura o limite de serialização
 * das actions). O encoding diz ao servidor como interpretar os bytes. */
function buildUploadForm(file: File, docType: "extrato" | "fatura"): FormData {
  const name = file.name.toLowerCase();
  const encoding = name.endsWith(".xlsx") || name.endsWith(".xls") ? "xlsx" : name.endsWith(".pdf") ? "pdf" : "text";
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", encoding);
  formData.set("docType", docType);
  return formData;
}

/**
 * Importação de extrato bancário (item 3). Upload CSV/OFX → classificação automática → fila de
 * revisão (uma transação por vez, chips de categoria em 1 toque) → confirmação. As categorias
 * definidas na revisão viram regra aprendida no servidor pra próxima importação.
 */
export function StatementImport({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [docType, setDocType] = useState<"extrato" | "fatura">("extrato");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Excel do banco costuma vir protegido por senha: guardamos o arquivo e pedimos a senha.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  // Categorias personalizadas do usuário + a criação na hora ("+ Outra") durante a revisão.
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Índices das transações que precisam de revisão manual (gasto sem categoria nenhuma).
  const reviewQueue = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.category === "EXPENSE" && !it.parentCategory && !it.customCategoryId);

  function handleFile(file: File) {
    setError(null);
    // Limite do corpo da Server Action é 8 MB, barra antes com mensagem clara.
    if (file.size > 7.5 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. ~7 MB). Exporte um período menor do extrato e tente de novo.");
      return;
    }
    runParse(file);
  }

  /** Lê o arquivo no servidor. Se o Excel estiver protegido, cai na tela de senha; com a senha,
   * reenvia o MESMO arquivo pra descriptografar e seguir. */
  function runParse(file: File, pwd?: string) {
    setError(null);
    const formData = buildUploadForm(file, docType);
    if (pwd) formData.set("password", pwd);
    startTransition(async () => {
      const result = await parseStatementAction(formData);
      if (!result.ok) {
        if (result.needsPassword) {
          setPendingFile(file);
          setPhase("password");
          // Se já tinha tentado com senha (veio de novo needsPassword), mostra que a senha não serviu.
          setError(pwd ? result.error : null);
          return;
        }
        setError(result.error);
        return;
      }
      setItems(result.items);
      setCustomCategories(result.customCategories);
      setReviewIdx(0);
      // Se nada precisa de revisão, pula direto pra confirmação.
      const needsReview = result.items.some((it) => it.category === "EXPENSE" && !it.parentCategory && !it.customCategoryId);
      setPhase(needsReview ? "review" : "confirm");
    });
  }

  /** Categoria-mãe fixa: zera a personalizada. */
  function assignParent(itemKey: number, parentCategory: ParentCategory) {
    setItems((prev) =>
      prev.map((it) =>
        it.key === itemKey ? { ...it, parentCategory, customCategoryId: null, subcategory: null, autoClassified: false } : it,
      ),
    );
  }

  /** Categoria personalizada: zera a categoria-mãe fixa. */
  function assignCustom(itemKey: number, customCategoryId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.key === itemKey ? { ...it, customCategoryId, parentCategory: null, subcategory: null, autoClassified: false } : it,
      ),
    );
  }

  /** Cria a categoria na hora ("+ Outra"), já disponível pra planejar depois no Orçamento. */
  function createAndAssign(itemKey: number) {
    const name = newCatName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createCategoryAction(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCustomCategories((prev) => (prev.some((c) => c.id === res.id) ? prev : [...prev, { id: res.id, name: res.name }]));
      assignCustom(itemKey, res.id);
      setCreatingCat(false);
      setNewCatName("");
      advanceReview();
    });
  }

  function advanceReview() {
    if (reviewIdx + 1 < reviewQueue.length) {
      setReviewIdx((i) => i + 1);
    } else {
      setPhase("confirm");
    }
  }

  function handleImport() {
    const confirmed: ConfirmedItem[] = items
      .filter((it) => it.category === "INCOME" || it.parentCategory || it.customCategoryId) // pula gastos ainda sem categoria
      .map((it) => ({
        date: it.date,
        description: it.description,
        amount: it.amount,
        category: it.category,
        parentCategory: it.parentCategory,
        customCategoryId: it.customCategoryId,
        subcategory: it.subcategory,
        // Aprende quando foi o usuário quem classificou (não veio 100% automático).
        learn: !it.autoClassified,
      }));
    startTransition(async () => {
      const result = await importTransactionsAction(confirmed, docType);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setPhase("done");
      const parts = [`${result.created} lançamentos importados`];
      if (result.skipped > 0) parts.push(`${result.skipped} já existiam (ignorados)`);
      if (result.removedCardPayment)
        parts.push(`removi o pagamento da fatura (${formatBRL(result.removedCardPayment.amount)}) do extrato pra não contar duas vezes`);
      showToast(parts.join(" · ") + ".");
    });
  }

  // --- UPLOAD ---
  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {/* Extrato bancário (sinal manda) vs Fatura de cartão (tudo é gasto). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">O que você está subindo?</span>
          <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
            {(["extrato", "fatura"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDocType(t)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  docType === t ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t === "extrato" ? "Extrato bancário" : "Fatura de cartão"}
              </button>
            ))}
          </div>
          <span className="text-caption text-ink-faint">
            {docType === "fatura"
              ? "Todas as linhas entram como gasto (compras do cartão)."
              : "Entradas viram renda e saídas viram gasto, pelo sinal do valor."}
          </span>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? "Lendo arquivo..." : "Escolher extrato"}</span>
          <span className="text-caption text-ink-faint">CSV, OFX, Excel ou PDF do seu banco</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.ofx,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  // --- SENHA (Excel protegido pelo banco) ---
  if (phase === "password") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <Lock size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-ink">Este arquivo está protegido por senha</p>
          <p className="text-caption text-ink-faint">
            Muitos bancos exportam o extrato assim. Digite a senha do arquivo (a mesma que o banco pede pra abrir).
          </p>
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
            placeholder="Senha do arquivo"
            autoFocus
            autoComplete="off"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={isPending || !password}>
            {isPending ? "Abrindo..." : "Desbloquear e continuar"}
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
            Escolher outro arquivo
          </button>
        </form>
      </div>
    );
  }

  // --- REVIEW (uma por vez, chips) ---
  if (phase === "review") {
    const entry = reviewQueue[reviewIdx];
    if (!entry) {
      // Fila esvaziou (todas classificadas), segue pra confirmação.
      setPhase("confirm");
      return null;
    }
    const it = entry.it;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-caption text-ink-muted">
          <span>
            Revisar {reviewIdx + 1} de {reviewQueue.length}
          </span>
          <button type="button" onClick={advanceReview} className="text-ink-faint hover:text-ink">
            Pular
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">{it.description}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-caption text-ink-faint">{formatDate(it.date)}</span>
            <span className="text-indicator font-semibold tabular-nums text-danger">− {formatBRL(it.amount)}</span>
          </div>
        </div>

        <p className="text-xs font-medium text-ink-muted">Qual a categoria?</p>
        <div className="flex flex-wrap gap-2">
          {PARENT_CATEGORIES.map((pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => {
                assignParent(it.key, pc);
                advanceReview();
              }}
              className="rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft active:scale-95"
            >
              {PARENT_CATEGORY_LABEL[pc]}
            </button>
          ))}
          {/* Categorias que a própria pessoa criou (aqui ou no Orçamento). */}
          {customCategories.map((cc) => (
            <button
              key={cc.id}
              type="button"
              onClick={() => {
                assignCustom(it.key, cc.id);
                advanceReview();
              }}
              className="rounded-full border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong transition-colors hover:border-accent active:scale-95"
            >
              {cc.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCreatingCat((v) => !v);
              setNewCatName("");
              setError(null);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong bg-transparent px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Plus size={14} strokeWidth={2.2} />
            Outra
          </button>
        </div>

        {/* Criar categoria na hora: fica disponível pra planejar depois no Orçamento. */}
        {creatingCat && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createAndAssign(it.key);
                  }
                }}
                placeholder="Nome da categoria (ex.: Fatura, Pet, Farmácia)"
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <Button type="button" size="sm" onClick={() => createAndAssign(it.key)} disabled={isPending || !newCatName.trim()}>
                {isPending ? "Criando..." : "Criar e usar"}
              </Button>
            </div>
            <span className="text-caption text-ink-faint">
              A categoria nova já aparece no Orçamento pra você planejar um valor pra ela.
            </span>
          </div>
        )}
      </div>
    );
  }

  // --- CONFIRM ---
  if (phase === "confirm") {
    const importable = items.filter((it) => it.category === "INCOME" || it.parentCategory || it.customCategoryId);
    const customName = (id: string) => customCategories.find((c) => c.id === id)?.name ?? "Personalizada";
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-sm text-ink-muted">
          {importable.length} lançamento{importable.length === 1 ? "" : "s"} pronto{importable.length === 1 ? "" : "s"} para importar.
        </p>
        <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {importable.map((it) => (
            <li key={it.key} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{it.description}</p>
                <p className="text-caption text-ink-faint">
                  {formatDate(it.date)} ·{" "}
                  {it.category === "INCOME"
                    ? "Renda"
                    : it.parentCategory
                      ? PARENT_CATEGORY_LABEL[it.parentCategory]
                      : it.customCategoryId
                        ? customName(it.customCategoryId)
                        : "—"}
                </p>
              </div>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${it.category === "INCOME" ? "text-success" : "text-danger"}`}>
                {it.category === "INCOME" ? "+" : "−"} {formatBRL(it.amount)}
              </span>
            </li>
          ))}
        </ul>
        <Button type="button" onClick={handleImport} disabled={isPending || importable.length === 0}>
          {isPending ? "Importando..." : `Importar ${importable.length} lançamento${importable.length === 1 ? "" : "s"}`}
          <ArrowRight size={16} className="ml-1.5" />
        </Button>
      </div>
    );
  }

  // --- DONE ---
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">{createdCount} lançamentos importados com sucesso.</p>
      <Button type="button" onClick={onDone}>
        Concluir
      </Button>
    </div>
  );
}
