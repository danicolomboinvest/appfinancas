"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CreditCard, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { Modal } from "@/components/ui/Modal";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { BotaoMais, useMenuDoItem, type ApagarDoItem, type OutraAcaoDoItem } from "@/components/ui/MenuDoItem";
import { LinhaArrastavel } from "@/components/ui/LinhaArrastavel";
import { nomeNaTela } from "@/lib/import/nome-na-tela";
import type { Mes, ParcelaDoMes } from "@/lib/contas/parcelas-do-mes";
import { apagarCompraAction, desfazerParcelaAction, editarParcelaAction, naoEParcelaAction } from "./parcelas-actions";

/**
 * Parcelas (13/10/2026): cada compra parcelada do mês, com o logo, o "9 de 10", quantas faltam
 * (contando a deste mês) e quando acaba. Vem das faturas (as lançadas e as que continuam) e das
 * contas parceladas.
 *
 * Mudar (pedido da Dani no mesmo dia): o "…", tocar e segurar, ou arrastar para o lado. Editar
 * (valor, "N de T", dia, categoria), Apagar esta compra e Não é parcela, sempre com Desfazer. No
 * Casal, a parcela do outro aparece sem o "…": só quem lançou muda.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ORDEM_DAS_CATEGORIAS = ["ALIMENTACAO", "MORADIA", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS"];

export function textoDaParcela(p: Pick<ParcelaDoMes, "atual" | "total" | "faltam" | "acabaEm">, hoje: Mes): string {
  if (p.faltam <= 1) return `${p.atual} de ${p.total} · última`;
  const ano = p.acabaEm.year !== hoje.year ? `/${String(p.acabaEm.year).slice(2)}` : "";
  return `${p.atual} de ${p.total} · faltam ${p.faltam} · até ${MESES[p.acabaEm.month - 1]}${ano}`;
}

const nomeDe = (p: ParcelaDoMes) => nomeNaTela(p.nome).nome || p.nome;

type Resposta = { ok: true; desfazer: string | null } | { ok: false; erro: string };

const desfazer = async (recibo: string) => desfazerParcelaAction(recibo);

export function Parcelas({ itens, total, hoje, rotulos }: { itens: ParcelaDoMes[]; total: string; hoje: Mes; rotulos: Record<string, string> }) {
  const [editando, setEditando] = useState<ParcelaDoMes | null>(null);
  if (itens.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" data-parcelas>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="titulo-tema min-w-0 text-lg font-medium text-ink">
          Parcelas <span className="whitespace-nowrap text-sm font-normal text-ink-muted">{total}/mês</span>
        </h2>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {itens.map((p) => (p.editavel ? <LinhaDaParcela key={p.chave} p={p} hoje={hoje} onEditar={() => setEditando(p)} /> : <LinhaFixa key={p.chave} p={p} hoje={hoje} />))}
      </ul>
      <Modal open={editando !== null} onClose={() => setEditando(null)} title="Editar parcela">
        {editando && <EditarParcela key={editando.chave} p={editando} hoje={hoje} rotulos={rotulos} onFeito={() => setEditando(null)} />}
      </Modal>
    </section>
  );
}

function Miolo({ p, hoje }: { p: ParcelaDoMes; hoje: Mes }) {
  const money = useMoney();
  return (
    <>
      <LogoDoLancamento descricao={p.descricao} icon={CreditCard} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-[16px] leading-snug text-ink">{nomeDe(p)}</span>
        <span className="block text-[13px] text-ink-muted">{textoDaParcela(p, hoje)}</span>
      </span>
      <span className="shrink-0 text-[16px] tabular-nums text-ink">{money(p.valor)}</span>
    </>
  );
}

/** A do outro, no Casal: só leitura. */
function LinhaFixa({ p, hoje }: { p: ParcelaDoMes; hoje: Mes }) {
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <Miolo p={p} hoje={hoje} />
    </li>
  );
}

function LinhaDaParcela({ p, hoje, onEditar }: { p: ParcelaDoMes; hoje: Mes; onEditar: () => void }) {
  const nome = nomeDe(p);
  const daFatura = p.origem !== "conta";
  const resposta = (r: Resposta) => (r.ok ? r : { ok: false as const, erro: r.erro });
  const apagar: ApagarDoItem = {
    titulo: `Apagar a compra ${nome}?`,
    texto: daFatura ? "Saem esta parcela e as próximas." : "Ela sai de Recorrentes.",
    opcao: daFatura && p.atual > 1 ? "Apagar também as que já passaram" : undefined,
    aviso: "Compra apagada",
    acao: async (tambem) => resposta(await apagarCompraAction(p.chave, tambem)),
    desfazer,
  };
  const outras: OutraAcaoDoItem[] = daFatura
    ? [
        {
          rotulo: "Não é parcela",
          icone: Ban,
          titulo: `${nome} não é parcela?`,
          texto: "Paro de contar como parcela e tiro os próximos meses.",
          botao: "Não é parcela",
          tom: "neutro",
          aviso: "Pronto, não é parcela",
          acao: async () => resposta(await naoEParcelaAction(p.chave)),
          desfazer,
        },
      ]
    : [];
  const { abrirNoBotao, segurar, camadas, pedirApagar } = useMenuDoItem({ nome, onEditar, apagar, outras });
  return (
    <li data-parcela={p.chave}>
      <div {...segurar} className="select-none [-webkit-touch-callout:none]">
        <LinhaArrastavel
          acoes={[
            { rotulo: "Editar", icone: Pencil, onClick: onEditar },
            { rotulo: "Apagar", icone: Trash2, onClick: pedirApagar, tom: "perigo" },
          ]}
        >
          <div role="button" tabIndex={-1} onClick={onEditar} className="flex cursor-pointer items-center gap-3 py-3 pl-3 pr-1">
            <Miolo p={p} hoje={hoje} />
            <BotaoMais nome={nome} onAbrir={abrirNoBotao} className="-ml-1 text-ink-muted" miolo="hover:bg-surface-2" />
          </div>
        </LinhaArrastavel>
      </div>
      {camadas}
    </li>
  );
}

