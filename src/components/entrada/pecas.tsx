import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Check, ChevronLeft, CircleAlert, Info } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { cssDaEntrada } from "@/lib/profiles/themes";

/**
 * As peças das telas de entrada (login, cadastro, senha, confirmação, suporte, privacidade e
 * termos), do Mockup A aprovado pela Dani em 12/10/2026 (estudo-apps-financas/
 * telas-publicas-proposta.html): o papel claro do Padrão, a névoa âmbar atrás do logo Aurora,
 * uma frase e o caminho. Tudo pinta com as variáveis do tema (--color-*), então a mesma peça
 * serve no claro, no escuro e dentro do app (a tela "Confirme seu e-mail").
 */

type Icone = ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;

/** O texto de cada estado com contraste de leitura: a cor do sinal puxada para a tinta. */
const CSS_DAS_PECAS = `
.entrada { --entrada-ruim: color-mix(in srgb, var(--color-danger) 78%, var(--color-ink)); --entrada-bom: color-mix(in srgb, var(--color-success) 68%, var(--color-ink)); }
.entrada-nevoa::before { content: ""; position: absolute; left: -20%; right: -20%; top: -8%; height: 55%; z-index: -1; pointer-events: none;
  opacity: var(--entrada-nevoa-forca, 0.5);
  background: radial-gradient(55% 50% at 25% 15%, var(--entrada-nevoa-1, color-mix(in srgb, var(--color-brand-a) 40%, transparent)), transparent 70%),
    radial-gradient(50% 45% at 85% 10%, var(--entrada-nevoa-2, color-mix(in srgb, var(--color-brand-a) 30%, transparent)), transparent 70%),
    radial-gradient(70% 55% at 55% 55%, var(--entrada-nevoa-3, transparent), transparent 72%);
  -webkit-mask-image: linear-gradient(#000 40%, transparent); mask-image: linear-gradient(#000 40%, transparent); }
`;

/** Classes dos botões grandes (54px, pílula). O principal é a tinta; o segundo, o degrau do cartão. */
export const BOTAO =
  "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-ink px-[18px] text-base font-semibold text-canvas transition-[transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
export const BOTAO_SEC =
  "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-surface-2 px-[18px] text-base font-semibold text-ink transition-[transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
/** O botão pequeno de dentro de um aviso (Entrar, Esqueci a senha). */
export const BOTAO_PEQUENO =
  "inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
export const BOTAO_PEQUENO_SEC =
  "inline-flex h-10 items-center justify-center rounded-full bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
/** Link de texto no âmbar do tema. */
export const LINK =
  "rounded-md py-1.5 text-[15px] font-semibold text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
export const LINK_FRACO =
  "rounded-md px-1 py-1.5 text-[13px] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * A tela inteira. Traz junto o Padrão (claro ou escuro, como o celular) para quem abre sem
 * conta; dentro do app, `semTema` deixa valer o tema do perfil.
 */
export function TelaDeEntrada({
  children,
  centro = false,
  nevoa = false,
  semTema = false,
  larga = false,
}: {
  children: ReactNode;
  centro?: boolean;
  nevoa?: boolean;
  semTema?: boolean;
  /** Privacidade e termos: texto longo pede uma coluna um pouco mais larga no computador. */
  larga?: boolean;
}) {
  return (
    <main className="entrada relative isolate flex min-h-dvh w-full justify-center overflow-x-clip bg-canvas font-sans text-ink md:items-center">
      {!semTema && <style dangerouslySetInnerHTML={{ __html: cssDaEntrada() }} />}
      <style dangerouslySetInnerHTML={{ __html: CSS_DAS_PECAS }} />
      <div
        className={`relative flex min-h-dvh w-full flex-col gap-4 px-[22px] md:min-h-[min(100dvh,780px)] pb-[calc(26px+var(--safe-bottom,0px))] pt-[calc(24px+var(--safe-top,0px))] max-[340px]:px-4 ${larga ? "max-w-[640px]" : "max-w-[420px]"} ${centro ? "items-center text-center" : ""} ${nevoa ? "entrada-nevoa" : ""} animate-fade-in`}
      >
        {children}
      </div>
    </main>
  );
}

/** Espaço que empurra o que vem depois para baixo (o caminho fica perto do polegar). */
export function Mola() {
  return <div aria-hidden className="min-h-2 flex-1" />;
}

