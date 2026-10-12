"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Check, ChevronLeft, CircleAlert } from "lucide-react";
import { Campo } from "@/components/entrada/Campo";
import { Aviso, BOTAO, Mola, Regra, Selo, Sub, TelaDeEntrada, Titulo } from "@/components/entrada/pecas";
import { ERRO_DE_LINK_DE_SENHA } from "@/lib/auth/mensagens-de-entrada";
import { resetPasswordAction, type ResetState } from "./actions";

const initialState: ResetState = {};
const MINIMO = 8;

/**
 * A nova senha em dois passos, uma pergunta por tela (o pedaço do Mockup B que a Dani quis no A):
 * primeiro a senha, depois a repetição. Os dois campos moram no MESMO formulário; no segundo
 * passo o primeiro só fica escondido, e vai junto no envio. Quem decide continua sendo o
 * servidor (tamanho, as duas iguais, link valendo).
 */
export function NovaSenha({ token, linkValido }: { token: string; linkValido: boolean }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);
  const [passo, setPasso] = useState<1 | 2>(1);
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [tentouSeguir, setTentouSeguir] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [visto, setVisto] = useState(state);
  const segundoCampo = useRef<HTMLInputElement>(null);

  // Resposta nova do servidor: o React limpa o formulário a cada envio, então as duas senhas
  // voltam vazias e ela recomeça do passo 1 (com o aviso do que faltou).
  if (visto !== state) {
    setVisto(state);
    if (state.error) {
      setSenha("");
      setRepetida("");
      setPasso(1);
      setTentouSeguir(false);
      setTentouSalvar(false);
    }
  }

  if (state.success) {
    return (
      <TelaDeEntrada centro>
        <Mola />
        <Selo icone={Check} tipo="ok" />
        <Titulo>Senha trocada</Titulo>
        <div role="status">
          <Sub>
            Por segurança, a conta saiu dos outros aparelhos e os avisos no celular foram desligados. Dá para ligar de
            novo em Configurações.
          </Sub>
        </div>
        <Mola />
        <Link href="/login" className={BOTAO}>
          Entrar
        </Link>
      </TelaDeEntrada>
    );
  }

  if (!linkValido || state.error === ERRO_DE_LINK_DE_SENHA) {
    return (
      <TelaDeEntrada centro>
        <Mola />
        <Selo icone={CircleAlert} tipo="ruim" />
        <Titulo>Este link não vale mais</Titulo>
        <Sub>Ele pode ter vencido ou chegado cortado. Peça um novo, leva um minuto.</Sub>
        <Mola />
        <Link href="/esqueci-senha" className={BOTAO}>
          Pedir outro link
        </Link>
      </TelaDeEntrada>
    );
  }

  const curta = senha.length < MINIMO;
  const diferentes = repetida !== senha;
  const erroDoServidor = state.error && !tentouSeguir ? state.error : null;

  function seguir() {
    setTentouSeguir(true);
    if (curta) return;
    setPasso(2);
    // O campo do passo 2 só aparece depois da troca; o foco vai nele no próximo quadro.
    requestAnimationFrame(() => segundoCampo.current?.focus());
  }

  return (
    <TelaDeEntrada>
      <form
        action={formAction}
        onSubmit={(e) => {
          // Senhas diferentes nem saem daqui: o aviso aparece na hora, no próprio passo.
          if (diferentes) {
            e.preventDefault();
            setTentouSalvar(true);
            segundoCampo.current?.focus();
          }
        }}
        className="flex flex-1 flex-col gap-4"
      >
        <input type="hidden" name="token" value={token} />
        <Progresso passo={passo} />

        <div hidden={passo !== 1} className="flex flex-1 flex-col gap-4">
          <p className="text-[13px] font-semibold text-ink-muted">Passo 1 de 2</p>
          <Titulo>Qual vai ser a nova senha?</Titulo>
          {erroDoServidor && (
            <Aviso tipo="ruim" id="erro-senha">
              {erroDoServidor}
            </Aviso>
          )}
          <Campo
            rotulo="Nova senha"
            rotuloVisivel={false}
            grande
            id="password"
            name="password"
            type="password"
            required
            minLength={MINIMO}
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              // Enter no passo 1 é "Continuar", não "salvar": o passo 2 ainda está vazio.
              if (e.key === "Enter") {
                e.preventDefault();
                seguir();
              }
            }}
            invalido={(tentouSeguir && curta) || !!erroDoServidor}
            descritoPor={erroDoServidor ? "erro-senha regra-nova" : "regra-nova"}
          />
          <div className="flex flex-wrap gap-2">
            <Regra ok={!curta} id="regra-nova">
              8 caracteres ou mais
            </Regra>
          </div>
          <Mola />
          <button
            type="button"
            className={BOTAO}
            onClick={seguir}
          >
            Continuar
          </button>
        </div>

        <div hidden={passo !== 2} className="flex flex-1 flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setPasso(1);
              setTentouSalvar(false);
            }}
            aria-label="Voltar para a nova senha"
            className="-mt-1 flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-surface-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
          </button>
          <p className="text-[13px] font-semibold text-ink-muted">Passo 2 de 2</p>
          <Titulo>Repita, só para conferir</Titulo>
          <Campo
            ref={segundoCampo}
            rotulo="Repita a nova senha"
            rotuloVisivel={false}
            grande
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={MINIMO}
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => {
              setRepetida(e.target.value);
              setTentouSalvar(false);
            }}
            invalido={tentouSalvar && diferentes}
            descritoPor={tentouSalvar && diferentes ? "erro-repetida" : undefined}
          />
          {tentouSalvar && diferentes && (
            <Aviso tipo="ruim" id="erro-repetida">
              <b>Ainda não está igual.</b> Falta pouco.
            </Aviso>
          )}
          <Mola />
          <button type="submit" disabled={isPending} className={BOTAO}>
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </button>
        </div>
      </form>
    </TelaDeEntrada>
  );
}

/** A barra de dois pedaços do topo: o pedaço aceso é o passo em que ela está (e o que já foi). */
function Progresso({ passo }: { passo: 1 | 2 }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      <i className="h-[5px] flex-1 rounded-full bg-ink" />
      <i className={`h-[5px] flex-1 rounded-full ${passo === 2 ? "bg-ink" : "bg-border-strong"}`} />
    </div>
  );
}
