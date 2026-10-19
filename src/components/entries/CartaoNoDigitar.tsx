"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Minus, Plus, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CadastroDoCartao } from "@/components/cartao/CadastroDoCartao";
import { LogoDoBanco } from "@/components/cartao/LogoDoBanco";
import { rotuloDoCartao } from "@/lib/cartao/bancos";
import { diaCurto, diaDoIso, diasValidos, faturaDe, nomeDaFatura } from "@/lib/cartao/fatura";
import { MAX_PARCELAS, parcelasNasFaturas, resumoDasParcelas } from "@/lib/cartao/parcelas";
import { listarCartoesAction, type CartaoNaTela } from "@/app/(app)/orcamento/cartao/cartoes-actions";

const ULTIMO_CARTAO = "spi-ultimo-cartao";

export type EscolhaDoCartao = { id: string | null; temCartoes: boolean };

/**
 * "Como pagou?" no Digitar (15/10/2026, a linha da fatura da versão B do mockup): os cartões
 * cadastrados, cada um com a fatura em que a compra entra pela data escolhida, "Outro jeito" e
 * "Novo cartão" (o cadastro abre por cima, e o cartão novo já fica escolhido). Com um cartão
 * escolhido aparece "Entra na fatura de [mês]", que muda quando a data muda, e "Conta no
 * orçamento de [mês]": desde 15/10/2026 o gasto no cartão conta no mês da fatura.
 *
 * Fica num componente próprio para o Digitar mudar o mínimo: ele só guarda a escolha e manda o
 * `cartaoId` junto. Lembra o último cartão escolhido neste aparelho, como o "No cartão" já fazia.
 *
 * Compra parcelada (18/10/2026, a Dani): com um cartão escolhido e `parcelado` (só no Digitar),
 * aparece "Em quantas vezes?" (1 a 24, 1 = à vista). O valor digitado é o total: a linha diz
 * quanto é cada parcela e em que fatura cai a primeira e a última.
 */
