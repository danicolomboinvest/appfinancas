"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CheckSquare, ChevronDown, Pencil, PiggyBank, Receipt, Search, Square, Trash2, Wallet, X, type LucideIcon } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { ParentCategory } from "@prisma/client";
import type { CurrencyCode } from "@/lib/money";
import { Modal } from "@/components/ui/Modal";
import { nomeNaTela } from "@/lib/import/nome-na-tela";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Voz } from "@/lib/profiles/voice";
import { partesDoTexto } from "@/lib/profiles/textos/shell";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel, colorForCategorySlice, emojiEscolhido, isParentCategoryKey, categoriasParaEscolher, type CategoriasDoPerfil } from "@/lib/categories";
import { EntryForm } from "./EntryForm";
import { FolhaDaTransacao } from "./FolhaDaTransacao";
import { RESGATE } from "@/components/forms/CategoryFields";
import { ehResgate } from "@/lib/entries/resgate";
import {
  deleteMonthlyEntriesAction,
  deleteSeriesFromAction,
  undoDeleteEntriesAction,
  updateMonthlyEntriesCategoryAction,
  type DeletedEntrySnapshot,
} from "./actions";

export type ListEntry = {
  id: string;
  /** O mês do lançamento. Na lista de um período (trimestre, 7 dias) cada um tem o seu. */
  year?: number;
  month?: number;
  /** Dividir com alguém: com quem e quanto a pessoa deve (ver lib/entries/divisao.ts). */
  divididoCom?: string | null;
  parteDeOutro?: number | null;
  devolvido?: boolean;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  /** "YYYY-MM-DD" ou null. */
  entryDate: string | null;
  /** "Hoje", "Ontem" ou "dd/mm" — já calculado no servidor, no fuso do Brasil. */
  dayLabel: string | null;
  goalId: string | null;
  /** Cópia de um lançamento fixo ("Repetir todo mês": despesa, renda ou aporte): editar e apagar perguntam se é só este mês. */
  recurrenceId?: string | null;
  /** Lançado em outra moeda: "€ 2.000,00" já formatado no servidor, e os dados pra editar. */
  originalLabel?: string | null;
  originalAmount?: number | null;
  originalCurrency?: CurrencyCode | null;
  exchangeRate?: number | null;
  /** Perfil Casal: quem pagou/recebeu ("A"/"B") e se o gasto é da casa (false = pessoal). */
  pessoa?: string | null;
  doCasal?: boolean | null;
  /** Conta no limite do cartão (marcado "no cartão" ou linha de fatura). */
  noCartao?: boolean;
};


/** "Renda", "Gasto", "Aporte" — na voz do tema, porque o Girly não diz "aporte". */
function categoryKindLabel(category: ListEntry["category"], voz: Voz, amount = 0): string {
  if (category === "INCOME") return voz.titulos.uiTipoRenda;
  if (category === "EXPENSE") return voz.titulos.uiTipoGasto;
  // Guardado negativo é resgate (ver lib/entries/resgate.ts).
  return ehResgate({ category, amount }) ? voz.titulos.uiTipoResgate : voz.titulos.uiTipoAporte;
}

/** O valor da linha. Estorno (gasto negativo) e resgate (guardado negativo) são dinheiro voltando:
 * aparecem com "+" e o nome, em vez de um "-R$" que pareceria gasto. */
function valorDaLinha(entry: Pick<ListEntry, "category" | "amount">, voz: Voz, money: (v: number) => string): string {
  if (entry.amount < 0 && entry.category === "EXPENSE") return `Estorno +${money(Math.abs(entry.amount))}`;
  if (ehResgate(entry)) return `${voz.titulos.uiTipoResgate} +${money(Math.abs(entry.amount))}`;
  return money(entry.amount);
}

const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Hoje, quarta 7", "Ontem, terça 6", "Segunda 5" (o dia em "YYYY-MM-DD", hoje idem). */
export function rotuloDoDia(dia: string, hoje: string): string {
  if (dia === "sem-data") return "Sem data";
  const d = new Date(`${dia}T12:00:00Z`);
  const semana = DIAS_DA_SEMANA[d.getUTCDay()];
  const ontem = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10);
  if (dia === hoje) return `Hoje, ${semana} ${d.getUTCDate()}`;
  if (dia === ontem) return `Ontem, ${semana} ${d.getUTCDate()}`;
  if (dia > hoje) return `${semana.charAt(0).toUpperCase() + semana.slice(1)} ${d.getUTCDate()}, a vencer`;
  return `${semana.charAt(0).toUpperCase() + semana.slice(1)} ${d.getUTCDate()}`;
}

