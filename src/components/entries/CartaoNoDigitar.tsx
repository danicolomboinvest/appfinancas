"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CadastroDoCartao } from "@/components/cartao/CadastroDoCartao";
import { LogoDoBanco } from "@/components/cartao/LogoDoBanco";
import { nomeDoCartao } from "@/lib/cartao/bancos";
import { diaCurto, diaDoIso, diasValidos, faturaDe, nomeDaFatura } from "@/lib/cartao/fatura";
import { listarCartoesAction, type CartaoNaTela } from "@/app/(app)/orcamento/cartao/cartoes-actions";

const ULTIMO_CARTAO = "spi-ultimo-cartao";

export type EscolhaDoCartao = { id: string | null; temCartoes: boolean };

/**
 * "Como pagou?" no Digitar (15/10/2026, a linha da fatura da versão B do mockup): os cartões
 * cadastrados, cada um com a fatura em que a compra entra pela data escolhida, "Outro jeito" e
 * "Novo cartão" (o cadastro abre por cima, e o cartão novo já fica escolhido). Com um cartão
 * escolhido aparece "Entra na fatura de [mês]", que muda quando a data muda.
 *
 * Fica num componente próprio para o Digitar mudar o mínimo: ele só guarda a escolha e manda o
 * `cartaoId` junto. Lembra o último cartão escolhido neste aparelho, como o "No cartão" já fazia.
 */
export function CartaoNoDigitar({ data, escolha, onEscolha }: { data: string; escolha: EscolhaDoCartao; onEscolha: (e: EscolhaDoCartao) => void }) {
  const [cartoes, setCartoes] = useState<CartaoNaTela[] | null>(null);
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarCartoesAction()
      .then((lista) => {
        if (!vivo) return;
        setCartoes(lista);
        let ultimo: string | null = null;
        try {
          ultimo = window.localStorage.getItem(ULTIMO_CARTAO);
        } catch {}
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

  if (cartoes.length === 0)
    return (
      <>
        {botaoNovo}
        {cadastro}
      </>
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
      <h3 className="pt-1 text-[15px] font-medium text-ink">Como pagou?</h3>
      <div className="flex flex-col gap-2" role="group" aria-label="Como pagou?">
        {cartoes.map((c) => {
          const f = faturaDoCartao(c);
          return opcao(
            c.id,
            escolha.id === c.id,
            () => escolher(c.id),
            <LogoDoBanco banco={c.banco} size={36} />,
            `Cartão ${nomeDoCartao(c)}`,
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
      {faturaEscolhida && (
        <p key={faturaEscolhida.chave} className="animate-fade-in flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[15px] text-ink" aria-live="polite" data-fatura={faturaEscolhida.chave}>
          <CalendarDays size={18} className="shrink-0 text-accent-strong" aria-hidden />
          <span className="min-w-0">
            Entra na fatura de <b className="font-semibold">{nomeDaFatura(faturaEscolhida, anoDaCompra)}</b>
          </span>
        </p>
      )}
      {cadastro}
    </div>
  );
}