function Contador({ rotulo, valor, min, max, onChange }: { rotulo: string; valor: number; min: number; max: number; onChange: (v: number) => void }) {
  const botao = "flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={rotulo}>
      <button type="button" className={botao} disabled={valor <= min} onClick={() => onChange(valor - 1)} aria-label={`Menos ${rotulo}`}>
        <Minus size={16} strokeWidth={2} aria-hidden />
      </button>
      <span className="w-7 text-center text-[19px] font-semibold tabular-nums text-ink" aria-live="polite">
        {valor}
      </span>
      <button type="button" className={botao} disabled={valor >= max} onClick={() => onChange(valor + 1)} aria-label={`Mais ${rotulo}`}>
        <Plus size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

function EditarParcela({ p, hoje, rotulos, onFeito }: { p: ParcelaDoMes; hoje: Mes; rotulos: Record<string, string>; onFeito: () => void }) {
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [salvando, iniciar] = useTransition();
  const [valor, setValor] = useState<number | undefined>(p.valor);
  const [atual, setAtual] = useState(p.atual);
  const [total, setTotal] = useState(p.total);
  const [dia, setDia] = useState(p.dia ? String(p.dia) : "");
  const [categoria, setCategoria] = useState<string | null>(p.categoria && rotulos[p.categoria] ? p.categoria : null);
  const [erro, setErro] = useState<string | null>(null);
  const fim = hoje.year * 12 + (hoje.month - 1) + (total - atual);
  const previa = textoDaParcela({ atual, total, faltam: total - atual + 1, acabaEm: { year: Math.floor(fim / 12), month: (fim % 12) + 1 } }, hoje);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!(valor && valor > 0)) return setErro("Diga o valor da parcela.");
    const d = dia ? Number(dia) : null;
    if (d !== null && !(d >= 1 && d <= 31)) return setErro("O dia vai de 1 a 31.");
    setErro(null);
    iniciar(async () => {
      const r = await editarParcelaAction(p.chave, { valor, atual, total, dia: p.confiante ? d : null, categoria: categoria as never });
      if (!r.ok) return setErro(r.erro);
      const recibo = r.desfazer;
      showToast(
        "Parcela salva",
        recibo
          ? {
              label: "Desfazer",
              onClick: async () => {
                const v = await desfazerParcelaAction(recibo);
                if (!v.ok) return showError(v.erro);
                // A parcela volta como estava; isso basta.
                router.refresh();
              },
            }
          : undefined,
      );
      router.refresh();
      onFeito();
    });
  }

  const categorias = ORDEM_DAS_CATEGORIAS.filter((k) => rotulos[k]);

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" data-editar-parcela>
      <div className="flex items-center gap-3">
        <LogoDoLancamento descricao={p.descricao} icon={CreditCard} />
        <p className="min-w-0 break-words text-[17px] font-medium leading-snug text-ink">{nomeDe(p)}</p>
      </div>
      <CurrencyInputControlled label="Valor da parcela" value={valor} onChange={setValor} />
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-[15px] text-ink">Parcela</span>
          <div className="flex items-center gap-1.5">
            <Contador
              rotulo="parcela deste mês"
              valor={atual}
              min={1}
              max={total}
              onChange={setAtual}
            />
            <span className="text-[15px] text-ink-muted">de</span>
            <Contador
              rotulo="total de parcelas"
              valor={total}
              min={Math.max(2, atual)}
              max={48}
              onChange={setTotal}
            />
          </div>
        </div>
        <p className="text-[13px] text-ink-muted">{previa}</p>
      </div>
      {p.confiante && (
        <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-2">
          <span className="min-w-0 text-[15px] text-ink">Dia que cai</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dia}
            onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="dia"
            aria-label="Dia que cai"
            className="min-h-10 w-16 shrink-0 rounded-xl bg-surface-2 px-2 text-center text-[17px] tabular-nums text-ink"
          />
        </label>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-ink-muted">Categoria</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
          {categorias.map((k) => (
            <button key={k} type="button" aria-pressed={categoria === k} onClick={() => setCategoria(k)} className="min-h-10 rounded-full bg-surface-2 px-3.5 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-canvas">
              {rotulos[k]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-ink-muted">Muda este mês e os próximos.</p>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <button type="submit" disabled={salvando} className="min-h-12 w-full rounded-full bg-ink text-[15px] font-medium text-canvas disabled:opacity-60">
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
