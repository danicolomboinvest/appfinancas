"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeftRight, CalendarX2, ChevronLeft, Download, Eye, EyeOff, House, Link2Off, Lock, Mail, RefreshCw, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { BOTAO_CLARO, BOTAO_ESCURO, CARTAO, ParDeAvatares, TituloDoTema } from "./visual";
import { frasesDosTermos, type TelaDoConvite as Tela } from "@/lib/casal-login/regras";
import {
  aceitarLogadoAction,
  criarLoginEEntrarAction,
  entrarEAceitarAction,
  usarOutraContaAction,
  type EstadoDoFormulario,
} from "@/app/(public)/par/[token]/actions";

/**
 * Jeitos de entrar pelo link do convite. Hoje só e-mail e senha (o login que o app tem). Apple e
 * Google já têm o lugar e o texto: quando o login social existir, é pôr a chave aqui e ligar o
 * botão ao provedor do Auth.js; o fim é o mesmo `aceitarConvite`. Lembrete da Apple: com Google
 * no iPhone, o "Continuar com Apple" é obrigatório (guideline 4.8).
 */
export type Provedor = "apple" | "google" | "email";
export const PROVEDORES_DO_PAR: readonly Provedor[] = ["email"];
const ROTULO: Record<Provedor, string> = { apple: "Continuar com Apple", google: "Continuar com Google", email: "Continuar com e-mail" };

type Props = {
  tela: Tela | "limite";
  token: string;
  nomeTitular: string;
  nomePar: string;
  /** "18/10": o último dia em que o convite vale. */
  valeAte: string | null;
  emailDoVisitante: string | null;
};

const CAMPO =
  "h-14 w-full rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none shadow-[inset_0_0_0_1px_var(--color-border)] transition-shadow placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_var(--color-ink)]";

