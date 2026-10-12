"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { reenviarConfirmacaoAction, type ReenvioState } from "@/app/(public)/confirmar-email/actions";
import { Aviso, BOTAO, BOTAO_SEC, LINK_FRACO, Mola, Pequeno, Selo, Sub, TelaDeEntrada, Titulo } from "@/components/entrada/pecas";

const initialState: ReenvioState = {};

/**
 * O que a conta nova vê no lugar do app enquanto não confirma o e-mail (ver o layout de (app)).
 *
 * Mostra o endereço de propósito: e-mail digitado errado é o motivo mais comum de "não chegou",
 * e sem ver o endereço ela ficaria esperando pra sempre. Nesse caso o caminho é sair e criar a
 * conta de novo com o certo.
 *
 * Desenho do Mockup A (12/10/2026), no Padrão das telas de entrada: o layout do app devolve esta
 * tela antes de carregar o tema do perfil, que nem foi escolhido ainda.
 */
export function TelaConfirmeEmail({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(reenviarConfirmacaoAction, initialState);
  const [saindo, startSair] = useTransition();
  const router = useRouter();

  return (
    <TelaDeEntrada centro>
      <Mola />
      <Selo icone={Mail} />
      <Titulo>Confirme seu e-mail</Titulo>
      <Sub>
        Mandamos um link para <span className="break-all font-semibold text-ink">{email}</span>. Toque nele e a sua conta
        abre.
      </Sub>
      <Pequeno>Não chegou? Olhe também o spam.</Pequeno>

      {state.enviado && (
        <div className="w-full">
          <Aviso tipo="bom">Link enviado. Pode levar alguns minutos para chegar.</Aviso>
        </div>
      )}
      {state.erro && (
        <div className="w-full">
          <Aviso tipo="ruim">{state.erro}</Aviso>
        </div>
      )}

      <Mola />
      <div className="flex w-full flex-col gap-2.5">
        {/* Confirmou em outra aba (ou no celular): refazer o layout no servidor já deixa entrar. */}
        <button type="button" onClick={() => router.refresh()} className={BOTAO}>
          Abri o link
        </button>
        <form action={formAction} className="w-full">
          <button type="submit" disabled={isPending} className={BOTAO_SEC}>
            {isPending ? "Enviando..." : "Reenviar e-mail"}
          </button>
        </form>
      </div>
      <Pequeno>
        E-mail errado? Saia e crie a conta de novo com o endereço certo.{" "}
        <button type="button" disabled={saindo} onClick={() => startSair(() => logoutAction())} className={LINK_FRACO}>
          {saindo ? "Saindo..." : "Sair"}
        </button>
      </Pequeno>
    </TelaDeEntrada>
  );
}