export function CartaoNoDigitar({
  data,
  escolha,
  onEscolha,
  inicial,
  parcelado,
}: {
  data: string;
  escolha: EscolhaDoCartao;
  onEscolha: (e: EscolhaDoCartao) => void;
  /** Edição: o cartão que o gasto já tem (null = nenhum). Sem ele, vale o último escolhido no aparelho. */
  inicial?: string | null;
  /** Digitar: "Em quantas vezes?" com o total digitado (centavos). Sem isto, não aparece (edição). */
  parcelado?: { totalCentavos: number; vezes: number; onVezes: (n: number) => void; money: (v: number) => string };
}) {
  const [cartoes, setCartoes] = useState<CartaoNaTela[] | null>(null);
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarCartoesAction()
      .then((lista) => {
        if (!vivo) return;
        setCartoes(lista);
        let ultimo: string | null = inicial === undefined ? null : inicial;
        if (inicial === undefined) {
          try {
            ultimo = window.localStorage.getItem(ULTIMO_CARTAO);
          } catch {}
        }
        const lembrado = lista.find((c) => c.id === ultimo);
        onEscolha({ id: lembrado?.id ?? null, temCartoes: lista.length > 0 });
      })
      .catch(() => vivo && setCartoes([]));
    return () => {
      vivo = false;
    };
    // Só ao abrir: a lista não muda enquanto o Digitar está aberto, a não ser pelo "Novo cartão".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = (id: string | null, lista = cartoes ?? []) => {
    onEscolha({ id, temCartoes: lista.length > 0 });
    try {
      window.localStorage.setItem(ULTIMO_CARTAO, id ?? "");
    } catch {}
  };

  const dia = diaDoIso(data);
  const faturaDoCartao = (c: CartaoNaTela) => (dia && diasValidos(c) ? faturaDe(dia, c) : null);
  const escolhido = cartoes?.find((c) => c.id === escolha.id) ?? null;
  const faturaEscolhida = escolhido ? faturaDoCartao(escolhido) : null;
  const anoDaCompra = dia?.ano;
  const vezes = parcelado && escolhido ? parcelado.vezes : 1;
  const ultima = escolhido && vezes > 1 ? (parcelasNasFaturas(data, vezes, escolhido).at(-1) ?? null) : null;
  const resumo = resumoDasParcelas(parcelado?.totalCentavos ?? 0, vezes);

  const cadastro = (
    <Modal open={novo} onClose={() => setNovo(false)} title="Novo cartão">
      <CadastroDoCartao
        onSalvo={(c) => {
          const lista = [...(cartoes ?? []), c];
          setCartoes(lista);
          escolher(c.id, lista);
          setNovo(false);
        }}
      />
    </Modal>
  );

  if (cartoes === null) return null;

  const botaoNovo = (
    <button type="button" onClick={() => setNovo(true)} className="flex min-h-11 w-fit items-center gap-2 rounded-full px-1 text-[15px] text-ink">
      <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-border-strong text-ink-muted">
        <Plus size={16} aria-hidden />
      </span>
      Novo cartão
    </button>
  );

  // "Como pagou?" sempre com o título (18/10/2026, a Dani): sem cartão, o "Novo cartão" solto
  // não dizia que ali se cadastra o cartão da compra.
  const titulo = <h3 className="pt-1 text-[15px] font-medium text-ink">Como pagou?</h3>;
  if (cartoes.length === 0)
    return (
      <div className="flex flex-col gap-2">
        {titulo}
        {botaoNovo}
        {cadastro}
      </div>
    );

  const opcao = (chave: string, ativo: boolean, aoTocar: () => void, icone: React.ReactNode, rotulo: string, nota?: string) => (
    <button
      key={chave}
      type="button"
      aria-pressed={ativo}
      onClick={aoTocar}
      className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${ativo ? "bg-accent-soft ring-2 ring-ink" : "bg-surface ring-1 ring-border"}`}
    >
      {icone}
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-[15px] text-ink">{rotulo}</span>
        {nota && <small className="break-words text-caption text-ink-muted">{nota}</small>}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      {titulo}
      <div className="flex flex-col gap-2" role="group" aria-label="Como pagou?">
        {cartoes.map((c) => {
          const f = faturaDoCartao(c);
          return opcao(
            c.id,
            escolha.id === c.id,
            () => escolher(c.id),
            <LogoDoBanco banco={c.banco} size={36} />,
            rotuloDoCartao(c),
            f ? `Fatura de ${nomeDaFatura(f, anoDaCompra)}, vence ${diaCurto(f.vencimento)}` : undefined,
          );
        })}
        {opcao(
          "outro",
          escolha.id === null,
          () => escolher(null),
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted" aria-hidden>
            <Wallet size={18} />
          </span>,
          "Outro jeito",
          "Pix, débito ou dinheiro",
        )}
      </div>
      {botaoNovo}
      {faturaEscolhida && vezes > 1 && ultima && (
        <p key={`${faturaEscolhida.chave}-${vezes}`} className="animate-fade-in flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[15px] text-ink" aria-live="polite" data-fatura={faturaEscolhida.chave} data-ultima-parcela={`${ultima.year}-${String(ultima.month).padStart(2, "0")}`}>
          <CalendarDays size={18} className="mt-0.5 shrink-0 self-start text-accent-strong" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span>
              1ª na fatura de <b className="font-semibold">{nomeDaFatura(faturaEscolhida, anoDaCompra)}</b>
            </span>
            <span className="text-sm text-ink-muted">Última na fatura de {nomeDaFatura({ ano: ultima.year, mes: ultima.month }, anoDaCompra)}</span>
          </span>
        </p>
      )}
      {faturaEscolhida && vezes <= 1 && (
        <p key={faturaEscolhida.chave} className="animate-fade-in flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[15px] text-ink" aria-live="polite" data-fatura={faturaEscolhida.chave}>
          <CalendarDays size={18} className="mt-0.5 shrink-0 self-start text-accent-strong" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span>
              Entra na fatura de <b className="font-semibold">{nomeDaFatura(faturaEscolhida, anoDaCompra)}</b>
            </span>
            {/* Decisão da Dani (15/10/2026): o gasto no cartão conta no mês da fatura. */}
            <span className="text-sm text-ink-muted" data-conta-no-orcamento={faturaEscolhida.chave}>
              Conta no orçamento de {nomeDaFatura(faturaEscolhida, anoDaCompra)}
            </span>
          </span>
        </p>
      )}
      {parcelado && escolhido && (
        <div className="flex flex-col gap-2" data-parcelas>
          <h3 className="pt-1 text-[15px] font-medium text-ink">Em quantas vezes?</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Menos uma vez"
              disabled={vezes <= 1}
              onClick={() => parcelado.onVezes(vezes - 1)}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-premium-sm ring-1 ring-border disabled:opacity-40"
            >
              <Minus size={20} aria-hidden />
            </button>
            <output className="min-w-0 flex-1 text-center text-[1.375rem] tabular-nums text-ink" aria-live="polite" data-vezes={vezes}>
              {vezes <= 1 ? "À vista" : `${vezes}x`}
            </output>
            <button
              type="button"
              aria-label="Mais uma vez"
              disabled={vezes >= MAX_PARCELAS}
              onClick={() => parcelado.onVezes(vezes + 1)}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-premium-sm ring-1 ring-border disabled:opacity-40"
            >
              <Plus size={20} aria-hidden />
            </button>
          </div>
          {vezes > 1 && parcelado.totalCentavos > 0 && (
            <p className="text-center text-[15px] text-ink" data-valor-da-parcela>
              <b className="font-semibold tabular-nums">
                {resumo.vezes}x de {parcelado.money(resumo.parcela / 100)}
              </b>
              {resumo.primeira !== null && <span className="block text-sm text-ink-muted">A 1ª de {parcelado.money(resumo.primeira / 100)}</span>}
              <span className="block text-sm text-ink-muted">Total da compra {parcelado.money(parcelado.totalCentavos / 100)}</span>
            </p>
          )}
        </div>
      )}
      {cadastro}
    </div>
  );
}
