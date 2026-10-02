"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Field } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

/**
 * O formulário do cadastro. Mora separado da página porque a página agora é de servidor: é ela
 * que lê o código do convite (assinado com o AUTH_SECRET, que não pode ir pro navegador) e passa
 * só o e-mail da compra pra cá.
 */
export function RegisterForm({ emailDaCompra, appDaApple = false }: { emailDaCompra: string | null; appDaApple?: boolean }) {
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
          {/* O aviso vem ANTES dos campos, e não como letra miúda embaixo do e-mail: quem se
              cadastrava com outro e-mail criava uma conta sem a compra, via cadeado em tudo e
              achava que tinha pago por nada (teve pedido de reembolso 12 minutos depois). */}
          {/* No app da Apple não se fala de compra feita fora (guideline 3.1.1): lá quem não tem
              acesso assina pela própria Apple depois de criar a conta. */}
          {!appDaApple && (
          <div className="flex gap-2.5 rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-ink">
            <Mail size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent-strong" />
            {emailDaCompra ? (
              <p>
                <strong className="font-semibold">Já deixamos o e-mail da sua compra preenchido.</strong> É por ele que o
                app reconhece o que você comprou.
              </p>
            ) : (
              <p>
                <strong className="font-semibold">Use o mesmo e-mail da sua compra.</strong> É por ele que o app
                reconhece o que você comprou e libera tudo pra você.
              </p>
            )}
          </div>
          )}

          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
          )}
          <Field label="Nome" id="name" name="name" type="text" required maxLength={80} defaultValue={state.values?.name} />
          {/* Com o convite, o e-mail vem travado: trocar aqui é exatamente o erro que o link existe
              pra evitar. Quem quiser mesmo outro e-mail abre o cadastro sem o link. */}
          <Field
            label="E-mail"
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            readOnly={emailDaCompra != null}
            className={emailDaCompra != null ? "cursor-default text-ink-muted" : ""}
            defaultValue={emailDaCompra ?? state.values?.email}
          />
          <Field
            label="Celular (WhatsApp, opcional)"
            id="phone"
            name="phone"
            type="tel"
            placeholder="(11) 98765-4321"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={state.values?.phone}
          />
          <PasswordField label="Senha" id="password" name="password" required minLength={8} autoComplete="new-password" />
          <p className="-mt-3 text-xs text-ink-faint">Mínimo de 8 caracteres.</p>
          <label className="flex items-start gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              defaultChecked={state.values?.acceptTerms}
              className="mt-0.5 accent-current"
            />
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
