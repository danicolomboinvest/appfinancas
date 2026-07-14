"use client";

import Link from "next/link";
import { use } from "react";
import { useActionState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { resetPasswordAction, type ResetState } from "./actions";

const initialState: ResetState = {};

export default function RedefinirSenhaPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const params = use(searchParams);
  const token = typeof params.token === "string" ? params.token : "";
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <KeyRound size={22} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Criar nova senha</h1>
            <p className="mt-1 text-sm text-ink-muted">Escolha uma senha nova para a sua conta.</p>
          </div>
        </div>

        {state.success ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-premium-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 size={28} strokeWidth={2} />
            </span>
            <p className="text-sm text-ink">Senha alterada com sucesso! Já pode entrar com a nova senha.</p>
            <Link
              href="/login"
              className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas hover:opacity-90"
            >
              Ir para o login
            </Link>
          </div>
        ) : !token ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-premium-sm">
            <p className="text-sm text-ink">
              Link inválido — o endereço não tem um código de recuperação. Peça um novo link.
            </p>
            <Link href="/esqueci-senha" className="text-sm font-medium text-accent-strong hover:underline">
              Pedir novo link
            </Link>
          </div>
        ) : (
          <form
            action={formAction}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-premium-sm"
          >
            {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
            <input type="hidden" name="token" value={token} />
            <Field
              label="Nova senha"
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Field
              label="Repita a nova senha"
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
