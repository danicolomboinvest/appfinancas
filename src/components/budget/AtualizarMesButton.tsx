"use client";

import { Upload } from "lucide-react";

/**
 * Abre a gaveta de registro direto do cartão de orçamento.
 *
 * Fica aqui porque o aviso "seus gastos estão lançados até dia 12" sem um caminho ao lado é só
 * uma cobrança: a pessoa leria, concordaria e não faria nada, porque atualizar exige lembrar
 * onde fica o botão. Com o atalho, ler e resolver viram o mesmo gesto.
 */
export function AtualizarMesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("spi:registrar"))}
      className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95"
    >
      <Upload size={16} strokeWidth={2} />
      Atualizar meus gastos
    </button>
  );
}
