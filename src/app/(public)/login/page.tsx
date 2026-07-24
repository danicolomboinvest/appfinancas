"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  // ?created=1 vem do redirect do cadastro, confirma que a conta foi criada com sucesso.
  const { created } = use(searchParams);
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Bem-vinda de volta</h1>
            <p className="mt-1 text-sm text-ink-muted">Entre para continuar seu planejamento financeiro.</p>
          </div>
        </div>

        <form
          action={formAction}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-premium-sm"
        >
          {created === "1" && !state.error && (
            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              <CheckCircle2 size={16} className="shrink-0" />
              Conta criada! Agora é só entrar.
            </p>
          )}
          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
          )}
          <Field label="Email" id="email" name="email" type="email" required autoComplete="email" />
          <Field label="Senha" id="password" name="password" type="password" required autoComplete="current-password" />
          <div className="-mt-1 text-right">
            <Link href="/esqueci-senha" className="text-xs font-medium text-accent-strong hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-center text-sm text-ink-muted">
            Não tem conta?{" "}
            <Link href="/register" className="font-medium text-accent-strong hover:underline">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
