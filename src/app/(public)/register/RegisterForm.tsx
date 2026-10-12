"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, LockKeyhole, Mail, Smartphone, UserRound } from "lucide-react";
import { Campo } from "@/components/entrada/Campo";
import { LoginSocial } from "@/components/entrada/LoginSocial";
import { Aviso, BOTAO, BOTAO_PEQUENO, BOTAO_PEQUENO_SEC, LINK, Pequeno, TelaDeEntrada, Titulo, Voltar } from "@/components/entrada/pecas";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

/**
 * O formulário do cadastro. Mora separado da página porque a página agora é de servidor: é ela
 * que lê o código do convite (assinado com o AUTH_SECRET, que não pode ir pro navegador) e passa
 * só o e-mail da compra pra cá.
 *
 * Desenho do Mockup A (12/10/2026): uma tela só, curta, com o aviso do e-mail da compra no topo
 * e o erro sempre com a saída do lado (entrar, criar senha nova, falar com o suporte).
 */
export function RegisterForm({ emailDaCompra, appDaApple = false }: { emailDaCompra: string | null; appDaApple?: boolean }) {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);
  // A regra da senha acende enquanto ela digita. O React limpa o formulário a cada envio (a senha
  // nunca volta do servidor), então a contagem zera junto.
  const [senha, setSenha] = useState("");
  const [enviadoUltimo, setEnviadoUltimo] = useState(state);
  if (enviadoUltimo !== state) {
    setEnviadoUltimo(state);
    setSenha("");
  }

  const erroNoEmail = state.campo === "email";
  const erroGeral = state.error && !erroNoEmail ? state.error : null;

  return (
    <TelaDeEntrada>
      <Voltar href="/login" />
      <Titulo>Criar conta</Titulo>

      <form action={formAction} className="flex flex-col gap-4">
        {erroGeral && (
          <Aviso tipo="ruim" id="erro-cadastro">
            {erroGeral}
          </Aviso>
        )}
        <Campo
          rotulo="Nome"
          icone={UserRound}
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          defaultValue={state.values?.name}
          invalido={state.campo === "name"}
          descritoPor={state.campo === "name" ? "erro-cadastro" : undefined}
        />
        {/* Com o convite, o e-mail vem travado: trocar aqui é exatamente o erro que o link existe
            para evitar. Quem quiser mesmo outro e-mail abre o cadastro sem o link. */}
        {/* "E-mail da compra" no próprio rótulo (12/10/2026: a caixa de aviso em cima era texto
            demais). Quem se cadastrava com outro e-mail criava conta sem a compra e achava que
            tinha pago por nada. No app da Apple não se fala de compra feita fora (3.1.1). */}
        <Campo
          rotulo={appDaApple ? "E-mail" : "E-mail da compra"}
          icone={Mail}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={emailDaCompra != null}
          defaultValue={emailDaCompra ?? state.values?.email}
          invalido={erroNoEmail}
          descritoPor={erroNoEmail ? "erro-email" : undefined}
        />
        {erroNoEmail && <ErroDoEmail state={state} />}
        <Campo
          rotulo="Celular"
          extraDoRotulo={<span className="font-normal text-ink-muted"> (opcional)</span>}
          icone={Smartphone}
          id="phone"
          name="phone"
          type="tel"
          placeholder="(11) 98765-4321"
          autoComplete="tel"
          inputMode="tel"
          defaultValue={state.values?.phone}
          invalido={state.campo === "phone"}
          descritoPor={state.campo === "phone" ? "erro-cadastro" : undefined}
        />
        <Campo
          rotulo="Senha"
          icone={LockKeyhole}
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="8 caracteres ou mais"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          invalido={state.campo === "password"}
          descritoPor={state.campo === "password" ? "erro-cadastro" : undefined}
        />
        <Aceite marcadoAntes={state.values?.acceptTerms} comErro={state.campo === "acceptTerms"} />
        <button type="submit" disabled={isPending} className={BOTAO}>
          {isPending ? "Criando..." : "Criar conta"}
        </button>
      </form>

      <LoginSocial modo="cadastro" />
      <Pequeno className="text-center">
        Já tem conta?{" "}
        <Link href="/login" className={LINK}>
          Entrar
        </Link>
      </Pequeno>
    </TelaDeEntrada>
  );
}

