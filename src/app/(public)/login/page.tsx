"use client";

import Link from "next/link";
import { use, useActionState, useState, type ComponentType, type InputHTMLAttributes } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, LockKeyhole, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
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
  // Primeiro a escolha: criar conta ou já tenho conta (05/10/2026). Quem chega vindo do cadastro
  // (?created=1) ou de um link que pedia login (?callbackUrl=) vai direto pro formulário.
  const [etapa, setEtapa] = useState<"escolha" | "entrar">(created === "1" || typeof callbackUrl === "string" ? "entrar" : "escolha");

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
        {etapa === "entrar" && (
          <button
            type="button"
            onClick={() => setEtapa("escolha")}
            aria-label="Voltar"
            className="absolute -left-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </button>
        )}

        <div className={`flex flex-col items-center gap-5 text-center ${etapa === "escolha" ? "mb-12" : "mb-10"}`}>
          <BrandMark size={etapa === "escolha" ? 84 : 64} className="rounded-[22px] shadow-premium transition-all" />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-strong">SPI Finance</p>
            {etapa === "escolha" ? (
              <>
                <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-tight text-ink">
                  O app que te diz o que fazer com o seu dinheiro.
                </h1>
                <p className="text-balance text-sm leading-relaxed text-ink-muted">
                  Quanto dá pra gastar na semana, pra onde o dinheiro foi e como o mês vai fechar.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">Bem-vinda de volta</h1>
                <p className="text-sm text-ink-muted">Entre com o seu e-mail e a sua senha.</p>
              </>
            )}
          </div>
        </div>

        {etapa === "escolha" ? (
          <div key="escolha" className="flex animate-fade-in flex-col gap-3">
            <Link
              href="/register"
              className="flex h-14 items-center justify-center rounded-full bg-accent-gradient text-base font-semibold text-on-accent transition-opacity hover:opacity-95"
            >
              Criar minha conta
            </Link>
            <button
              type="button"
              onClick={() => setEtapa("entrar")}
              className="flex h-14 items-center justify-center rounded-full border border-border-strong bg-white/[0.04] text-base font-semibold text-ink backdrop-blur-sm transition-colors hover:bg-white/[0.08]"
            >
              Já tenho conta
            </button>
          </div>
        ) : (
        <form key="entrar" action={formAction} className="flex animate-fade-in flex-col gap-4">
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
          <CampoDeEntrada
            label="E-mail"
            icone={Mail}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            defaultValue={state.email}
          />
          <CampoDeEntrada label="Senha" icone={LockKeyhole} id="password" name="password" type="password" required autoComplete="current-password" />
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
        )}

        {/* Verdade da política de privacidade (04/10/2026): servidores em São Paulo, banco criptografado. */}
        <p className="mt-10 flex items-center justify-center gap-1.5 text-caption text-ink-faint">
          <Lock size={12} aria-hidden />
          Seus dados ficam no Brasil, criptografados.
        </p>
      </div>
    </main>
  );
}

/**
 * O campo da tela de entrada (05/10/2026, "algo mais moderno, mais bonito de preencher").
 *
 * O rótulo mora DENTRO do campo e sobe quando ela toca ou quando já tem texto (o truque do
 * `placeholder=" "`: `:placeholder-shown` só é verdadeiro com o campo vazio, inclusive no
 * preenchimento automático do celular). O ícone e a borda ficam dourados no campo em uso, com
 * um brilho fraco em volta. Fundo translúcido, para a luz dourada do topo atravessar.
 */
function CampoDeEntrada({
  label,
  icone: Icone,
  id,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; icone: ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }) {
  const senha = type === "password";
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="group relative">
      <Icone
        size={18}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-accent"
      />
      <input
        id={id}
        type={senha && visivel ? "text" : type}
        placeholder=" "
        {...props}
        className={`peer h-[60px] w-full rounded-2xl border border-border bg-white/[0.04] pb-2 pl-12 pt-6 text-base text-ink outline-none backdrop-blur-sm transition-all placeholder-transparent hover:border-border-strong focus:border-accent focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_var(--color-accent-soft)] ${senha ? "pr-14" : "pr-4"}`}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-12 top-1/2 origin-left -translate-y-[130%] text-xs font-medium text-ink-muted transition-all duration-200 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-placeholder-shown:text-ink-faint peer-focus:-translate-y-[130%] peer-focus:text-xs peer-focus:font-medium peer-focus:text-accent"
      >
        {label}
      </label>
      {senha && (
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
          aria-pressed={visivel}
          aria-controls={id}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-faint transition-colors hover:text-ink"
        >
          {visivel ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      )}
    </div>
  );
}
