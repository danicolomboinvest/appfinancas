"use client";

import Link from "next/link";
import { FileUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pedirRegistro } from "@/components/shell/registrar-eventos";
import { trackEvent } from "@/lib/usage/track-event";

/**
 * A Visão mensal de quem acabou de chegar: um passo só, "importe seu extrato".
 *
 * Antes, a conta nova abria nesta tela com uma pilha de cartões zerados (Entrou R$ 0, Gastou
 * R$ 0, roscas vazias, calendário em branco) e, lá embaixo, "toque no + e registre". Nada ali
 * dizia o que fazer, e a promessa da venda ("solta o extrato, o mês se monta sozinho") não
 * aparecia em lugar nenhum. Quem desiste nos 7 dias de garantia é justamente quem não passa
 * desse primeiro momento — então aqui fica UM botão grande, e o digitar à mão como plano B.
 *
 * Os textos chegam prontos na voz do tema (a página é do servidor e já tem a voz).
 */
export function PrimeiroPassoDoMes({
  titulo,
  texto,
  importar,
  digitar,
  ajuda,
  confianca,
}: {
  titulo: string;
  texto: string;
  importar: string;
  digitar: string;
  ajuda: string;
  confianca: string;
}) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-8 text-center shadow-premium-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent">
        <FileUp size={26} strokeWidth={1.75} />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
        <p className="text-sm text-ink-muted">{texto}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            // Mesmos nomes da escolha no "+" (a API só aceita os conhecidos); o caminho separa
            // quem veio por aqui. A gaveta abre direto no modo e não conta de novo.
            trackEvent("registro_importacao", "/mensal/conta-nova");
            pedirRegistro("import");
          }}
        >
          {importar}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            trackEvent("registro_digitado", "/mensal/conta-nova");
            pedirRegistro("type");
          }}
        >
          {digitar}
        </Button>
      </div>
      <Link
        href="/guia#extrato-ou-fatura"
        className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong hover:underline"
      >
        {ajuda}
      </Link>
      <p className="flex max-w-sm items-start gap-1.5 text-left text-caption text-ink-muted">
        <Lock size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>{confianca}</span>
      </p>
    </section>
  );
}
