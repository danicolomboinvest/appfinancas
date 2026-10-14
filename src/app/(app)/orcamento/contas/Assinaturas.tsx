"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListChecks, PenLine, Plus, Repeat, Search } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { Modal } from "@/components/ui/Modal";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import type { AssinaturaDaTela, ComercianteParaEscolher } from "@/lib/contas/assinaturas";
import { adicionarDosLancamentosAction, escreverAssinaturaAction, listarParaEscolherAction, desfazerNaoEAssinaturaAction, naoEAssinaturaAction, removerAssinaturaAction, sugerirCategoriaAction } from "./assinaturas-actions";

/**
 * Assinaturas (13/10/2026, pedido da Dani: "um botãozinho ali, mais, e ela selecionar alguma
 * coisa que é recorrente. Ou ela poder escrever algo"). A seção aparece mesmo vazia, com o
 * "+ Adicionar". A folha faz uma coisa por vez: escolher dos lançamentos OU escrever.
 * Tocar numa assinatura abre editar e remover (a achada sozinha: "Não é assinatura").
 */

type Folha =
  | { passo: "inicio" }
  | { passo: "escolher" }
  | { passo: "escrever"; item?: AssinaturaDaTela }
  | { passo: "item"; item: AssinaturaDaTela };

const ORDEM_DAS_CATEGORIAS = ["LAZER", "EDUCACAO", "SAUDE", "MORADIA", "TRANSPORTE", "ALIMENTACAO", "OUTROS"];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function SeloPequeno({ children, forte = false }: { children: React.ReactNode; forte?: boolean }) {
  return <span className={`shrink-0 rounded-full px-2 py-px text-xs ${forte ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-ink-muted"}`}>{children}</span>;
}