export function TelaDoConvite(props: Props) {
  const [etapa, setEtapa] = useState<"inicio" | "criar" | "entrar">("inicio");
  const [criar, acaoCriar, criando] = useActionState<EstadoDoFormulario, FormData>(criarLoginEEntrarAction, {});
  const [entrar, acaoEntrar, entrando] = useActionState<EstadoDoFormulario, FormData>(entrarEAceitarAction, {});
  const [logado, acaoLogado, aceitando] = useActionState<EstadoDoFormulario, FormData>(aceitarLogadoAction, {});

  // Uma ação pode descobrir que o convite mudou no meio do caminho (venceu, foi usado, foi
  // cancelado): a tela troca para a do motivo, sem deixar o formulário fingindo que vai dar certo.
  const telaDaAcao = [criar.tela, entrar.tela, logado.tela].find((t) => t && t !== "email-em-uso") as Tela | "limite" | undefined;
  const tela = telaDaAcao ?? props.tela;
  const titular = props.nomeTitular || "Seu par";
  const par = props.nomePar || "você";

  if (tela !== "entrar" && tela !== "aceitar-logado") return <TelaDeMotivo tela={tela} titular={titular} par={props.nomePar} valeAte={props.valeAte} token={props.token} />;

  if (tela === "aceitar-logado") {
    return (
      <Moldura>
        <ParDeAvatares titular={titular} par={par} />
        <TituloDoTema className="mt-6">{`${titular} te convidou para o Nós dois`}</TituloDoTema>
        <p className="mt-3 text-center text-[15px] text-ink-muted">
          Você está entrando como <span className="break-all font-medium text-ink">{props.emailDoVisitante}</span>.
        </p>
        <form action={acaoLogado} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={props.token} />
          <CaixaDosTermos titular={titular} par={par} />
          {logado.erro && <Erro>{logado.erro}</Erro>}
          <button type="submit" disabled={aceitando} className={BOTAO_ESCURO}>
            {aceitando ? "Entrando..." : "Entrar no Nós dois com esta conta"}
          </button>
        </form>
        <form action={usarOutraContaAction} className="mt-3">
          <input type="hidden" name="token" value={props.token} />
          <button type="submit" className="mx-auto block min-h-11 text-[15px] text-ink-muted underline underline-offset-4">
            Usar outra conta
          </button>
        </form>
      </Moldura>
    );
  }

  if (etapa === "criar" || etapa === "entrar") {
    const ehCriar = etapa === "criar";
    const estado = ehCriar ? criar : entrar;
    return (
      <Moldura topo={false}>
        <button type="button" onClick={() => setEtapa("inicio")} className="-ml-1 flex min-h-11 items-center gap-1 text-[17px] text-ink-muted">
          <ChevronLeft size={20} strokeWidth={1.6} aria-hidden />
          Voltar
        </button>
        <h1 className="titulo-tema mt-2 text-[34px] font-medium leading-tight tracking-tight text-ink">{ehCriar ? "Crie o seu login" : "Entre com a sua conta"}</h1>
        <form action={ehCriar ? acaoCriar : acaoEntrar} className="mt-5 flex flex-col gap-4">
          <input type="hidden" name="token" value={props.token} />
          {ehCriar && <Campo rotulo="Seu nome" name="nome" autoComplete="given-name" defaultValue={estado.valores?.nome ?? props.nomePar} required />}
          <Campo rotulo="E-mail" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={estado.valores?.email ?? ""} required />
          <CampoSenha novo={ehCriar} />
          <CaixaDosTermos titular={titular} par={par} />
          {estado.erro && <Erro>{estado.erro}</Erro>}
          {estado.tela === "email-em-uso" && (
            <button type="button" onClick={() => setEtapa("entrar")} className="-mt-1 text-left text-[15px] font-medium text-ink underline underline-offset-4">
              Entrar com a conta que já tenho
            </button>
          )}
          <button type="submit" disabled={criando || entrando} className={BOTAO_ESCURO}>
            {criando || entrando ? "Entrando..." : "Entrar no Nós dois"}
          </button>
          {!ehCriar && (
            <Link href="/esqueci-senha" className="mx-auto min-h-11 text-[15px] text-ink-muted underline underline-offset-4">
              Esqueci minha senha
            </Link>
          )}
        </form>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <ParDeAvatares titular={titular} par={par} />
      <TituloDoTema className="mt-6">
        A {titular} te convidou
        <br />
        para o Nós dois
      </TituloDoTema>
      <ul className="mt-6 flex flex-col gap-3">
        <Linha icone={<House size={20} strokeWidth={1.6} />}>O dinheiro da casa num lugar só</Linha>
        <Linha icone={<ArrowLeftRight size={20} strokeWidth={1.6} />}>O acerto sai sozinho</Linha>
        <Linha icone={<Lock size={20} strokeWidth={1.6} />}>O pessoal de cada um fica com cada um</Linha>
      </ul>
      <div className="mt-7 flex flex-col gap-3">
        {PROVEDORES_DO_PAR.map((p, i) => (
          <button key={p} type="button" onClick={() => setEtapa("criar")} className={i === 0 ? BOTAO_ESCURO : BOTAO_CLARO}>
            {p === "email" && <Mail size={20} strokeWidth={1.7} aria-hidden />}
            {ROTULO[p]}
          </button>
        ))}
      </div>
      <p className="mt-5 text-center text-[15px] text-ink-muted">
        Grátis para você.{props.valeAte ? ` Convite vale até ${props.valeAte}.` : ""}
      </p>
      <button type="button" onClick={() => setEtapa("entrar")} className="mx-auto mt-3 block min-h-11 text-[16px] text-ink underline underline-offset-4">
        Já tenho conta no SPI
      </button>
    </Moldura>
  );
}

function Moldura({ children, topo = true }: { children: React.ReactNode; topo?: boolean }) {
  return (
    <main className="min-h-dvh bg-canvas px-5 pb-[calc(2rem+var(--safe-bottom,0px))] pt-[calc(1.5rem+var(--safe-top,0px))]">
      <div className="mx-auto w-full max-w-[420px]">
        {topo && (
          <div className="mb-7 flex items-center justify-center gap-3">
            <BrandMark size={30} />
            <span className="text-[17px] font-medium text-ink">SPI Finance</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}

function Linha({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 text-[17px] text-ink">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
        {icone}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Campo({ rotulo, name, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; name: string }) {
  const id = `campo-${name}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="text-[15px] text-ink-muted">{rotulo}</span>
      <input id={id} name={name} className={CAMPO} {...rest} />
    </label>
  );
}

function CampoSenha({ novo }: { novo: boolean }) {
  const [ver, setVer] = useState(false);
  return (
    <label htmlFor="campo-senha" className="flex flex-col gap-2">
      <span className="text-[15px] text-ink-muted">Senha</span>
      <span className="relative">
        <input
          id="campo-senha"
          name="senha"
          type={ver ? "text" : "password"}
          autoComplete={novo ? "new-password" : "current-password"}
          minLength={novo ? 8 : 1}
          required
          className={`${CAMPO} pr-14`}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? "Esconder a senha" : "Mostrar a senha"}
          className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-muted"
        >
          {ver ? <EyeOff size={20} strokeWidth={1.6} /> : <Eye size={20} strokeWidth={1.6} />}
        </button>
      </span>
      {novo && <span className="text-[13px] text-ink-faint">Pelo menos 8 letras ou números.</span>}
    </label>
  );
}

/** Os termos em três frases, com o aceite e o link da política (LGPD). Versão guardada no aceite. */
function CaixaDosTermos({ titular, par }: { titular: string; par: string }) {
  const [a, b, c] = frasesDosTermos(titular, par);
  const icones = [Eye, Lock, Download];
  return (
    <div className={`${CARTAO} p-5`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="termos" required className="peer sr-only" />
        <span
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-strong text-transparent transition-colors peer-checked:border-transparent peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-ink"
        >
          <ShieldCheck size={16} strokeWidth={2} />
        </span>
        <span className="text-[17px] font-medium text-ink">Aceito os termos do Nós dois</span>
      </label>
      <ul className="mt-3 flex flex-col gap-2 pl-10">
        {[a, b, c].map((f, i) => {
          const I = icones[i];
          return (
            <li key={f} className="flex items-start gap-2 text-[15px] leading-snug text-ink-muted">
              <I size={16} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden />
              <span>{f}</span>
            </li>
          );
        })}
      </ul>
      <Link href="/privacidade" target="_blank" className="mt-3 ml-10 inline-block text-[15px] text-ink underline underline-offset-4">
        Termos e privacidade (LGPD)
      </Link>
    </div>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
      {children}
    </p>
  );
}

/** Cada motivo de o link não abrir tem a sua tela, com o que fazer em seguida. */
function TelaDeMotivo({ tela, titular, par, valeAte, token }: { tela: Tela | "limite"; titular: string; par: string; valeAte: string | null; token: string }) {
  const m = motivo(tela, titular, par, valeAte);
  const Icone = m.icone;
  return (
    <Moldura>
      <div className="mt-6 flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <Icone size={28} strokeWidth={1.5} />
        </span>
        <TituloDoTema className="mt-6">{m.titulo}</TituloDoTema>
        <p className="mt-3 max-w-[340px] text-balance text-[17px] leading-relaxed text-ink-muted">{m.texto}</p>
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {m.botao && (
          <Link href={m.botao.href} className={BOTAO_ESCURO}>
            {m.botao.rotulo}
          </Link>
        )}
        {m.trocarConta && (
          <form action={usarOutraContaAction}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={BOTAO_CLARO}>
              Usar outra conta
            </button>
          </form>
        )}
      </div>
    </Moldura>
  );
}

type Motivo = { icone: typeof Lock; titulo: string; texto: string; botao?: { href: string; rotulo: string }; trocarConta?: boolean };

export function motivo(tela: Tela | "limite", titular: string, par: string, valeAte: string | null): Motivo {
  const entrar = { href: "/login", rotulo: "Entrar no SPI" };
  switch (tela) {
    case "vencido":
      return { icone: CalendarX2, titulo: "Este convite venceu", texto: `Convites valem 7 dias. Peça um convite novo para a ${titular}.` };
    case "usado":
      return { icone: UserRoundCheck, titulo: "Este convite já foi usado", texto: "Cada convite abre uma vez só. Se foi você que entrou, é só entrar com o seu login.", botao: entrar };
    case "cancelado":
      return { icone: Link2Off, titulo: `A ${titular} cancelou este convite`, texto: "Se foi engano, peça um convite novo para ela." };
    case "substituido":
      return { icone: RefreshCw, titulo: "Este link foi trocado", texto: `A ${titular} mandou um convite mais novo. Abra o último link que ela mandou.` };
    case "casal-inativo":
      return { icone: Lock, titulo: "Este convite está pausado", texto: `O Nós dois da ${titular} não está ativo agora. Quando ela renovar, o link volta a valer${valeAte ? ` até ${valeAte}` : ""}.` };
    case "ja-tem-par":
      return { icone: Users, titulo: `O Nós dois da ${titular} já tem um par`, texto: "É um par por vez. Se é você, entre com o login que você criou.", botao: entrar, trocarConta: true };
    case "e-a-titular":
      return {
        icone: Users,
        titulo: "Este convite é para o seu par",
        texto: par ? `Mande o link para ${par}. Quando ${par} entrar, aparece no seu Nós dois.` : "Mande o link para o seu par. Quando entrar, aparece no seu Nós dois.",
        botao: { href: "/divisao", rotulo: "Voltar para o Nós dois" },
        trocarConta: true,
      };
    case "em-outro-casal":
      return {
        icone: Users,
        titulo: "Você já está em outro Nós dois",
        texto: "Cada pessoa fica em um Nós dois por vez. Saia do outro em Configurações e abra este link de novo.",
        botao: { href: "/configuracoes/nos-dois", rotulo: "Abrir Configurações" },
        trocarConta: true,
      };
    case "limite":
      return { icone: Lock, titulo: "Muitas tentativas seguidas", texto: "Por segurança, espere alguns minutos e abra o link de novo." };
    case "ja-esta-aqui":
      return { icone: UserRoundCheck, titulo: "Você já está no Nós dois", texto: `É só abrir o Nós dois da ${titular}.`, botao: { href: "/divisao", rotulo: "Abrir o Nós dois" } };
    case "invalido":
    default:
      return { icone: Link2Off, titulo: "Este link não abriu", texto: "Ele pode ter sido cortado ao copiar. Peça para quem te convidou mandar de novo.", botao: entrar };
  }
}