/** O valor da linha como no protótipo: "− R$ 54,90" com os centavos pequenos. */
function ValorDaLinha({ entry, voz, money }: { entry: ListEntry; voz: Voz; money: (v: number) => string }) {
  const especial = (entry.amount < 0 && entry.category === "EXPENSE") || ehResgate(entry);
  if (especial) return <span className="text-[15px] tabular-nums text-success">{valorDaLinha(entry, voz, money)}</span>;
  const texto = money(Math.abs(entry.amount));
  const virgula = texto.lastIndexOf(",");
  const [inteiro, centavos] = virgula > 0 ? [texto.slice(0, virgula), texto.slice(virgula)] : [texto, ""];
  const sinal = entry.category === "INCOME" ? "+" : entry.category === "EXPENSE" ? "−" : "";
  return (
    <span className="whitespace-nowrap text-[16px] tabular-nums text-ink">
      {sinal && <span className="mr-1">{sinal}</span>}
      {inteiro}
      <span className="text-[0.72em]">{centavos}</span>
    </span>
  );
}

function categoryVisual(
  entry: ListEntry,
  customCategories: { id: string; icon: string }[],
  tema: string,
  kind: CategoriasDoPerfil,
): { icon: LucideIcon; color: string; emoji: string | undefined } {
  // Entrada com a carteira verde (protótipo); o valor fica em tinta, com o "+".
  if (entry.category === "INCOME") return { icon: Wallet, color: "var(--color-success)", emoji: emojiDaCategoria(tema, { kind: "income" }) };
  if (entry.category === "INVESTMENT_CONTRIBUTION") return { icon: PiggyBank, color: "var(--color-accent)", emoji: emojiDaCategoria(tema, { kind: "investment" }) };
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) {
    return {
      icon: categoryIcon(kind, entry.parentCategory),
      color: colorForCategorySlice({ kind: "parent", value: entry.parentCategory }, kind),
      emoji: emojiEscolhido(kind, entry.parentCategory) ?? emojiDaCategoria(tema, { kind: "parent", value: entry.parentCategory }),
    };
  }
  if (entry.customCategoryId) {
    const custom = customCategories.find((c) => c.id === entry.customCategoryId);
    return {
      icon: custom ? (CUSTOM_CATEGORY_ICON_MAP[custom.icon] ?? Receipt) : Receipt,
      color: colorForCategorySlice({ kind: "custom", value: entry.customCategoryId }, kind),
      emoji: emojiEscolhido(kind, entry.customCategoryId) ?? emojiDaCategoria(tema, { kind: "custom", iconKey: custom?.icon }),
    };
  }
  return { icon: Receipt, color: "var(--color-ink-faint)", emoji: emojiDaCategoria(tema, { kind: "none" }) };
}

function categoryName(entry: ListEntry, customCategories: { id: string; name: string }[], voz: Voz, kind: CategoriasDoPerfil): string {
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) return categoryLabel(kind, entry.parentCategory);
  if (entry.customCategoryId) return customCategories.find((c) => c.id === entry.customCategoryId)?.name ?? voz.titulos.uiCategoriaSemNome;
  return categoryKindLabel(entry.category, voz, entry.amount);
}

function toSnapshot(entry: ListEntry, year: number, month: number): DeletedEntrySnapshot {
  return {
    year: entry.year ?? year,
    month: entry.month ?? month,
    divididoCom: entry.divididoCom ?? null,
    parteDeOutro: entry.parteDeOutro ?? null,
    category: entry.category,
    parentCategory: entry.parentCategory,
    customCategoryId: entry.customCategoryId,
    subcategory: entry.subcategory,
    description: entry.description,
    amount: entry.amount,
    entryDate: entry.entryDate,
    goalId: entry.goalId,
    originalAmount: entry.originalAmount ?? null,
    originalCurrency: entry.originalCurrency ?? null,
    exchangeRate: entry.exchangeRate ?? null,
    recurrenceId: entry.recurrenceId ?? null,
  };
}