/** O que deu errado com o e-mail, logo abaixo dele, e o caminho de cada caso. */
function ErroDoEmail({ state }: { state: RegisterState }) {
  if (state.motivo === "email-em-uso") {
    return (
      <Aviso
        tipo="ruim"
        id="erro-email"
        acoes={
          <>
            <Link href="/login" className={BOTAO_PEQUENO}>
              Entrar
            </Link>
            <Link href="/esqueci-senha" className={BOTAO_PEQUENO_SEC}>
              Esqueci a senha
            </Link>
          </>
        }
      >
        <b>Este e-mail já tem conta.</b>
      </Aviso>
    );
  }
  if (state.motivo === "sem-compra") {
    // Uma caixa só (12/10/2026, "muito texto"): achou pelo celular, mostra onde está a compra;
    // senão, o curto "não achei" com o suporte do lado.
    if (state.dicaDoCelular) {
      return (
        <Aviso tipo="dica" id="erro-email">
          Sua compra está no e-mail <b className="[overflow-wrap:anywhere]">{state.dicaDoCelular}</b>
        </Aviso>
      );
    }
    return (
      <Aviso tipo="ruim" id="erro-email" acoes={<Link href="/suporte" className={BOTAO_PEQUENO_SEC}>Suporte</Link>}>
        <b>Não achei compra com este e-mail.</b> Comprou agora? Espere uns minutos.
      </Aviso>
    );
  }
  if (state.motivo === "compra-encerrada") {
    return (
      <Aviso tipo="ruim" id="erro-email" acoes={<Link href="/suporte" className={BOTAO_PEQUENO_SEC}>Suporte</Link>}>
        <b>A compra deste e-mail não está mais ativa.</b>
      </Aviso>
    );
  }
  // E-mail inválido e afins: a frase do servidor, como veio.
  return (
    <Aviso tipo="ruim" id="erro-email">
      {state.error}
    </Aviso>
  );
}

/**
 * O "Li e aceito": a caixinha nativa continua lá (é ela que vai no formulário e que o leitor de
 * tela anuncia), só que desenhada como a caixinha preta de cantos redondos do protótipo.
 */
function Aceite({ marcadoAntes, comErro }: { marcadoAntes?: boolean; comErro: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2.5 text-sm text-ink-muted">
        <span className="relative mt-px flex h-6 w-6">
          <input
            id="acceptTerms"
            type="checkbox"
            name="acceptTerms"
            required
            defaultChecked={marcadoAntes}
            aria-labelledby="aceite-texto"
            aria-invalid={comErro || undefined}
            aria-describedby={comErro ? "erro-cadastro" : undefined}
            className={`peer h-6 w-6 cursor-pointer appearance-none rounded-lg bg-surface checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              comErro ? "shadow-[inset_0_0_0_2px_var(--color-danger)]" : "shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]"
            }`}
          />
          <Check
            size={16}
            strokeWidth={2.4}
            aria-hidden
            className="pointer-events-none absolute left-1 top-1 hidden text-canvas peer-checked:block"
          />
        </span>
        <span id="aceite-texto">
          <label htmlFor="acceptTerms" className="cursor-pointer">
            Li e aceito os
          </label>{" "}
          <Link href="/termos" target="_blank" className="font-semibold text-accent-strong underline-offset-4 hover:underline">
            Termos
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-accent-strong underline-offset-4 hover:underline">
            Privacidade
          </Link>
        </span>
      </div>
    </div>
  );
}
