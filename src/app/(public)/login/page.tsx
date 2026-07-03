"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg border border-black/10 p-6">
        <h1 className="text-xl font-semibold">Entrar</h1>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded border border-black/20 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-black/20 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-center text-sm">
          Não tem conta?{" "}
          <Link href="/register" className="underline">
            Criar conta
          </Link>
        </p>
      </form>
    </main>
  );
}
