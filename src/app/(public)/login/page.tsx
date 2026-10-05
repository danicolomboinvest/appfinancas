"use client";

import { PasswordField } from "@/components/ui/PasswordField";
import Link from "next/link";
import { use, useActionState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; callbackUrl?: string }>;
}) {
  // ?created=1 vem do redirect do cadastro, confirma que a conta foi criada com sucesso.
  // ?callbackUrl= vem do proxy: a tela que ela tentou abrir sem sessão (link de e-mail etc.).
  const { created, callbackUrl } = use(searchParams);
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-6 py-10">
      {/*
        A luz dourada atrás da marca (05/10/2026, "visual sem graça"): a referência de design do app
        pede um brilho difuso atrás do elemento principal de cada tela, nunca o fundo chapado. É a
        única cor de marca (o dourado), bem fraca, vazando pra fora da tela.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-7rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 80%)" }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-10 flex flex-col items-center gap-5 text-center">
          <BrandMark size={72} className="rounded-[22px] shadow-premium" />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-strong">SPI Finance</p>
            <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-tight text-ink">
              O app que te diz o que fazer com o seu dinheiro.
            </h1>
            <p className="text-sm text-ink-muted">Bem-vinda de volta. Entre para continuar.</p>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          {created === "1" && !state.error && (
            <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
              <CheckCircle2 size={16} className="shrink-0" />
              Conta criada! Entre e confirme seu e-mail pelo link que mandamos.
            </p>
          )}
          {state.error && (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
          )}
          {typeof callbackUrl === "string" && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
          <Field
            label="Email"
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email}
          />
          <PasswordField label="Senha" id="password" name="password" required autoComplete="current-password" />
          <div className="-mt-1 text-right">
            <Link href="/esqueci-senha" className="text-xs font-medium text-accent-strong hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <Button type="submit" disabled={isPending} className="mt-1 h-12 w-full rounded-full text-base">
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-center text-sm text-ink-muted">
            Não tem conta?{" "}
            <Link href="/register" className="font-medium text-accent-strong hover:underline">
              Criar conta
            </Link>
          </p>
        </form>

        {/* Verdade da política de privacidade (04/10/2026): servidores em São Paulo, banco criptografado. */}
        <p className="mt-10 flex items-center justify-center gap-1.5 text-caption text-ink-faint">
          <Lock size={12} aria-hidden />
          Seus dados ficam no Brasil, criptografados.
        </p>
      </div>
    </main>
  );
}