export function Voltar({ href, rotulo = "Voltar" }: { href: string; rotulo?: string }) {
  return (
    <Link
      href={href}
      aria-label={rotulo}
      className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-surface-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

/** O logo Aurora. Grande na primeira tela, pequeno nas outras. */
export function Logo({ grande = false, decorativo = false }: { grande?: boolean; decorativo?: boolean }) {
  const tamanho = grande ? 72 : 52;
  return (
    <span aria-hidden={decorativo || undefined} className="flex">
      <BrandMark size={tamanho} className="shadow-[0_14px_30px_-14px_rgba(0,0,0,0.45)]" />
    </span>
  );
}

export function Titulo({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="text-balance text-[30px] font-medium leading-[1.1] tracking-[-0.03em] max-[300px]:text-[26px]">
      {children}
    </h1>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className="text-pretty text-base text-ink-muted">{children}</p>;
}

export function Pequeno({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] text-ink-muted ${className}`}>{children}</p>;
}

/** O selo grande do topo de uma tela de um assunto só (chave, envelope, certo, erro). */
export function Selo({ icone: I, tipo = "neutro" }: { icone: Icone; tipo?: "neutro" | "ok" | "ruim" }) {
  const cor =
    tipo === "ok"
      ? "bg-success-soft text-[color:var(--entrada-bom)]"
      : tipo === "ruim"
        ? "bg-danger-soft text-[color:var(--entrada-ruim)]"
        : "bg-surface text-accent-strong shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10),inset_0_0_0_1px_var(--color-border)]";
  return (
    <span aria-hidden className={`flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[28px] ${cor}`}>
      <I size={40} strokeWidth={1.4} />
    </span>
  );
}

/**
 * Aviso de uma linha ou duas: o erro sempre com a saída do lado. `ruim` e `bom` falam alto
 * (role="alert"/"status"); a `dica` é só texto.
 */
export function Aviso({
  tipo,
  id,
  children,
  acoes,
}: {
  tipo: "ruim" | "bom" | "dica";
  id?: string;
  children: ReactNode;
  acoes?: ReactNode;
}) {
  const estilo =
    tipo === "ruim"
      ? "bg-danger-soft text-[color:var(--entrada-ruim)]"
      : tipo === "bom"
        ? "bg-success-soft text-[color:var(--entrada-bom)]"
        : "bg-accent-soft text-accent-strong";
  const I = tipo === "dica" ? Info : tipo === "bom" ? Check : CircleAlert;
  return (
    <div
      id={id}
      role={tipo === "ruim" ? "alert" : tipo === "bom" ? "status" : undefined}
      className={`grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 rounded-[18px] px-4 py-3.5 text-left text-[15px] leading-[1.4] ${estilo}`}
    >
      <I size={20} strokeWidth={1.6} aria-hidden className="mt-px" />
      <div className="min-w-0 [&_b]:font-semibold [&_strong]:font-semibold">
        {children}
        {acoes && <div className="mt-2.5 flex flex-wrap gap-2">{acoes}</div>}
      </div>
    </div>
  );
}

/** "8 caracteres ou mais": verde com o certo quando a regra já vale, cinza enquanto não. */
export function Regra({ ok, children, id }: { ok: boolean; children: ReactNode; id?: string }) {
  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
        ok ? "bg-success-soft text-[color:var(--entrada-bom)]" : "bg-surface-2 text-ink-muted"
      }`}
    >
      <Check size={14} strokeWidth={2.4} aria-hidden className={ok ? "" : "opacity-40"} />
      {children}
      <span className="sr-only">{ok ? " (ok)" : " (ainda não)"}</span>
    </span>
  );
}

/** O cartão branco de leitura (o e-mail do suporte, o essencial). */
export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-[22px] bg-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10),inset_0_0_0_1px_var(--color-border)] ${className}`}
    >
      {children}
    </div>
  );
}

/** A linha de Suporte, Privacidade e Termos no pé da primeira tela. */
export function Rodape() {
  return (
    <nav aria-label="Ajuda e documentos" className="flex flex-wrap justify-center gap-x-3.5 gap-y-1">
      <Link href="/suporte" className={LINK_FRACO}>
        Suporte
      </Link>
      <Link href="/privacidade" className={LINK_FRACO}>
        Privacidade
      </Link>
      <Link href="/termos" className={LINK_FRACO}>
        Termos
      </Link>
    </nav>
  );
}
