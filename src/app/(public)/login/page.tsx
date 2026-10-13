"use client";

import Link from "next/link";
import { use, useActionState, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { Campo } from "@/components/entrada/Campo";
import { LoginSocial } from "@/components/entrada/LoginSocial";
import { AM_BOTAO, AM_BOTAO_SEC, Ceu, Folha, Frase, TelaAmanhecer } from "@/components/entrada/Amanhecer";
import { Aviso, LINK, Mola, Pequeno, Rodape } from "@/components/entrada/pecas";
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
  // O "/" não conta como link: é o que o proxy manda quando o app abre do zero (o app da Apple
  // abre na raiz). Antes, quem baixava o app caía direto no "Bem-vinda de volta" (12/10/2026).
  const veioDeUmLink = typeof callbackUrl === "string" && callbackUrl !== "" && callbackUrl !== "/" && !/^\/(mensal\/foco|dashboard)\/?$/.test(callbackUrl);
  const [etapa, setEtapa] = useState<"escolha" | "entrar">(created === "1" || veioDeUmLink ? "entrar" : "escolha");

  if (etapa === "escolha") {
    // Mockup C "Amanhecer", céu azul (12/10/2026): o sol nasce atrás das ondas e a folha sobe
    // com a frase e os dois caminhos.
    return (
      <TelaAmanhecer>
        <Ceu />
        <Folha>
          <Frase>
            O app que te diz o que fazer com o seu <em>dinheiro.</em>
          </Frase>
          <div className="mt-[22px] flex w-full flex-col gap-3">
            <Link href="/register" className={AM_BOTAO}>
              Criar minha conta
            </Link>
            <button type="button" onClick={() => setEtapa("entrar")} className={AM_BOTAO_SEC}>
              Já tenho conta
            </button>
          </div>
          <div className="mt-3">
            <Rodape />
          </div>
        </Folha>
      </TelaAmanhecer>
    );
  }

  // Senha errada marca a senha (o e-mail volta preenchido); e-mail inválido marca o e-mail.
  const senhaErrada = state.error === ERRO_DE_EMAIL_OU_SENHA;
  const erroNoEmail = !!state.error && /mail/i.test(state.error) && !senhaErrada;
  const erroNaSenha = !!state.error && !erroNoEmail;

  return (
    <TelaAmanhecer>
      <Ceu baixo voltar={{ onClick: () => setEtapa("escolha") }} />
      <Folha alta>
        <Frase>
          Que bom te ver <em className="whitespace-nowrap">de novo</em>
        </Frase>

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
                  <b>{state.error}</b>
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
          {/* A senha errada treme uma vez quando o erro aparece. */}
          <div className={erroNaSenha ? "am-treme" : undefined}>
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
          </div>
          {!senhaErrada && (
            <Link href="/esqueci-senha" className={`${LINK} -mt-1 self-end`}>
              Esqueci a senha
            </Link>
          )}
          <button type="submit" disabled={isPending} className={AM_BOTAO}>
            {isPending ? "Entrando..." : "Entrar"}
          </button>
          {senhaErrada && (
            <Link href="/esqueci-senha" className={AM_BOTAO_SEC}>
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
      </Folha>
    </TelaAmanhecer>
  );
}
