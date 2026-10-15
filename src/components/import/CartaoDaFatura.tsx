"use client";

import { useState, useTransition } from "react";
import { LogoDoBanco } from "@/components/cartao/LogoDoBanco";
import { nomeDoCartao, slugDoBancoLido } from "@/lib/cartao/bancos";
import { preencherDiasDoCartaoAction, salvarCartaoAction } from "@/app/(app)/orcamento/cartao/cartoes-actions";
import type { ParseStats } from "@/app/(app)/mensal/import-actions";

const diaDe = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.slice(8, 10)) : null);

/**
 * Na conferência da fatura (15/10/2026): de que cartão cadastrado ela é. As compras ficam ligadas
 * a ele quando ela confirma. Se a fatura diz o fechamento ou o vencimento e o cartão ainda não
 * tem, um toque guarda. Sem cartão do banco e com os dois dias no arquivo, um toque cadastra.
 */
export function CartaoDaFatura({ stats }: { stats: ParseStats }) {
  const [cartao, setCartao] = useState(stats.cartao ?? null);
  const [feito, setFeito] = useState(false);
  const [salvando, iniciar] = useTransition();
  const fecha = diaDe(stats.fechamento);
  const vence = diaDe(stats.vencimento);
  const slug = slugDoBancoLido(stats.banco);

  const linha = (banco: string, texto: React.ReactNode, acao?: React.ReactNode) => (
    <div className="mt-3 flex w-full flex-col gap-2 rounded-2xl bg-surface p-3 text-left" data-cartao-da-fatura>
      <div className="flex min-w-0 items-center gap-3">
        <LogoDoBanco banco={banco} size={36} />
        <span className="min-w-0 break-words text-sm text-ink">{texto}</span>
      </div>
      {acao}
    </div>
  );
  const botao = (rotulo: string, aoTocar: () => Promise<unknown>) => (
    <button type="button" disabled={salvando} onClick={() => iniciar(async () => void (await aoTocar()))} className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-canvas disabled:opacity-40">
      {salvando ? "Guardando..." : rotulo}
    </button>
  );

  if (cartao) {
    const faltaFecha = cartao.diaFechamento === null && fecha !== null;
    const faltaVence = cartao.diaVencimento === null && vence !== null;
    const nome = `Cartão ${nomeDoCartao(cartao)}`;
    if (!feito && (faltaFecha || faltaVence)) {
      const dias = [faltaFecha ? `fecha dia ${fecha}` : null, faltaVence ? `vence dia ${vence}` : null].filter(Boolean).join(" e ");
      return linha(
        cartao.banco,
        <>
          Esta fatura {dias}. Guardar no {nome}?
        </>,
        botao("Guardar no cartão", async () => {
          const r = await preencherDiasDoCartaoAction(cartao.id, { diaFechamento: faltaFecha ? fecha : null, diaVencimento: faltaVence ? vence : null });
          if (r.ok) {
            setCartao({ ...cartao, diaFechamento: faltaFecha ? fecha : cartao.diaFechamento, diaVencimento: faltaVence ? vence : cartao.diaVencimento });
            setFeito(true);
          }
        }),
      );
    }
    return linha(cartao.banco, <>As compras vão para o {nome}.</>);
  }

  if (slug && fecha !== null && vence !== null)
    return linha(
      slug,
      <>Esta fatura fecha dia {fecha} e vence dia {vence}. Cadastrar o cartão?</>,
      botao("Cadastrar cartão", async () => {
        const r = await salvarCartaoAction({ banco: slug, diaFechamento: fecha, diaVencimento: vence, final: stats.final ?? null });
        if (r.ok) setCartao({ ...r.cartao });
      }),
    );

  return null;
}