export function Assinaturas({ itens, rotulos }: { itens: AssinaturaDaTela[]; rotulos: Record<string, string> }) {
  const money = useMoney();
  const [folha, setFolha] = useState<Folha | null>(null);
  const total = itens.reduce((s, i) => s + i.mensal, 0);
  const fechar = () => setFolha(null);
  const titulo = !folha ? "" : folha.passo === "item" ? folha.item.nome : folha.passo === "escolher" ? "Dos meus lançamentos" : folha.passo === "escrever" ? (folha.item?.id ? "Editar assinatura" : "Escrever assinatura") : "Nova assinatura";
  const voltar = folha && (folha.passo === "escolher" || (folha.passo === "escrever" && !folha.item)) ? () => setFolha({ passo: "inicio" }) : folha?.passo === "escrever" && folha.item ? () => setFolha({ passo: "item", item: folha.item! }) : undefined;

  return (
    <section className="flex flex-col gap-2" data-assinaturas>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="titulo-tema min-w-0 text-lg font-medium text-ink">
          Assinaturas {itens.length > 0 && <span className="whitespace-nowrap text-sm font-normal text-ink-muted">{money(total, { round: true })}/mês</span>}
        </h2>
        <button type="button" onClick={() => setFolha({ passo: "inicio" })} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm text-accent-strong active:scale-95">
          <Plus size={16} strokeWidth={1.8} aria-hidden /> Adicionar
        </button>
      </div>
      {itens.length === 0 ? (
        <button type="button" onClick={() => setFolha({ passo: "inicio" })} className="rounded-3xl border border-dashed border-border-strong bg-surface px-5 py-5 text-left text-[14px] text-ink-muted">
          Netflix, academia, apps: adicione o que se repete.
        </button>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
          {itens.map((a) => (
            <li key={a.chave}>
              <button type="button" onClick={() => setFolha({ passo: "item", item: a })} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-surface-2">
                <LogoDoLancamento descricao={a.nome} icon={Repeat} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] text-ink">{a.nome}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
                    {a.dia ? `Todo dia ${a.dia}` : "Mensal"}
                    {a.origem === "extrato" ? <SeloPequeno>do extrato</SeloPequeno> : a.pagaEsteMes ? <SeloPequeno forte>pago este mês</SeloPequeno> : null}
                  </span>
                </span>
                <span className="shrink-0 text-[16px] tabular-nums text-ink">{money(a.mensal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={folha !== null} onClose={fechar} title={titulo} voltar={voltar}>
        {folha?.passo === "inicio" && <Inicio aoEscolher={(passo) => setFolha(passo === "escolher" ? { passo } : { passo: "escrever" })} />}
        {folha?.passo === "escolher" && <Escolher onFeito={fechar} aoEscrever={() => setFolha({ passo: "escrever" })} />}
        {folha?.passo === "escrever" && <Escrever key={folha.item?.chave ?? "nova"} item={folha.item} rotulos={rotulos} onFeito={fechar} />}
        {folha?.passo === "item" && <DaAssinatura item={folha.item} aoEditar={() => setFolha({ passo: "escrever", item: folha.item })} onFeito={fechar} />}
      </Modal>
    </section>
  );
}

/** As duas portas, grandes: escolher ou escrever. */
function Inicio({ aoEscolher }: { aoEscolher: (p: "escolher" | "escrever") => void }) {
  const opcoes = [
    { p: "escolher" as const, icone: ListChecks, titulo: "Escolher dos meus lançamentos", sub: "Toque no que se repete" },
    { p: "escrever" as const, icone: PenLine, titulo: "Escrever", sub: "Nome, valor e dia" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {opcoes.map(({ p, icone: Icone, titulo, sub }) => (
        <button key={p} type="button" onClick={() => aoEscolher(p)} className="flex min-h-20 items-center gap-4 rounded-3xl border border-border bg-surface px-4 py-4 text-left active:scale-[0.98]">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
            <Icone size={22} strokeWidth={1.8} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-medium text-ink">{titulo}</span>
            <span className="block text-[13px] text-ink-muted">{sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Os gastos dos últimos 3 meses, um por comerciante, com busca. Tocar marca como assinatura. */
function Escolher({ onFeito, aoEscrever }: { onFeito: () => void; aoEscrever: () => void }) {
  const money = useMoney();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [lista, setLista] = useState<ComercianteParaEscolher[] | null>(null);
  const [busca, setBusca] = useState("");
  const [tocado, setTocado] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    listarParaEscolherAction()
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, []);

  const filtrada = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!lista) return [];
    return q ? lista.filter((c) => semAcento(`${c.nome} ${c.descricao}`).includes(q)) : lista;
  }, [lista, busca]);

  function marcar(c: ComercianteParaEscolher) {
    setTocado(c.chave);
    iniciar(async () => {
      const r = await adicionarDosLancamentosAction(c.chave);
      if (!r.ok) {
        setTocado(null);
        return showError("Não deu para adicionar. Tente de novo.");
      }
      showToast(`${r.nome} está em Assinaturas`);
      router.refresh();
      onFeito();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border-strong bg-surface px-4 focus-within:border-accent">
        <Search size={18} className="shrink-0 text-ink-muted" aria-hidden />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar nos lançamentos" className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none" />
      </label>
      {lista === null ? (
        <p className="py-6 text-center text-sm text-ink-muted">Buscando seus lançamentos…</p>
      ) : filtrada.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-ink-muted">{lista.length === 0 ? "Nada nos últimos 3 meses." : "Nada com esse nome."}</p>
          <button type="button" onClick={aoEscrever} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas">
            Escrever
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface" data-escolher>
          {filtrada.slice(0, 80).map((c) => (
            <li key={c.chave}>
              <button type="button" disabled={tocado !== null} onClick={() => marcar(c)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-surface-2 disabled:opacity-70">
                <LogoDoLancamento descricao={c.descricao} icon={Repeat} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] text-ink">{c.nome}</span>
                  <span className="block text-[13px] text-ink-muted">
                    <span className="tabular-nums">{money(c.ultimoValor)}</span> · {c.vezes === 1 ? "1 vez" : `${c.vezes} vezes`}
                  </span>
                </span>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tocado === c.chave ? "bg-accent text-on-accent" : "bg-surface-2 text-accent-strong"}`} aria-hidden>
                  {tocado === c.chave ? <Check size={18} /> : <Plus size={18} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Nome, valor por mês, dia (opcional) e a categoria que o motor sugere. */
function Escrever({ item, rotulos, onFeito }: { item?: AssinaturaDaTela; rotulos: Record<string, string>; onFeito: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [salvando, iniciar] = useTransition();
  const [nome, setNome] = useState(item?.nome ?? "");
  const [valor, setValor] = useState<number | undefined>(item?.mensal || undefined);
  const [dia, setDia] = useState(item?.dia ? String(item.dia) : "");
  const [categoria, setCategoria] = useState<string | null>(item?.categoria ?? null);
  const escolhida = useRef(Boolean(item?.categoria));
  const [erro, setErro] = useState<string | null>(null);

  // A categoria sugerida acompanha o nome até ela tocar numa.
  useEffect(() => {
    if (escolhida.current || nome.trim().length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      sugerirCategoriaAction(nome)
        .then((c) => {
          if (vivo && !escolhida.current && c) setCategoria(c);
        })
        .catch(() => {});
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [nome]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Escreva o nome.");
    if (!(valor && valor > 0)) return setErro("Diga quanto é por mês.");
    const d = dia ? Number(dia) : null;
    if (d !== null && !(d >= 1 && d <= 31)) return setErro("O dia vai de 1 a 31.");
    setErro(null);
    iniciar(async () => {
      const r = await escreverAssinaturaAction({ id: item?.id ?? undefined, nome, valor, dia: d, categoria: categoria as never });
      if (!r.ok) return setErro(r.erro);
      showToast(item?.id ? "Assinatura salva" : `${nome.trim()} está em Assinaturas`);
      router.refresh();
      onFeito();
    });
  }

  const categorias = ORDEM_DAS_CATEGORIAS.filter((k) => rotulos[k]);

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Netflix, academia"
        maxLength={80}
        aria-label="Nome da assinatura"
        autoFocus={!item}
        className="min-h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-[17px] text-ink outline-none focus:border-accent"
      />
      <CurrencyInputControlled label="Valor por mês" value={valor} onChange={setValor} />
      <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-2">
        <span className="min-w-0 text-[15px] text-ink">
          Dia da cobrança <span className="text-[13px] text-ink-muted">(opcional)</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={dia}
          onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="dia"
          aria-label="Dia da cobrança"
          className="min-h-10 w-16 shrink-0 rounded-xl bg-surface-2 px-2 text-center text-[17px] tabular-nums text-ink"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-ink-muted">Categoria</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
          {categorias.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={categoria === k}
              onClick={() => {
                escolhida.current = true;
                setCategoria(k);
              }}
              className="min-h-10 rounded-full bg-surface-2 px-3.5 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-canvas"
            >
              {rotulos[k]}
            </button>
          ))}
        </div>
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <button type="submit" disabled={salvando} className="min-h-12 w-full rounded-full bg-ink text-[15px] font-medium text-canvas disabled:opacity-60">
        Salvar
      </button>
    </form>
  );
}

/** Tocou numa assinatura: o valor grande, editar e remover (a achada: "Não é assinatura"). */
function DaAssinatura({ item, aoEditar, onFeito }: { item: AssinaturaDaTela; aoEditar: () => void; onFeito: () => void }) {
  const money = useMoney();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [ocupado, iniciar] = useTransition();
  const sua = item.origem === "sua";

  function naoE() {
    iniciar(async () => {
      try {
        await naoEAssinaturaAction(item.nome);
        showToast(`${item.nome} saiu de Assinaturas`, {
          label: "Desfazer",
          onClick: () => void desfazerNaoEAssinaturaAction(item.nome).then(() => router.refresh(), () => showError("Não deu para desfazer. Tente de novo.")),
        });
        router.refresh();
        onFeito();
      } catch {
        showError("Não deu. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-3xl bg-surface-2 p-4">
        <LogoDoLancamento descricao={item.nome} icon={Repeat} size={48} />
        <div className="min-w-0">
          <p className="text-[26px] font-light leading-tight tabular-nums text-ink">
            {money(item.mensal)} <span className="text-[14px] text-ink-muted">por mês</span>
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
            {item.dia ? `Todo dia ${item.dia}` : "Mensal"}
            {sua ? item.pagaEsteMes && <SeloPequeno forte>pago este mês</SeloPequeno> : <span className="rounded-full bg-surface px-2 py-px text-xs text-ink-muted">o app achou no extrato</span>}
          </p>
        </div>
      </div>
      <button type="button" onClick={aoEditar} className="min-h-12 w-full rounded-full bg-ink text-[15px] font-medium text-canvas">
        Editar
      </button>
      {sua ? (
        <div className="flex justify-center">
          <DeleteButton
            label="Remover assinatura"
            onDelete={async () => {
              try {
                await removerAssinaturaAction(item.id!);
                showToast(`${item.nome} saiu de Assinaturas`);
                router.refresh();
                onFeito();
              } catch {
                showError("Não deu para remover. Tente de novo.");
              }
            }}
          />
        </div>
      ) : (
        <button type="button" disabled={ocupado} onClick={naoE} className="min-h-12 w-full rounded-full border border-border-strong bg-surface text-[15px] font-medium text-ink disabled:opacity-60">
          Não é assinatura
        </button>
      )}
    </div>
  );
}
