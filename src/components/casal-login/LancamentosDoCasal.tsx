"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { apagarNoCasalAction, editarNoCasalAction, lancarNoCasalAction } from "@/app/(app)/divisao/nos-dois-actions";
import type { Destino, LancamentoDoCasal } from "@/lib/repositories/nos-dois.repo";
import { BOTAO_ESCURO, Bolinha, CARTAO } from "./visual";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Nomes = { A: string; B: string };

/**
 * Os lançamentos do mês no Nós dois, como o par vê: os nossos e os de cada um que os dois veem,
 * com quem lançou, e o "só meu" dele com cadeado. O "só meu" da titular nem chega aqui (o filtro
 * de privacidade tira no servidor). O par edita e apaga só o que ele lançou.
 */
export function LancamentosDoCasal({
  itens,
  nomes,
  letraTitular,
  minhaLetra,
  mes,
  podeLancar,
}: {
  itens: LancamentoDoCasal[];
  nomes: Nomes;
  letraTitular: "A" | "B";
  minhaLetra: "A" | "B";
  mes: number;
  podeLancar: boolean;
}) {
  const money = useMoney();
  const [editando, setEditando] = useState<LancamentoDoCasal | "novo" | null>(null);
  const total = itens.filter((i) => i.categoria === "EXPENSE").reduce((s, i) => s + i.valor, 0);

  return (
    <section aria-label="Lançamentos do mês">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[19px] font-semibold text-ink">Lançamentos</h2>
        <span className="text-[14px] text-ink-muted">
          {itens.length} em {MESES[mes - 1]}
          {itens.length > 0 ? ` · ${money(total, { round: true })}` : ""}
        </span>
      </div>
      {itens.length === 0 ? (
        <p className={`${CARTAO} p-5 text-[15px] text-ink-muted`}>Nada lançado neste mês ainda.</p>
      ) : (
        <ul className={`${CARTAO} divide-y divide-border px-4`}>
          {itens.map((l) => {
            const quem = l.pessoa ?? letraTitular;
            const linha = (
              <>
                <Bolinha nome={nomes[quem]} cor={quem === letraTitular ? "titular" : "par"} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[16px] text-ink">
                    {l.destino === "so-meu" && <Lock size={14} strokeWidth={1.8} className="shrink-0 text-ink-muted" aria-label="Só meu" />}
                    <span className="truncate">{l.descricao || (l.parentCategory ? PARENT_CATEGORY_LABEL[l.parentCategory] : l.categoria === "INCOME" ? "Entrada" : "Gasto")}</span>
                  </span>
                  <span className="block truncate text-[13px] text-ink-muted">
                    {l.categoria === "INCOME" ? `Entrada de ${nomes[quem]}` : l.destino === "nosso" ? "Nosso" : l.destino === "so-meu" ? "Só meu" : `De ${nomes[quem]}`}
                    {l.dia ? ` · ${l.dia.slice(8, 10)}/${l.dia.slice(5, 7)}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 text-[16px] tabular-nums ${l.categoria === "INCOME" ? "text-success" : "text-ink"}`}>
                  {l.categoria === "INCOME" ? "+" : ""}
                  {money(l.valor, { round: true })}
                </span>
              </>
            );
            return (
              <li key={l.id}>
                {l.podeMexer && podeLancar ? (
                  <button type="button" onClick={() => setEditando(l)} className="flex w-full items-center gap-3 py-3 text-left">
                    {linha}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 py-3">{linha}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {podeLancar && (
        <button
          type="button"
          onClick={() => setEditando("novo")}
          aria-label="Lançar no Nós dois"
          className="fixed bottom-[calc(1.25rem+var(--safe-bottom))] right-5 z-50 flex size-[60px] items-center justify-center rounded-full bg-accent text-on-accent botao-flutuante shadow-[0_2px_6px_rgba(0,0,0,0.08),0_14px_28px_-10px_color-mix(in_srgb,var(--color-accent)_60%,transparent)] transition-transform active:scale-95"
        >
          <Plus size={28} strokeWidth={1.8} aria-hidden />
        </button>
      )}
      <FolhaDeLancar
        aberto={editando !== null}
        item={editando === "novo" ? null : editando}
        onClose={() => setEditando(null)}
        meuNome={nomes[minhaLetra]}
      />
    </section>
  );
}

function FolhaDeLancar({ aberto, item, onClose, meuNome }: { aberto: boolean; item: LancamentoDoCasal | null; onClose: () => void; meuNome: string }) {
  const router = useRouter();
  const moeda = useCurrency();
  const [tipo, setTipo] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<ParentCategory>("ALIMENTACAO");
  const [destino, setDestino] = useState<Destino>("nosso");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();

  const [chave, setChave] = useState<string | null>(null);
  const agora = aberto ? (item?.id ?? "novo") : null;
  if (agora !== chave) {
    setChave(agora);
    setErro(null);
    setTipo(item?.categoria === "INCOME" ? "INCOME" : "EXPENSE");
    setValor(item ? String(item.valor).replace(".", ",") : "");
    setDescricao(item?.descricao ?? "");
    setCategoria(item?.parentCategory ?? "ALIMENTACAO");
    setDestino(item?.destino ?? "nosso");
  }

  function salvar() {
    setErro(null);
    start(async () => {
      const dados = { categoria: tipo, valor, descricao, parentCategory: categoria, destino, dia: item?.dia ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) };
      const r = item ? await editarNoCasalAction(item.id, dados) : await lancarNoCasalAction(dados);
      if (!r.ok) return setErro(r.mensagem);
      onClose();
      router.refresh();
    });
  }

  function apagar() {
    if (!item) return;
    start(async () => {
      const r = await apagarNoCasalAction(item.id);
      if (!r.ok) return setErro(r.mensagem);
      onClose();
      router.refresh();
    });
  }

  const pilula = (ativo: boolean) => `flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] font-semibold ${ativo ? "bg-ink text-canvas" : "text-ink"}`;

  return (
    <Modal open={aberto} onClose={onClose} title={item ? "Editar lançamento" : "Lançar no Nós dois"}>
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Tipo" className="flex gap-1 rounded-full bg-surface-2 p-1">
          <button type="button" aria-pressed={tipo === "EXPENSE"} onClick={() => setTipo("EXPENSE")} className={pilula(tipo === "EXPENSE")}>
            Gastei
          </button>
          <button type="button" aria-pressed={tipo === "INCOME"} onClick={() => setTipo("INCOME")} className={pilula(tipo === "INCOME")}>
            Entrou
          </button>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] text-ink-muted">Valor</span>
          <span className="flex h-14 items-center gap-2 rounded-2xl bg-surface px-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <span className="text-[15px] text-ink-muted">{currencySymbol(moeda)}</span>
            <input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0,00" className="h-full min-w-0 flex-1 bg-transparent text-[20px] text-ink outline-none" />
          </span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] text-ink-muted">O que foi</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value.slice(0, 120))} placeholder="Mercado, farmácia..." className="h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none shadow-[inset_0_0_0_1px_var(--color-border)]" />
        </label>
        {tipo === "EXPENSE" && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[15px] text-ink-muted">Categoria</span>
              <div className="flex flex-wrap gap-2">
                {PARENT_CATEGORIES.filter((c) => c !== "IMPOSTOS").map((c) => (
                  <button key={c} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)} className={`min-h-10 rounded-full px-3.5 text-[14px] font-medium ${categoria === c ? "bg-ink text-canvas" : "bg-surface-2 text-ink"}`}>
                    {PARENT_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[15px] text-ink-muted">Esse gasto é</span>
              <div role="group" aria-label="Esse gasto é" className="flex gap-1 rounded-full bg-surface-2 p-1">
                <button type="button" aria-pressed={destino === "nosso"} onClick={() => setDestino("nosso")} className={pilula(destino === "nosso")}>
                  Nosso
                </button>
                <button type="button" aria-pressed={destino === "da-pessoa"} onClick={() => setDestino("da-pessoa")} className={pilula(destino === "da-pessoa")}>
                  <span className="truncate">De {meuNome}</span>
                </button>
                <button type="button" aria-pressed={destino === "so-meu"} onClick={() => setDestino("so-meu")} className={pilula(destino === "so-meu")}>
                  <Lock size={14} strokeWidth={1.8} aria-hidden />
                  Só meu
                </button>
              </div>
              <p className="text-[13px] text-ink-faint">
                {destino === "nosso" ? "Entra no acerto entre vocês dois." : destino === "so-meu" ? "Só você vê. Nem o total aparece para o outro." : "Os dois veem, fora do acerto."}
              </p>
            </div>
          </>
        )}
        {erro && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">{erro}</p>}
        <button type="button" onClick={salvar} disabled={salvando || !valor} className={BOTAO_ESCURO}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        {item && (
          <button type="button" onClick={apagar} disabled={salvando} className="mx-auto flex min-h-11 items-center gap-2 text-[15px] font-medium text-danger">
            <Trash2 size={16} strokeWidth={1.8} aria-hidden />
            Apagar
          </button>
        )}
      </div>
    </Modal>
  );
}
