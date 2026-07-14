"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requestPasswordResetAction, type ForgotState } from "./actions";

const initialState: ForgotState = {};

export default function EsqueciSenhaPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <KeyRound size={22} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Esqueceu a senha?</h1>
            <p className="mt-1 text-sm text-ink-muted">Sem problema. A gente te manda um link para criar uma nova.</p>
          </div>
        </div>

        {state.sent ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-premium-sm text-center">
            <p className="text-sm text-ink">
              Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha. Dê uma olhada na sua caixa
              de entrada (e no spam, por via das dúvidas).
            </p>
            <Link href="/login" className="text-sm font-medium text-accent-strong hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form
            action={formAction}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-premium-sm"
          >
            {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
            <Field label="Email" id="email" name="email" type="email" required autoComplete="email" />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
            <p className="text-center text-sm text-ink-muted">
              Lembrou a senha?{" "}
              <Link href="/login" className="font-medium text-accent-strong hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
