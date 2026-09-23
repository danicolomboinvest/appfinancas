"use client";

import { FalarComSuporte } from "@/components/support/FalarComSuporte";
import { useRef, useState, useTransition } from "react";
import { Upload, Check, ArrowRight, Lock, Plus } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, categoryLabel } from "@/lib/categories";
import { Button } from "@/components/ui/Button";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useToast } from "@/components/ui/toast-context";
import { createCategoryAction } from "@/lib/actions/category";
import {
  parseStatementAction,
  importTransactionsAction,
  removeCardPaymentCandidateAction,
  type ReviewItem,
  type ParseStats,
  type ConfirmedItem,
  type CardPaymentCandidate,
} from "@/app/(app)/mensal/import-actions";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { UPLOAD_MAX_BYTES } from "@/lib/import/limites";

type Phase = "upload" | "password" | "review" | "confirm" | "done";

/** "YYYY-MM" do mês corrente, usado como valor inicial do seletor de mês da fatura. */
function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}


function formatDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** "2027-06" → "junho de 2027", pro texto de confirmação do mês da fatura. */
function formatMonthYear(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return monthValue;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** O arquivo vai CRU num FormData (string grande de base64 estoura o limite de serialização
 * das actions). O encoding diz ao servidor como interpretar os bytes. */
function buildUploadForm(file: File, docType: "extrato" | "fatura", faturaMonth?: string): FormData {
  const name = file.name.toLowerCase();
  const encoding = name.endsWith(".xlsx") || name.endsWith(".xls") ? "xlsx" : name.endsWith(".pdf") ? "pdf" : "text";
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", encoding);
  formData.set("docType", docType);
  if (faturaMonth) formData.set("faturaMonth", faturaMonth);
  return formData;
}

/**
 * Importação de extrato bancário (item 3). Upload CSV/OFX → classificação automática → fila de
 * revisão (uma transação por vez, chips de categoria em 1 toque) → confirmação. As categorias
 * definidas na revisão viram regra aprendida no servidor pra próxima importação.
 */
export function StatementImport({ onDone }: { onDone: () => void }) {
  const money = useMoney();
  const { showToast } = useToast();
  // Tudo que a pessoa lê aqui (instruções, botões, avisos) vem da voz do tema; a lógica de
  // leitura do arquivo não sabe de tema nenhum.
  // `kind` porque os chips de categoria têm o nome do perfil (Empresa: "Estrutura", não "Moradia").
  const { voz, kind } = useProfileTheme();
  const t = voz.titulos;
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [docType, setDocType] = useState<"extrato" | "fatura">("extrato");
  // Mês/ano de destino da FATURA (todas as compras entram nesse mês, escolhido por quem importa
  // — não no mês de cada compra, que fica espalhado pelo período de fechamento da fatura).
  const [faturaMonth, setFaturaMonth] = useState(currentMonthValue());
  const [cardPaymentCandidates, setCardPaymentCandidates] = useState<CardPaymentCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Excel do banco costuma vir protegido por senha: guardamos o arquivo e pedimos a senha.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Nome do arquivo subido — vai pro histórico de importações ("o que era este lote?").
  const [fileName, setFileName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<ParseStats | null>(null);
  /** O app achou que o arquivo é de outro tipo: pergunta antes de seguir. */
  const [kindMismatch, setKindMismatch] = useState<{ file: File; suggested: "extrato" | "fatura"; reason: string } | null>(null);
  // Categorias personalizadas do usuário + a criação na hora ("+ Outra") durante a revisão.
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  /**
   * Fila de revisão CONGELADA na entrada: as chaves dos gastos que chegaram sem categoria.
   *
   * Antes a fila era recalculada a cada render a partir de `items` — classificar o item 1 o
   * tirava da fila E o índice avançava, então o item 2 era pulado e, no fim, descartado sem
   * aviso na hora de importar (o filtro de `handleImport` derruba gasto sem categoria). Com a
   * lista fixa, cada toque anda exatamente uma posição e ninguém some.
   */
  const [reviewKeys, setReviewKeys] = useState<number[]>([]);
  const reviewQueue = reviewKeys.flatMap((key) => {
    const it = items.find((x) => x.key === key);
    return it ? [{ it, i: key }] : [];
  });

  function handleFile(file: File) {
    setError(null);
    // Barra aqui o que a Vercel recusaria com 413 lá fora, onde não sobra nem registro.
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(t.impArquivoGrande);
      return;
    }
    runParse(file);
  }

  /** Lê o arquivo no servidor. Se o Excel estiver protegido, cai na tela de senha; com a senha,
   * reenvia o MESMO arquivo pra descriptografar e seguir. */
  function runParse(file: File, pwd?: string, forcedType?: "extrato" | "fatura", acceptKind = false) {
    setError(null);
    setFileName(file.name);
    const type = forcedType ?? docType;
    const formData = buildUploadForm(file, type, type === "fatura" ? faturaMonth : undefined);
    if (pwd) formData.set("password", pwd);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof parseStatementAction>>;
      try {
        result = await parseStatementAction(formData);
      } catch (err) {
        console.error("parseStatementAction falhou no envio", err);
        setError(t.impErroEnvio);
        return;
      }
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
      // Fatura subida como extrato vira renda; extrato subido como fatura vira gasto. Se o
      // conteúdo diz que é o outro tipo, pergunta antes de mostrar qualquer lançamento.
      if (!acceptKind && result.stats.detectedKind !== "unknown" && result.stats.detectedKind !== type) {
        setKindMismatch({ file, suggested: result.stats.detectedKind, reason: result.stats.detectedReason });
        return;
      }
      setKindMismatch(null);
      setStats(result.stats);
      setItems(result.items);
      setCustomCategories(result.customCategories);
      setReviewIdx(0);
      // Se nada precisa de revisão, pula direto pra confirmação.
      const pendentes = result.items.filter((it) => it.category === "EXPENSE" && !it.parentCategory && !it.customCategoryId);
      setReviewKeys(pendentes.map((it) => it.key));
      setPhase(pendentes.length > 0 ? "review" : "confirm");
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
    setReviewIdx((i) => {
      if (i + 1 < reviewKeys.length) return i + 1;
      setPhase("confirm");
      return i;
    });
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
        installment: it.installment,
      }));
    const [targetYear, targetMonth] = docType === "fatura" ? faturaMonth.split("-").map(Number) : [undefined, undefined];
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof importTransactionsAction>>;
      try {
        result = await importTransactionsAction(confirmed, docType, targetYear, targetMonth, fileName ?? undefined);
      } catch (err) {
        console.error("importTransactionsAction falhou no envio", err);
        setError(t.impErroSalvar);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setCardPaymentCandidates(result.cardPaymentCandidates);
      setPhase("done");
      const parts = [t.impToastImportados(result.created)];
      if (result.skipped > 0) parts.push(t.impToastJaExistiam(result.skipped));
      showToast(parts.join(" · ") + ".");
    });
  }

  /** Some da lista assim que a pessoa decide (removeu ou manteve), sem esperar recarregar a página. */
  function dismissCandidate(id: string) {
    setCardPaymentCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  // --- UPLOAD ---
  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {/* Erro de leitura: antes esta tela era um beco sem saída. O botão abre a conversa com a
            mensagem já escrita, incluindo o nome do arquivo e o que o app disse — a pessoa não
            precisa explicar nada, e o ManyChat reconhece o assunto e responde na hora. */}
        {error && (
          <div className="flex flex-col gap-2 rounded-lg bg-danger-soft px-3 py-3">
            <p className="text-sm text-danger">{error}</p>
            <FalarComSuporte arquivo={fileName} problema={error} />
          </div>
        )}

        {kindMismatch && (
          <div className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3">
            <p className="text-sm font-semibold text-ink">{t.impPareceOutroTipo(kindMismatch.suggested, docType, kindMismatch.reason)}</p>
            <p className="text-caption text-ink-muted">
              {kindMismatch.suggested === "fatura" ? t.impPareceFaturaAviso : t.impPareceExtratoAviso}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setDocType(kindMismatch.suggested);
                  runParse(kindMismatch.file, undefined, kindMismatch.suggested, true);
                }}
              >
                {t.impImportarComo(kindMismatch.suggested)}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => runParse(kindMismatch.file, undefined, docType, true)}>
                {t.impEMesmo(docType)}
              </Button>
            </div>
          </div>
        )}

        {/* Extrato bancário (sinal manda) vs Fatura de cartão (tudo é gasto). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">{t.impOQueSubindo}</span>
          <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
            {(["extrato", "fatura"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setDocType(tipo)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  docType === tipo ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"
                }`}
              >
                {tipo === "extrato" ? t.impTipoExtrato : t.impTipoFatura}
              </button>
            ))}
          </div>
          <span className="text-caption text-ink-faint">
            {docType === "fatura" ? t.impFaturaDica : t.impExtratoDica}
          </span>
        </div>

        {/* Fatura: a pessoa escolhe o mês de destino — todas as compras entram nesse mês (o
            período de fechamento da fatura costuma cruzar dois meses do calendário, e a data
            de cada compra não é o que importa aqui, é quando a fatura foi paga). */}
        {docType === "fatura" && (
          <div className="flex flex-col gap-1.5">
            <MonthPicker
              label={t.impFaturaMes}
              id="fatura-month"
              value={faturaMonth}
              onChange={setFaturaMonth}
            />
            <span className="text-caption text-ink-faint">{t.impFaturaMesDica(formatMonthYear(faturaMonth))}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pill text-on-pill">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? t.impLendoArquivo : t.impEscolherExtrato}</span>
          <span className="text-caption text-ink-faint">{t.impFormatosBanco}</span>
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

  // --- SENHA (Excel ou PDF protegido pelo banco) ---
  if (phase === "password") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <Lock size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-ink">{t.impProtegido}</p>
          <p className="text-caption text-ink-faint">{t.impSenhaDicaBanco}</p>
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
          <span>{t.impRevisar(reviewIdx + 1, reviewQueue.length)}</span>
          <button type="button" onClick={advanceReview} className="text-ink-faint hover:text-ink">
            {t.impPular}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">{it.description}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-caption text-ink-faint">{formatDate(it.date)}</span>
            <span className="text-indicator font-semibold tabular-nums text-danger">− {money(it.amount)}</span>
          </div>
          {it.installment && it.installment.current < it.installment.total && (
            <p className="mt-1.5 text-caption text-accent-strong">
              {t.impParcela(it.installment.current, it.installment.total, it.installment.total - it.installment.current)}
            </p>
          )}
        </div>

        <p className="text-xs font-medium text-ink-muted">{t.impQualCategoria}</p>
        <div className="flex flex-wrap gap-2">
          {PARENT_CATEGORIES.map((pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => {
                assignParent(it.key, pc);
                advanceReview();
              }}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors active:scale-95 ${
                it.parentCategory === pc
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft"
              }`}
            >
              {categoryLabel(kind, pc)}
            </button>
          ))}
          {/* Categorias que a própria pessoa criou (aqui ou no Orçamento). Só fica "dourada"
              quando de fato selecionada (it.customCategoryId === cc.id) — antes vinha sempre
              dourada de cara, dava a entender que já estava escolhida sem ter clicado em nada. */}
          {customCategories.map((cc) => (
            <button
              key={cc.id}
              type="button"
              onClick={() => {
                assignCustom(it.key, cc.id);
                advanceReview();
              }}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors active:scale-95 ${
                it.customCategoryId === cc.id
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft"
              }`}
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
            {t.impOutra}
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
                placeholder={t.impNovaCategoriaPlaceholder}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <Button type="button" size="sm" onClick={() => createAndAssign(it.key)} disabled={isPending || !newCatName.trim()}>
                {isPending ? t.impCriando : t.impCriarEUsar}
              </Button>
            </div>
            <span className="text-caption text-ink-faint">{t.impNovaCategoriaDica}</span>
          </div>
        )}
      </div>
    );
  }

  // --- CONFIRM ---
  if (phase === "confirm") {
    const importable = items.filter((it) => it.category === "INCOME" || it.parentCategory || it.customCategoryId);
    // Gastos que ficaram sem categoria (pulados na revisão) NÃO entram. Antes sumiam calados:
    // o botão dizia "Importar 12" e 3 gastos simplesmente não existiam depois.
    const semCategoria = items.filter((it) => it.category === "EXPENSE" && !it.parentCategory && !it.customCategoryId);
    const customName = (id: string) => customCategories.find((c) => c.id === id)?.name ?? "Personalizada";
    // Repetidos dentro do arquivo: mesma data, valor e descrição mais de uma vez. Pode ser real
    // (dois Uber no mesmo dia) ou não; a pessoa decide com um toque, em vez de descobrir depois.
    const repeatGroups = new Map<string, ReviewItem[]>();
    for (const it of items) if (it.fileRepeat) repeatGroups.set(it.fileRepeat.key, [...(repeatGroups.get(it.fileRepeat.key) ?? []), it]);
    const sumImportable = importable.reduce((s, it) => s + (it.category === "INCOME" ? it.amount : -it.amount), 0);
    const expenseSum = importable.filter((it) => it.category === "EXPENSE").reduce((s, it) => s + it.amount, 0);
    const lowCoverage = stats ? stats.moneyLines > 0 && stats.parsed < stats.moneyLines * 0.5 && stats.moneyLines - stats.parsed >= 3 : false;
    const totalGap = stats?.invoiceTotal ? Math.round((stats.invoiceTotal - expenseSum) * 100) / 100 : 0;
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {semCategoria.length > 0 && (
          <div className="rounded-xl border border-accent/40 bg-accent-soft/30 px-4 py-3 text-sm">
            <p className="font-medium text-ink">{t.impSemCategoriaTitulo(semCategoria.length)}</p>
            <p className="text-caption text-ink-muted">
              {t.impSemCategoriaSub(semCategoria.length, money(semCategoria.reduce((sum, it) => sum + it.amount, 0)))}
            </p>
            <button
              type="button"
              onClick={() => {
                setReviewKeys(semCategoria.map((it) => it.key));
                setReviewIdx(0);
                setPhase("review");
              }}
              className="mt-1 text-sm font-medium text-accent-strong hover:underline"
            >
              {t.impCategorizar(semCategoria.length)}
            </button>
          </div>
        )}

        {/* Leitura que não parece dinheiro de gente. Fica ACIMA da conferência e em tom de alerta
            porque é o único aviso que diz "não confirme ainda": quando isso aparece, o mês inteiro
            da pessoa vai entrar errado — orçamento, saúde financeira e gráfico junto. */}
        {stats && stats.suspeitas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-danger/50 bg-danger/5 px-4 py-3">
            <p className="text-sm font-semibold text-danger">{t.impNumerosErrados}</p>
            {stats.suspeitas.map((s) => (
              <div key={s.texto} className="flex flex-col gap-1">
                <p className="text-caption text-ink">{s.texto}</p>
                {s.exemplos.length > 0 && (
                  <ul className="flex flex-col gap-0.5 pl-3 text-caption text-ink-muted">
                    {s.exemplos.map((e) => (
                      <li key={e} className="truncate">• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p className="text-caption text-ink-muted">{t.impNumerosErradosDica}</p>
            <FalarComSuporte arquivo={fileName} problema={stats.suspeitas[0]?.texto} rotulo={t.impFalarComAGente} />
          </div>
        )}

        {/* Conferência: o que o app leu, em números, pra pessoa não precisar confiar às cegas. */}
        <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
          <p className="font-semibold text-ink">
            {t.impResumoLancamentos(importable.length, docType === "fatura" ? money(expenseSum) : money(Math.abs(sumImportable)))}
            {docType !== "fatura" && ` ${t.impNoSaldo(sumImportable >= 0)}`}
          </p>
          {stats && <p className="text-caption text-ink-muted">{t.impEntendiComo(stats.summary)}</p>}
          {stats && (
            <p className="text-caption text-ink-muted">
              {t.impLinhasLidas(stats.parsed, stats.moneyLines)}
              {stats.invoiceTotal ? ` ${t.impTotalImpresso(money(stats.invoiceTotal))}` : ""}
            </p>
          )}
          {lowCoverage && (
            <div className="mt-1 flex flex-col gap-2">
              <p className="text-caption text-danger">{t.impCoberturaBaixa}</p>
              <FalarComSuporte arquivo={fileName} problema="o app leu só parte do arquivo" rotulo={t.impFaltouCoisa} />
            </div>
          )}
          {stats?.invoiceTotal && Math.abs(totalGap) >= 1 && (
            <p className="mt-1 text-caption text-danger">{t.impSomaDiferente(totalGap > 0, money(Math.abs(totalGap)))}</p>
          )}
        </div>

        {repeatGroups.size > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3">
            <p className="text-sm font-semibold text-ink">{t.impRepetidos}</p>
            <p className="text-caption text-ink-muted">{t.impRepetidosDica}</p>
            <ul className="flex flex-col gap-1.5">
              {[...repeatGroups.entries()].map(([key, group]) => (
                <li key={key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 truncate text-sm text-ink">
                    {group[0].description} · {money(group[0].amount)} · {group.length}× em {formatDate(group[0].date)}
                  </span>
                  {group.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((it) => it.fileRepeat?.key !== key || it.key === group[0].key))}
                      className="w-fit rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-ink-muted hover:text-ink"
                    >
                      {t.impDeixarSo1}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {importable.map((it) => (
            <li key={it.key} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{it.description}</p>
                <p className="text-caption text-ink-faint">
                  {formatDate(it.date)} ·{" "}
                  {it.category === "INCOME"
                    ? t.impRotuloRenda
                    : it.parentCategory
                      ? categoryLabel(kind, it.parentCategory)
                      : it.customCategoryId
                        ? customName(it.customCategoryId)
                        : "—"}
                </p>
              </div>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${it.category === "INCOME" ? "text-success" : "text-danger"}`}>
                {it.category === "INCOME" ? "+" : "−"} {money(it.amount)}
              </span>
            </li>
          ))}
        </ul>
        <Button type="button" onClick={handleImport} disabled={isPending || importable.length === 0}>
          {isPending ? t.impImportando : t.impImportarN(importable.length)}
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
      <p className="text-sm font-medium text-ink">{t.impImportadosSucesso(createdCount)}</p>

      {/* Candidatos a "pagamento desta fatura" já lançados no extrato: a pessoa decide, nunca
          removemos sozinhos (fatura raramente é paga por inteiro, o valor quase nunca bate
          exato — só ela sabe se aquele lançamento é mesmo esta fatura). */}
      {cardPaymentCandidates.length > 0 && (
        <div className="w-full rounded-xl border border-border bg-surface-2 p-3 text-left">
          <p className="text-xs font-medium text-ink-muted">{t.impPagamentoFatura(cardPaymentCandidates.length)}</p>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {cardPaymentCandidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{c.description}</p>
                  <p className="text-caption text-ink-faint">{c.date ? formatDate(c.date) : t.impSemData}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium tabular-nums text-danger">− {money(c.amount)}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await removeCardPaymentCandidateAction(c.id);
                        dismissCandidate(c.id);
                        showToast(t.impRemovidoExtrato);
                      });
                    }}
                    className="text-xs font-medium text-danger hover:underline disabled:opacity-40"
                  >
                    {t.impRemover}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissCandidate(c.id)}
                    className="text-xs text-ink-faint hover:text-ink"
                  >
                    {t.impManter}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button type="button" onClick={onDone}>
        {t.impConcluir}
      </Button>
    </div>
  );
}
