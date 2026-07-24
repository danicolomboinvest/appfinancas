"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Criar conta</h1>
            <p className="mt-1 text-sm text-ink-muted">Comece a organizar sua vida financeira hoje.</p>
          </div>
        </div>

        <form
          action={formAction}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-premium-sm"
        >
          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
          )}
          <Field label="Nome" id="name" name="name" type="text" required />
          <Field label="Email" id="email" name="email" type="email" required autoComplete="email" />
          <Field
            label="Senha"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <label className="flex items-start gap-2 text-xs text-ink-muted">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5 accent-current" />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="font-medium text-accent-strong hover:underline">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="font-medium text-accent-strong hover:underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Criando..." : "Criar conta"}
          </Button>
          <p className="text-center text-sm text-ink-muted">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-accent-strong hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
