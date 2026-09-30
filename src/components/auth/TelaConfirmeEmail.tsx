"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/actions";
import { reenviarConfirmacaoAction, type ReenvioState } from "@/app/(public)/confirmar-email/actions";

const initialState: ReenvioState = {};

/**
 * O que a conta nova vê no lugar do app enquanto não confirma o e-mail (ver o layout de (app)).
 *
 * Mostra o endereço de propósito: e-mail digitado errado é o motivo mais comum de "não chegou",
 * e sem ver o endereço ela ficaria esperando pra sempre. Nesse caso o caminho é sair e criar a
 * conta de novo com o certo.
 */
export function TelaConfirmeEmail({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(reenviarConfirmacaoAction, initialState);
  const [saindo, startSair] = useTransition();
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-premium-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <MailCheck size={26} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Confirme seu e-mail</h1>
            <p className="mt-1 text-sm text-ink-muted">Mandamos um link para</p>
            <p className="mt-0.5 break-all text-sm font-medium text-ink">{email}</p>
            <p className="mt-2 text-sm text-ink-muted">
              Toque nele pra abrir sua conta. Não chegou? Olhe o spam ou peça outro aqui.
            </p>
          </div>

          {state.enviado && (
            <p className="w-full rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              Link enviado! Pode levar alguns minutos pra chegar.
            </p>
          )}
          {state.erro && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.erro}</p>}

          <form action={formAction} className="w-full">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Enviando..." : "Reenviar e-mail"}
            </Button>
          </form>

          {/* Confirmou em outra aba (ou no celular): refazer o layout no servidor já deixa entrar. */}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="text-sm font-medium text-accent-strong hover:underline"
          >
            Já confirmei
          </button>

          <div className="w-full border-t border-border pt-3">
            <p className="text-xs text-ink-faint">E-mail errado? Saia e crie a conta de novo com o endereço certo.</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saindo}
              onClick={() => startSair(() => logoutAction())}
              className="mt-2"
            >
              {saindo ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
