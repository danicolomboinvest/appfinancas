"use client";

import Link from "next/link";
import { use, useActionState, useState } from "react";
import { ChevronLeft, LockKeyhole, Mail } from "lucide-react";
import { Campo } from "@/components/entrada/Campo";
import { LoginSocial } from "@/components/entrada/LoginSocial";
import { Aviso, BOTAO, BOTAO_SEC, LINK, Logo, Mola, Pequeno, Rodape, Sub, TelaDeEntrada, Titulo } from "@/components/entrada/pecas";
import { ERRO_DE_EMAIL_OU_SENHA } from "@/lib/auth/mensagens-de-entrada";
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

  if (etapa === "escolha") {
    // Mockup A, tela de início: o logo Aurora na névoa âmbar, uma frase e os dois caminhos.
    return (
      <TelaDeEntrada centro nevoa>
        <Mola />
        <Logo grande />
        <p className="text-sm font-semibold tracking-[0.02em] text-ink-muted">SPI Finance</p>
        <Titulo>O app que te diz o que fazer com o seu dinheiro.</Titulo>
        <Sub>Quanto dá para gastar na semana, para onde o dinheiro foi e como o mês vai fechar.</Sub>
        <Mola />
        <div className="flex w-full flex-col gap-2.5">
          <Link href="/register" className={BOTAO}>
            Criar minha conta
          </Link>
          <button type="button" onClick={() => setEtapa("entrar")} className={BOTAO_SEC}>
            Já tenho conta
          </button>
        </div>
        <Rodape />
      </TelaDeEntrada>
    );
  }

  // Senha errada marca a senha (o e-mail volta preenchido); e-mail inválido marca o e-mail.
  const senhaErrada = state.error === ERRO_DE_EMAIL_OU_SENHA;
  const erroNoEmail = !!state.error && /mail/i.test(state.error) && !senhaErrada;
  const erroNaSenha = !!state.error && !erroNoEmail;

  return (
    <TelaDeEntrada nevoa>
      <button
        type="button"
        onClick={() => setEtapa("escolha")}
        aria-label="Voltar"
        className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-surface-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <Logo decorativo />
      <Titulo>Que bom te ver de novo</Titulo>

      <form action={formAction} className="flex flex-col gap-4">
        {created === "1" && !state.error && (
          <Aviso tipo="bom">
            <b>Conta criada.</b> Entre e confirme o seu e-mail pelo link que mandamos.
          </Aviso>
        )}
        {state.error && (
          <Aviso tipo="ruim" id="erro-login">
            {senhaErrada ? (
              <>
                <b>{state.error}</b> Acontece. Tente de novo com calma, ou crie uma senha nova.
              </>
            ) : (
              state.error
            )}
          </Aviso>
        )}
        {typeof callbackUrl === "string" && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <Campo
          rotulo="E-mail"
          icone={Mail}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          invalido={erroNoEmail}
          descritoPor={erroNoEmail ? "erro-login" : undefined}
        />
        <Campo
          rotulo="Senha"
          icone={LockKeyhole}
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={senhaErrada ? "Digite de novo" : undefined}
          autoFocus={senhaErrada}
          invalido={erroNaSenha}
          descritoPor={erroNaSenha ? "erro-login" : undefined}
        />
        {!senhaErrada && (
          <Link href="/esqueci-senha" className={`${LINK} -mt-1 self-end`}>
            Esqueci a senha
          </Link>
        )}
        <button type="submit" disabled={isPending} className={BOTAO}>
          {isPending ? "Entrando..." : "Entrar"}
        </button>
        {senhaErrada && (
          <Link href="/esqueci-senha" className={BOTAO_SEC}>
            Criar uma senha nova
          </Link>
        )}
      </form>

      <LoginSocial modo="entrar" />
      <Mola />
      <Pequeno className="text-center">
        Ainda não tem conta?{" "}
        <Link href="/register" className={LINK}>
          Criar conta
        </Link>
      </Pequeno>
    </TelaDeEntrada>
  );
}