/**
 * A lista de lançamentos do mês.
 *
 * Antes cada linha carregava "✎ Editar" e "🗑 Remover" por extenso, e no celular os dois
 * botões engoliam a largura: sobrava "Sem s…" pro nome e a pessoa não conseguia LER o que
 * tinha lançado — a lista servia pra editar, não pra ver. Agora a linha é só leitura (nome,
 * data, descrição, valor) e abre ao toque numa folha com tudo por extenso e os dois botões
 * com espaço de sobra. No computador, onde cabe, os ícones ficam inline.
 *
 * E existe um modo "Selecionar": marca várias linhas e remove de uma vez, com Desfazer.
 * Editar em lote não existe de propósito — dois lançamentos raramente querem a MESMA
 * alteração, e um botão que promete isso entrega um formulário confuso.
 */
export function EntryList({
  entries,
  year,
  month,
  recentSubcategories,
  customCategories,
  goals,
  pessoasDaDivisao = [],
}: {
  /** Com quem ela já dividiu alguma conta (para o "Com quem?" do Dividir). */
  pessoasDaDivisao?: string[];
  entries: ListEntry[];
  year: number;
  month: number;
  recentSubcategories: Partial<Record<ParentCategory, string[]>>;
  customCategories: { id: string; name: string; icon: string }[];
  goals: { id: string; name: string }[];
}) {
  // O tema decide se a categoria é ícone de linha ou emoji (ver icones.ts); a voz, o que a
  // lista diz ("Ver mais", "Remover", os avisos de excluído/restaurado); o tipo do perfil,
  // como cada categoria-mãe se chama (numa Empresa, MORADIA é "Estrutura").
  // `categorias`: o tipo do perfil com o nome, o ícone e as escondidas que ela escolheu.
  const { key: tema, voz, categorias: kind, nomesDoCasal } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const { showToast, showError } = useToast();
  const [, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);
  // Hoje no aparelho, para marcar a conta que ainda vai vencer. No inicializador, não no render.
  const [hoje] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategorizing, setBulkCategorizing] = useState(false);
  // Despesa fixa: antes de apagar, pergunta se é só este mês ou este e os próximos.
  const [apagandoFixa, setApagandoFixa] = useState<ListEntry | null>(null);

  // Transações (versão nova): busca, Saídas/Entradas/Cartão e uma categoria, como no protótipo.
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "saidas" | "entradas" | "cartao">("todas");
  // O painel da categoria no Orçamento abre aqui já filtrado (?categoria=SAUDE).
  const buscaDaUrl = useSearchParams();
  // Várias categorias de uma vez (protótipo: folha "Categorias" com Limpar e Aplicar).
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>(() => (buscaDaUrl.get("categoria") ? [buscaDaUrl.get("categoria")!] : []));
  const [folhaDeCategorias, setFolhaDeCategorias] = useState(false);
  const [rascunhoCategorias, setRascunhoCategorias] = useState<string[]>([]);
  const open = entries.find((e) => e.id === openId) ?? null;
  const editing = entries.find((e) => e.id === editingId) ?? null;

  function removeEntries(targets: ListEntry[], mensagem?: string) {
    if (targets.length === 0) return;
    const snapshots = targets.map((t) => toSnapshot(t, year, month));
    const quantos = targets.length;
    startTransition(async () => {
      // Sem o try, a internet caindo (ou a sessão expirando) no meio da exclusão subia pro
      // error boundary da raiz e trocava o app inteiro — menu e abas — pela tela de erro.
      let resultado: Awaited<ReturnType<typeof deleteMonthlyEntriesAction>>;
      try {
        resultado = await deleteMonthlyEntriesAction(
          targets.map((t) => t.id),
          year,
          month,
        );
      } catch (err) {
        console.error("deleteMonthlyEntriesAction falhou", err);
        showError(t.acaoFalhou);
        return;
      }
      const { jaNaCarteira, allocations, origens } = resultado;
      // O "Desfazer" devolve o aporte com os ativos em que ele já tinha entrado; sem isso ele
      // voltava "sem destino" e a meta contava aporte + ativo. E devolve o lote/transação de
      // origem, senão o lançamento voltava como "feito à mão".
      targets.forEach((entry, i) => {
        snapshots[i].allocations = allocations[entry.id] ?? [];
        snapshots[i].importBatchId = origens[entry.id]?.importBatchId ?? null;
        snapshots[i].externalId = origens[entry.id]?.externalId ?? null;
      });
      // Aporte que já tinha sido distribuído: o dinheiro fica no ativo de propósito (é a posição
      // real da pessoa). Dizer isso na hora é o que impede o mês e a carteira de divergirem
      // sem ninguém perceber.
      const base = mensagem ?? t.uiExcluido(quantos);
      showToast(jaNaCarteira > 0 ? `${base} ${t.uiExcluidoContinuaNaCarteira}` : base, {
        label: t.uiDesfazer,
        onClick: () => {
          startTransition(async () => {
            const result = await undoDeleteEntriesAction(snapshots).catch(() => ({ ok: false }));
            if (result.ok) showToast(t.uiRestaurado(quantos));
            else showError(t.uiRestaurarFalhou);
          });
        },
      });
    });
  }

  function pedirRemocao(entry: ListEntry) {
    if (entry.recurrenceId) setApagandoFixa(entry);
    else removeEntries([entry]);
  }

  /** "Este e os próximos": a série inteira daqui pra frente, com Desfazer pra todas as cópias. */
  function removeSerie(entry: ListEntry) {
    startTransition(async () => {
      let resultado: Awaited<ReturnType<typeof deleteSeriesFromAction>>;
      try {
        resultado = await deleteSeriesFromAction(entry.id);
      } catch (err) {
        console.error("deleteSeriesFromAction falhou", err);
        showError(t.acaoFalhou);
        return;
      }
      const { apagados, jaNaCarteira, snapshots } = resultado;
      if (apagados === 0) {
        showError(t.uiFixoNaoAchei);
        return;
      }
      // Mesmo aviso do "Só este mês": aporte já distribuído fica no ativo, e ela precisa saber.
      const base = t.uiExcluido(apagados);
      showToast(jaNaCarteira > 0 ? `${base} ${t.uiExcluidoContinuaNaCarteira}` : base, {
        label: t.uiDesfazer,
        onClick: () => {
          startTransition(async () => {
            const result = await undoDeleteEntriesAction(snapshots).catch(() => ({ ok: false }));
            if (result.ok) showToast(t.uiRestaurado(apagados));
            else showError(t.uiRestaurarFalhou);
          });
        },
      });
    });
  }

  /** Muda a categoria de todos os marcados de uma vez — as parcelas de uma mesma compra que
   * caíram em "Outros" na importação, por exemplo, todas pra mesma categoria de verdade. */
  function applyBulkCategory(category: { parentCategory: ParentCategory | null; customCategoryId: string | null }) {
    const ids = [...selected];
    setBulkCategorizing(false);
    startTransition(async () => {
      try {
        const { count } = await updateMonthlyEntriesCategoryAction(ids, category, year, month);
        showToast(t.uiCategoriaAtualizada(count));
      } catch (err) {
        console.error("updateMonthlyEntriesCategoryAction falhou", err);
        showError(t.acaoFalhou);
      }
    });
    leaveSelection();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leaveSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function renderRow(entry: ListEntry) {
    const visual = categoryVisual(entry, customCategories, tema, kind);
    const marcado = selected.has(entry.id);
    const nomeDaCategoria = categoryName(entry, customCategories, voz, kind);
    // Como no protótipo: o nome (a loja, a conta) em cima; a categoria e "cartão" embaixo.
    // O nome limpo (12/10/2026): sem "Transferência recebida pelo Pix", CNPJ e banco, que ficam no detalhe.
    const titulo = (entry.description ? nomeNaTela(entry.description).nome : "") || entry.subcategory || nomeDaCategoria;
    return (
      <div key={entry.id} className={`flex items-center gap-3 px-3 py-3 transition-colors ${marcado ? "bg-accent-soft/40" : ""}`}>
        <button
          type="button"
          onClick={() => (selecting ? toggle(entry.id) : setOpenId(entry.id))}
          data-linha-transacao
          aria-pressed={selecting ? marcado : undefined}
          aria-label={selecting ? `${marcado ? "Desmarcar" : "Marcar"} ${titulo}` : `Abrir ${titulo}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {selecting ? (
            <span className={`shrink-0 ${marcado ? "text-accent-strong" : "text-ink-faint"}`}>
              {marcado ? <CheckSquare size={22} strokeWidth={1.75} /> : <Square size={22} strokeWidth={1.75} />}
            </span>
          ) : (
            <LogoDoLancamento descricao={entry.description} icon={visual.icon} emoji={visual.emoji} cor={visual.color} />
          )}
          <span className="min-w-0 flex-1">
            {/* O nome inteiro quebra a linha em vez de cortar ("Aplicação · Reserva de emergência" a 320 px). */}
            <span className="block break-words text-[16px] leading-snug text-ink">{titulo}</span>
            <span className="block truncate text-[13px] text-ink-muted">
              {/* Perfil Casal: de quem é, e "Pessoal" quando o gasto fica fora do acerto. */}
              {nomesDoCasal && (entry.pessoa === "A" || entry.pessoa === "B") && (
                <span className="font-medium">
                  {nomesDoCasal[entry.pessoa]}
                  {entry.category === "EXPENSE" && entry.doCasal === false ? ", Pessoal" : ""}
                  {" · "}
                </span>
              )}
              {/* Conta lançada antes de pagar (03/10/2026): mostra que ainda vai vencer. */}
              {entry.divididoCom && (
                <span className="mr-1 rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent-strong">{entry.parteDeOutro ? `dividido com ${entry.divididoCom}` : `presente`}</span>
              )}
              {entry.category === "EXPENSE" && entry.entryDate && entry.entryDate > hoje && (
                <span className="mr-1 rounded-full border border-border-strong px-1.5 py-px font-medium">a vencer</span>
              )}
              {/* Entrada que ela marcou como "para o mês seguinte": caiu em outro mês. */}
              {entry.category === "INCOME" && entry.entryDate && Number(entry.entryDate.slice(5, 7)) !== (entry.month ?? month) && (
                <span className="mr-1 rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent-strong">
                  recebido {entry.entryDate.slice(8, 10)}/{entry.entryDate.slice(5, 7)}
                </span>
              )}
              {entry.category === "INCOME" ? "Entrada" : entry.category === "INVESTMENT_CONTRIBUTION" ? categoryKindLabel(entry.category, voz, entry.amount) : nomeDaCategoria}
              {entry.noCartao ? " · cartão" : ""}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <ValorDaLinha entry={entry} voz={voz} money={money} />
            {entry.originalLabel && <span className="text-xs tabular-nums text-ink-faint">{entry.originalLabel}</span>}
          </span>
        </button>

        {/* No computador cabe: ícones sem texto, com o rótulo no aria-label. */}
        {!selecting && (
          <span className="hidden shrink-0 items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => setEditingId(entry.id)}
              aria-label={t.uiEditarLancamento}
              title={t.uiEditar}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => pedirRemocao(entry)}
              aria-label={t.uiRemoverLancamento}
              title={t.uiRemover}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </span>
        )}
      </div>
    );
  }

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = entries.filter((e) => {
    if (filtro === "saidas" && e.category !== "EXPENSE") return false;
    if (filtro === "entradas" && e.category !== "INCOME") return false;
    if (filtro === "cartao" && !e.noCartao) return false;
    if (categoriasFiltro.length > 0 && !categoriasFiltro.includes((e.customCategoryId ?? e.parentCategory) as string)) return false;
    if (termo) {
      const texto = `${e.description ?? ""} ${e.subcategory ?? ""} ${categoryName(e, customCategories, voz, kind)}`.toLocaleLowerCase("pt-BR");
      if (!texto.includes(termo)) return false;
    }
    return true;
  });
  // Por dia, do mais recente: "Hoje, quarta 7", "Ontem, terça 6", "Segunda 5". Sem data, no fim.
  const grupos = new Map<string, ListEntry[]>();
  for (const e of [...filtradas].sort((a, b) => (b.entryDate ?? "").localeCompare(a.entryDate ?? ""))) {
    const k = e.entryDate ?? "sem-data";
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  const nomeDaChave = (k: string) => (isParentCategoryKey(k) ? categoryLabel(kind, k) : (customCategories.find((c) => c.id === k)?.name ?? "Categoria"));
  // A folha "Categorias" lista TODAS as do perfil (12/10/2026): só as do mês deixava a folha vazia
  // num mês só com entradas. As que aparecem no mês vêm primeiro; depois as padrão e as criadas.
  const doMes = [...new Set(entries.filter((e) => e.category === "EXPENSE").map((e) => e.customCategoryId ?? e.parentCategory).filter((k): k is string => Boolean(k)))];
  const categoriasDoMes = [...new Set([...doMes, ...categoriasParaEscolher(kind).map(String), ...customCategories.map((c) => c.id)])];

  // Categoria só existe em Gasto (Renda e Aporte não têm categoria-mãe): o botão de mudar em
  // lote só aparece quando TUDO que está marcado é gasto, pra não prometer uma troca que não
  // faz sentido pro que a pessoa selecionou.
  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const podeCategorizarEmLote = selectedEntries.length > 0 && selectedEntries.every((e) => e.category === "EXPENSE");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-caption text-ink-faint">{t.uiContagemLancamentos(entries.length)}</p>
        {selecting ? (
          <button type="button" onClick={leaveSelection} className="text-caption font-medium text-accent-strong">
            {t.uiCancelar}
          </button>
        ) : (
          <button type="button" onClick={() => setSelecting(true)} className="text-caption font-medium text-accent-strong">
            {t.uiSelecionar}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="flex min-h-12 items-center gap-2.5 rounded-full border border-border bg-surface px-4">
          <Search size={18} strokeWidth={1.6} className="shrink-0 text-ink-muted" aria-hidden />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar nos lançamentos" className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted" />
        </label>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar">
          {(
            [
              ["todas", "Todas"],
              ["saidas", "Saídas"],
              ["entradas", "Entradas"],
              ["cartao", "Cartão"],
            ] as const
          ).map(([k, rotulo]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={`min-h-10 shrink-0 rounded-full px-4 text-[15px] ${filtro === k ? "bg-ink text-canvas" : "bg-surface-2 text-ink"}`}>
              {rotulo}
            </button>
          ))}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setRascunhoCategorias(categoriasFiltro);
              setFolhaDeCategorias(true);
            }}
            className="flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-4 text-[15px] text-ink"
          >
            Categoria <ChevronDown size={15} aria-hidden />
          </button>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${categoriasFiltro.length ? "" : "hidden"}`} data-filtro-categoria>
          {categoriasFiltro.map((k) => (
            <button key={k} type="button" onClick={() => setCategoriasFiltro((l) => l.filter((x) => x !== k))} aria-label={`Tirar o filtro ${nomeDaChave(k)}`} className="flex min-h-10 items-center gap-1 rounded-full bg-ink px-3.5 text-[15px] text-canvas">
              {nomeDaChave(k)} <X size={14} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <Modal open={folhaDeCategorias} onClose={() => setFolhaDeCategorias(false)} title="Categorias">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {categoriasDoMes.map((k) => {
              const on = rascunhoCategorias.includes(k);
              const v = categoryVisual({ category: "EXPENSE", parentCategory: isParentCategoryKey(k) ? k : null, customCategoryId: isParentCategoryKey(k) ? null : k } as ListEntry, customCategories, tema, kind);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRascunhoCategorias((l) => (on ? l.filter((x) => x !== k) : [...l, k]))}
                  className="relative flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-surface p-3 text-left text-[15px] text-ink shadow-[inset_0_0_0_1px_var(--color-border)] aria-pressed:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
                >
                  <CategoryIcon icon={v.icon} color={v.color} size={36} variant="soft" />
                  <span className="w-full truncate">{nomeDaChave(k)}</span>
                  <span className={`absolute right-3 top-3 flex size-[22px] items-center justify-center rounded-full ${on ? "bg-ink text-canvas" : "shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]"}`} aria-hidden>
                    {on && <Check size={13} strokeWidth={2.2} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRascunhoCategorias([])} className="min-h-12 rounded-full bg-surface text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoriasFiltro(rascunhoCategorias);
                setFolhaDeCategorias(false);
              }}
              className="min-h-12 rounded-full bg-ink text-[15px] font-medium text-canvas"
            >
              Aplicar
            </button>
          </div>
        </div>
      </Modal>

      {filtradas.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center" data-vazio-filtro>
          <Receipt size={36} strokeWidth={1.4} className="text-ink-faint" aria-hidden />
          <b className="text-[15px] font-medium text-ink">Nada com esse filtro</b>
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setFiltro("todas");
              setCategoriasFiltro([]);
            }}
            className="min-h-10 rounded-full bg-surface-2 px-4 text-sm text-ink"
          >
            Limpar filtros
          </button>
        </div>
      )}
      {[...grupos.entries()].map(([dia, lista]) => (
        <section key={dia} className="flex flex-col gap-2">
          <h3 className="px-1 pt-2 text-sm text-ink-muted">{rotuloDoDia(dia, hoje)}</h3>
          <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">{lista.map(renderRow)}</div>
        </section>
      ))}

      {/* Barra do modo seleção: acima da tab bar do celular, com o que dá pra fazer.
          No celular os botões são só ícone (o nome vai no aria-label): com "Categoria" e
          "Remover" por extenso a barra pedia ~390px em 343, e o .glass (overflow: hidden)
          cortava o "Remover" e sumia com o X de sair. No computador a barra cresce com o
          conteúdo em vez de ficar presa em 384px. */}
      {selecting && (
        <div className="fixed inset-x-4 bottom-[calc(6.5rem_+_var(--safe-bottom))] z-30 md:inset-x-auto md:bottom-6 md:right-10">
          <div className="glass flex items-center justify-between gap-3 rounded-2xl border border-border-strong p-3 shadow-premium">
            <span className="min-w-0 text-sm text-ink">
              {/* "**3** selecionados": o número vem marcado na voz e vira o destaque aqui. */}
              {partesDoTexto(t.uiSelecionados(selected.size)).map((p, i) =>
                p.negrito ? (
                  <span key={i} className="font-semibold tabular-nums">
                    {p.texto}
                  </span>
                ) : (
                  p.texto
                ),
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {podeCategorizarEmLote && (
                <button
                  type="button"
                  onClick={() => setBulkCategorizing(true)}
                  aria-label={t.uiMudarCategoria}
                  title={t.uiMudarCategoria}
                  className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-accent-gradient px-3 text-sm font-semibold text-on-accent transition-opacity md:px-4"
                >
                  <Pencil size={15} strokeWidth={2} />
                  <span className="hidden whitespace-nowrap md:inline">{t.uiMudarCategoria}</span>
                </button>
              )}
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => {
                  removeEntries(entries.filter((e) => selected.has(e.id)));
                  leaveSelection();
                }}
                aria-label={t.uiRemover}
                title={t.uiRemover}
                className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-danger px-3 text-sm font-semibold text-canvas transition-opacity disabled:opacity-40 md:px-4"
              >
                <Trash2 size={15} strokeWidth={2} />
                <span className="hidden whitespace-nowrap md:inline">{t.uiRemover}</span>
              </button>
              <button
                type="button"
                onClick={leaveSelection}
                aria-label={t.uiSairDaSelecao}
                className="rounded-full p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Muda a categoria de todos os marcados de uma vez — parcelas de uma mesma compra, por
          exemplo, que a classificação automática jogou em "Outros" mas são todas a mesma coisa. */}
      <Modal open={bulkCategorizing} onClose={() => setBulkCategorizing(false)} title={t.uiMudarCategoriaTitulo(selected.size)}>
        <div className="flex flex-wrap gap-2">
          {categoriasParaEscolher(kind).map((pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => applyBulkCategory({ parentCategory: pc, customCategoryId: null })}
              className="rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft"
            >
              {categoryLabel(kind, pc)}
            </button>
          ))}
          {customCategories.map((cc) => (
            <button
              key={cc.id}
              type="button"
              onClick={() => applyBulkCategory({ parentCategory: null, customCategoryId: cc.id })}
              className="rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft"
            >
              {cc.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Folha "Transação" (protótipo aprovado): nome igual ao da lista, valor grande e as quatro
          ações redondas (Dividir, Separar, Trocar categoria, Ignorar); Editar e Remover embaixo. */}
      <Modal open={open !== null} onClose={() => setOpenId(null)} title="Transação">
        {open && (
          <FolhaDaTransacao
            key={open.id}
            entry={open}
            titulo={open.description || open.subcategory || categoryName(open, customCategories, voz, kind)}
            nomeDaCategoria={categoryName(open, customCategories, voz, kind)}
            tipo={categoryKindLabel(open.category, voz, open.amount)}
            visual={categoryVisual(open, customCategories, tema, kind)}
            valor={valorDaLinha(open, voz, money)}
            money={money}
            kind={kind}
            customCategories={customCategories}
            pessoas={pessoasDaDivisao}
            onFechar={() => setOpenId(null)}
            onEditar={() => {
              setOpenId(null);
              setEditingId(open.id);
            }}
            onRemover={() => {
              const alvo = open;
              setOpenId(null);
              pedirRemocao(alvo);
            }}
            onIgnorar={() => {
              const alvo = open;
              setOpenId(null);
              removeEntries([alvo], `${open.description || categoryName(open, customCategories, voz, kind)} ignorado: não conta nos totais`);
            }}
            onTrocar={(c) => {
              const alvo = open;
              const de = categoryName(alvo, customCategories, voz, kind);
              setOpenId(null);
              startTransition(async () => {
                try {
                  await updateMonthlyEntriesCategoryAction([alvo.id], c, alvo.year ?? year, alvo.month ?? month);
                  const para = c.customCategoryId ? (customCategories.find((x) => x.id === c.customCategoryId)?.name ?? "") : categoryLabel(kind, c.parentCategory as ParentCategory);
                  showToast(`${alvo.description || de}: ${de} → ${para}`);
                } catch (err) {
                  console.error("updateMonthlyEntriesCategoryAction falhou", err);
                  showError(t.acaoFalhou);
                }
              });
            }}
          />
        )}
      </Modal>

      {/* O título diz o tipo: renda e aporte também se repetem, e chamar o salário de "despesa
          fixa" confundia bem na hora de escolher entre só este mês e a série. */}
      <Modal
        open={apagandoFixa !== null}
        onClose={() => setApagandoFixa(null)}
        title={t.uiFixoApagarTitulo(apagandoFixa?.category ?? "EXPENSE")}
      >
        {apagandoFixa && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{t.uiFixoApagarTexto(apagandoFixa.category)}</p>
            <button
              type="button"
              onClick={() => {
                const alvo = apagandoFixa;
                setApagandoFixa(null);
                removeEntries([alvo]);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover"
            >
              {t.uiFixoSoEste}
            </button>
            <button
              type="button"
              onClick={() => {
                const alvo = apagandoFixa;
                setApagandoFixa(null);
                removeSerie(alvo);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-danger-soft text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-canvas"
            >
              {t.uiFixoEsteEProximos}
            </button>
          </div>
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditingId(null)} title={t.uiEditarLancamento}>
        {editing && (
          <EntryForm
            year={editing.year ?? year}
            month={editing.month ?? month}
            entryId={editing.id}
            recentSubcategories={recentSubcategories}
            customCategories={customCategories}
            goals={goals}
            layout="stacked"
            onSuccess={() => setEditingId(null)}
            defaultDescription={editing.description ?? undefined}
            defaultAmount={Math.abs(editing.originalCurrency ? (editing.originalAmount ?? editing.amount) : editing.amount)}
            defaultCurrency={editing.originalCurrency ?? undefined}
            defaultExchangeRate={editing.exchangeRate ?? undefined}
            defaultCategory={ehResgate(editing) ? RESGATE : editing.category}
            defaultParentCategory={(editing.parentCategory as ParentCategory) ?? undefined}
            defaultSubcategory={editing.subcategory ?? undefined}
            defaultCustomCategoryId={editing.customCategoryId ?? undefined}
            defaultEntryDate={editing.entryDate ?? undefined}
            defaultGoalId={editing.goalId ?? undefined}
            recorrente={Boolean(editing.recurrenceId)}
            tipoRecorrente={editing.category}
            defaultPessoa={editing.pessoa}
            defaultDoCasal={editing.doCasal}
            defaultNoCartao={editing.noCartao}
          />
        )}
      </Modal>
    </div>
  );
}
