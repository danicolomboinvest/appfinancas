"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { Campo } from "@/components/entrada/Campo";
import { Aviso, BOTAO, BOTAO_SEC, Mola, Pequeno, Selo, Sub, TelaDeEntrada, Titulo, Voltar } from "@/components/entrada/pecas";
import { requestPasswordResetAction, type ForgotState } from "./actions";

const initialState: ForgotState = {};

/** O intervalo entre dois pedidos (LIMITES_SENHA, 2 minutos). Antes disso o servidor não manda outro. */
const ESPERA_PARA_REENVIAR_S = 120;

export default function EsqueciSenhaPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);
  // O endereço digitado, só para mostrar na tela de "olhe o seu e-mail" e reenviar para ele.
  const [email, setEmail] = useState("");

  if (state.sent) return <EmailEnviado email={email} formAction={formAction} isPending={isPending} state={state} />;

  return (
    <TelaDeEntrada>
      <Voltar href="/login" />
      <Selo icone={KeyRound} />
      <Titulo>Esqueceu a senha?</Titulo>
      <Sub>Sem problema. Mandamos um link para criar uma nova.</Sub>
      <form action={formAction} onSubmit={(e) => setEmail(String(new FormData(e.currentTarget).get("email") ?? ""))} className="flex flex-1 flex-col gap-4">
        {state.error && (
          <Aviso tipo="ruim" id="erro-esqueci">
            {state.error}
          </Aviso>
        )}
        <Campo
          rotulo="E-mail da conta"
          icone={Mail}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={email}
          invalido={!!state.error}
          descritoPor={state.error ? "erro-esqueci" : undefined}
        />
        <Mola />
        <button type="submit" disabled={isPending} className={BOTAO}>
          {isPending ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    </TelaDeEntrada>
  );
}

/**
 * "Olhe o seu e-mail". A resposta é sempre a mesma, exista a conta ou não (ver actions.ts), por
 * isso o "Se existir uma conta". O reenviar só acende depois do intervalo do servidor: antes
 * disso o pedido não mandaria nada e ela ficaria esperando um e-mail que não vem.
 */
function EmailEnviado({
  email,
  formAction,
  isPending,
  state,
}: {
  email: string;
  formAction: (fd: FormData) => void;
  isPending: boolean;
  state: ForgotState;
}) {
  const [falta, setFalta] = useState(ESPERA_PARA_REENVIAR_S);
  const [visto, setVisto] = useState(state);
  // Cada envio novo (o reenviar) começa a contagem de novo.
  if (visto !== state) {
    setVisto(state);
    setFalta(ESPERA_PARA_REENVIAR_S);
  }
  useEffect(() => {
    if (falta <= 0) return;
    const t = setTimeout(() => setFalta((f) => f - 1), 1000);
    return () => clearTimeout(t);
  }, [falta]);

  return (
    <TelaDeEntrada centro>
      <Voltar href="/login" rotulo="Voltar para entrar" />
      <Mola />
      <Selo icone={Mail} />
      <Titulo>Olhe o seu e-mail</Titulo>
      <div role="status">
        <Sub>
          {email ? (
            <>
              Se existir uma conta com <span className="break-all font-semibold text-ink">{email}</span>, o link chega em
              instantes.
            </>
          ) : (
            "Se existir uma conta com esse e-mail, o link chega em instantes."
          )}
        </Sub>
      </div>
      <Pequeno>Não chegou? Olhe também o spam.</Pequeno>
      <Mola />
      <form action={formAction} className="flex w-full flex-col gap-2.5">
        <input type="hidden" name="email" value={email} />
        <Link href="/login" className={BOTAO}>
          Voltar para entrar
        </Link>
        {email && (
          <button type="submit" disabled={falta > 0 || isPending} className={BOTAO_SEC}>
            {isPending ? "Enviando..." : falta > 0 ? `Reenviar em ${falta} s` : "Reenviar o link"}
          </button>
        )}
      </form>
    </TelaDeEntrada>
  );
}
