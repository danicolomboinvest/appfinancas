import Link from "next/link";
import { ChevronRight, FileText, Keyboard, LayoutList, ListChecks, Mic, PlayCircle, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { escolherQuerAction } from "@/app/(onboarding)/comecar/actions";
import { contarAConferir } from "./revisar/dados";
import { LINK_COMO_FUNCIONA } from "@/lib/novidades/passos";
import type { AuthContext } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { categoryIcon, categoryLabel } from "@/lib/categories";
import { ehCasal } from "@/lib/profiles/casal";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { serverMoney } from "@/lib/money-server";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { sinaisDosPrimeirosPassos, ultimoLancamento } from "@/lib/repositories/comeco.repo";
import { resumoDoMesImportadoAction } from "@/app/(app)/mensal/revelacao-actions";
import {
  ahaDoMes,
  atalhoDoQuer,
  lerComeco,
  bancosPendentes,
  tituloDoPassoDoExtrato,
  mesDoTexto,
  nomeDoMes,
  OPCOES_QUER,
  oQueMostrarDepois,
  primeirosPassos,
  TITULOS_PRIMEIROS,
  type Comeco,
  type PrimeiroPasso,
} from "@/lib/onboarding/comeco";
import { CartaoPrimeirosPassos, FecharAha, MarcaViuOMes, type PassoNaTela } from "./CartaoPrimeirosPassos";

const BOTAO = "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95";

/**
 * O que a Visão geral mostra logo depois do começo (versão nova): o "aha" (o mês dela, ou o
 * primeiro gasto) ou, para quem pulou sem lançar, o convite "Seu mês ainda está em branco".
 * Quem nunca passou pelo começo novo não vê nada daqui.
 */
export async function TopoDoComeco({ ctx, comeco, nome, temLancamento }: { ctx: AuthContext; comeco: Comeco; nome: string; temLancamento: boolean }) {
  const oQue = oQueMostrarDepois(comeco, temLancamento);
  if (oQue === "nada") return null;
  const money = await serverMoney();
  const atalho = atalhoDoQuer(comeco.quer, ehEmpresa(ctx.profileKind) || ehCasal(ctx.profileKind));
  // Direto no envio do arquivo: o banco é só ajuda, opcional (14/10/2026).
  const voltaAoExtrato = "/comecar?passo=volta";

  if (oQue === "convite") {
    return (
      <HeroiDoTema className="!p-5">
        <span className="heroi-veu flex size-11 items-center justify-center rounded-full" aria-hidden>
          <FileText size={22} strokeWidth={1.8} />
        </span>
        <h2 className="titulo-tema text-[1.6rem] font-normal leading-tight">
          Seu mês ainda <b className="font-semibold">está em branco</b>
        </h2>
        <p className="text-[15px] font-medium text-heroi-suave">Traga o extrato e eu separo tudo em 1 minuto.</p>
        <Link href={voltaAoExtrato} className={BOTAO}>
          Traga seu extrato
        </Link>
        <div className="flex justify-center gap-6">
          <Link href="/comecar?passo=digitar" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
            Digitar
          </Link>
          <Link href="/comecar?passo=falar" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
            Falar
          </Link>
        </div>
      </HeroiDoTema>
    );
  }

  const rodape = (
    <div className="flex items-center justify-between gap-3">
      <Link href={atalho.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong underline-offset-4 hover:underline">
        {atalho.rotulo}
      </Link>
      <FecharAha />
    </div>
  );

  if (oQue === "primeiroGasto") {
    const g = await ultimoLancamento(ctx);
    const Icone = g?.parentCategory ? categoryIcon(ctx.categorias ?? ctx.profileKind, g.parentCategory) : Wallet;
    const titulo = g?.subcategoria || g?.descricao || "Gasto";
    return (
      <section className="flex flex-col gap-2.5" data-primeiro-gasto>
        <h2 className="titulo-tema px-1 text-[1.6rem] font-normal leading-tight text-ink">
          Seu primeiro gasto <b className="font-semibold">já está aqui.</b>
        </h2>
        {g && (
          <Card className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
            <LogoDoLancamento descricao={g.descricao} icon={Icone} size={40} />
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[15px] font-semibold text-ink">{titulo}</b>
              <small className="text-[12.5px] font-medium text-ink-muted">{g.parentCategory ? `${categoryLabel(ctx.categorias ?? ctx.profileKind, g.parentCategory)} · Hoje` : "Hoje"}</small>
            </span>
            <em className="whitespace-nowrap text-[15px] font-medium not-italic tabular-nums text-ink">{money(g.valor)}</em>
          </Card>
        )}
        <p className="px-1 text-[15px] font-medium text-ink">Com o mês todo, eu te digo quanto está livre.</p>
        <TresCaminhos extrato={voltaAoExtrato} digitar="Mais um gasto" />
        {rodape}
      </section>
    );
  }

  // O mês que o extrato montou (o de mais lançamentos no arquivo); sem ele, o mês de hoje.
  const hoje = nowInBrazil();
  const mes = mesDoTexto(comeco.mesDoExtrato) ?? { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, nome: nomeDoMes(hoje) };
  const [resumo, aConferir] = await Promise.all([resumoDoMesImportadoAction(mes.ano, mes.mes, ctx.profileId), contarAConferir(ctx)]);
  const aha = ahaDoMes(resumo);
  const tons = ["var(--color-accent)", "color-mix(in srgb, var(--color-accent) 62%, var(--color-surface))", "color-mix(in srgb, var(--color-accent) 34%, var(--color-surface))"];
  return (
    <section className="flex flex-col gap-2.5">
      <MarcaViuOMes />
      <h2 className="titulo-tema px-1 text-[1.6rem] font-normal leading-tight text-ink">
        Pronto, {nome}. <b className="font-semibold">Esse é o seu {mes.nome}.</b>
      </h2>
      {aha ? (
        <Card className="flex flex-col gap-1 p-4">
          <small className="text-[13.5px] font-medium text-ink-muted">Você gastou em {mes.nome}</small>
          <ValorDestaque texto={money(aha.total, { round: true })} />
          {aha.maior && (
            <p className="mt-1 text-[15px] font-medium leading-snug text-ink">
              A maior parte em <b className="font-semibold">{aha.maior.rotulo}</b>, <span className="whitespace-nowrap">{money(aha.maior.valor, { round: true })}</span> ({aha.maior.pct}%).
            </p>
          )}
          {aha.barras.length > 0 && (
            <>
              <div className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {aha.barras.map((b, i) => (
                  <i key={b.rotulo} style={{ flexGrow: b.pct, background: tons[i] }} />
                ))}
                {aha.restoPct > 0 && <i className="bg-border-strong" style={{ flexGrow: aha.restoPct }} />}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-medium text-ink-muted">
                {aha.barras.map((b, i) => (
                  <span key={b.rotulo} className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full" style={{ background: tons[i] }} aria-hidden />
                    {b.rotulo} {b.pct}%
                  </span>
                ))}
                {aha.restoPct > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-border-strong" aria-hidden />
                    Resto {aha.restoPct}%
                  </span>
                )}
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-[15px] font-medium text-ink">Seu extrato entrou. Os lançamentos estão em Transações.</p>
        </Card>
      )}
      {/* O que ficou sem resposta na conferência do começo (no máximo 3 perguntas na hora). */}
      {aConferir > 0 && (
        <Link href="/mensal/foco/revisar" className="flex min-h-11 items-center gap-2 px-1 text-[14.5px] font-medium text-ink-muted hover:text-ink" data-a-conferir-no-aha>
          <ListChecks size={16} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{aConferir === 1 ? "1 lançamento para conferir, quando quiser." : `${aConferir} lançamentos para conferir, quando quiser.`}</span>
          <ChevronRight size={16} className="shrink-0" aria-hidden />
        </Link>
      )}
      {rodape}
    </section>
  );
}

/** Para onde cada um dos Primeiros passos leva. */
function hrefDoPasso(chave: PrimeiroPasso, hrefMes: string, comeco: Comeco): string {
  if (chave === "extrato") {
    const falta = bancosPendentes(comeco)[0];
    if (falta) return `/comecar?passo=tutorial&banco=${falta}`;
    return "/comecar?passo=volta";
  }
  if (chave === "revisar") return hrefMes;
  if (chave === "plano") return "/orcamento";
  if (chave === "meta") return "/planejamento/metas";
  return "/configuracoes/notificacoes";
}

/** O cartão dos Primeiros passos, com o que os dados já provam marcado. */
export async function PrimeirosPassos({ ctx, comeco, hrefMes }: { ctx: AuthContext; comeco: Comeco; hrefMes: string }) {
  const p = primeirosPassos(comeco, await sinaisDosPrimeirosPassos(ctx));
  const passos: PassoNaTela[] = p.passos.map((x) => ({
    ...x,
    ...TITULOS_PRIMEIROS[x.chave],
    ...(x.chave === "extrato" ? { titulo: tituloDoPassoDoExtrato(comeco) } : {}),
    href: hrefDoPasso(x.chave, hrefMes, comeco),
  }));
  return <CartaoPrimeirosPassos passos={passos} feitos={p.feitos} />;
}

/**
 * A Visão geral de quem ainda não trouxe dados (pedido da dona, 12/10/2026), no lugar do antigo
 * "Comece por aqui": os dois cartões grandes do começo ("Enviar o extrato" e "Digitar um gasto"),
 * que abrem os mesmos fluxos do /comecar (banco, passo a passo, teclado), os Primeiros passos,
 * que se marcam sozinhos pelos dados, e o atalho para os vídeos do "Como funciona".
 * Quem já usava o app e nunca passou pelo começo novo vê o mesmo, com um começo vazio.
 */
export async function ComecoDoMes({ ctx, comeco, mes, hrefMes }: { ctx: AuthContext; comeco: Comeco | null; mes: string; hrefMes: string }) {
  const base = comeco ?? lerComeco({ passo: "porta", terminouEm: "sem-comeco" })!;
  const extrato = `/comecar?passo=${base.banco ? "volta" : "banco"}`;
  return (
    <section className="flex flex-col gap-3" data-comeco-do-mes>
      <h2 className="titulo-tema px-1 text-[1.6rem] font-normal leading-tight text-ink">
        Seu {mes} <b className="font-semibold">começa aqui</b>
      </h2>
      <TresCaminhos extrato={extrato} digitar="Digitar um gasto" />
      {!base.passosFechados && <PrimeirosPassos ctx={ctx} comeco={base} hrefMes={hrefMes} />}
      <Link href={LINK_COMO_FUNCIONA} className="flex min-h-11 items-center justify-center gap-1.5 px-2 text-center text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
        <PlayCircle size={16} className="shrink-0" aria-hidden />
        Veja em vídeo como funciona
        <ChevronRight size={14} className="shrink-0" aria-hidden />
      </Link>
    </section>
  );
}

/**
 * Os três caminhos do mesmo tamanho (proposta do primeiro uso, 14/10/2026): o extrato em destaque,
 * digitar e falar logo embaixo. Abrem os mesmos fluxos do /comecar.
 */
function TresCaminhos({ extrato, digitar }: { extrato: string; digitar: string }) {
  const cartao = "glass flex min-h-[88px] items-center gap-3.5 rounded-3xl px-[18px] py-3.5 text-left";
  const bolinha = "flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong";
  return (
    <div className="flex flex-col gap-2.5" data-tres-caminhos>
      <Link href={extrato} className="block text-left">
        <HeroiDoTema className="min-h-[88px] !flex-row !items-center !gap-3.5 !px-[18px] !py-3.5">
          <span className="heroi-veu flex size-11 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <FileText size={21} strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-lg font-semibold leading-tight">Extrato ou fatura</b>
            <small className="text-sm font-medium text-heroi-suave">Mostra o mês todo</small>
          </span>
          <span className="heroi-veu shrink-0 self-start rounded-full px-2.5 py-1 text-[12.5px] font-semibold">1 minuto</span>
        </HeroiDoTema>
      </Link>
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/comecar?passo=digitar" className={cartao}>
          <span className={bolinha} aria-hidden>
            <Keyboard size={20} strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="text-[15px] font-semibold leading-tight text-ink">{digitar}</b>
            <small className="text-[13px] font-medium text-ink-muted">Digitar</small>
          </span>
        </Link>
        <Link href="/comecar?passo=falar" className={cartao}>
          <span className={bolinha} aria-hidden>
            <Mic size={20} strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="text-[15px] font-semibold leading-tight text-ink">Falar</b>
            <small className="text-[13px] font-medium text-ink-muted">Do jeito que sai</small>
          </span>
        </Link>
      </div>
    </div>
  );
}

const ICONE_DO_QUER = { lista: LayoutList, desce: TrendingDown, alvo: Target, sobe: TrendingUp } as const;

/**
 * "O que você quer agora?" no segundo dia (saiu do começo em 14/10/2026): um toque grava e leva
 * para o lugar certo (o plano, as dívidas, a meta ou a estratégia).
 */
export function PerguntaDoSegundoDia() {
  return (
    <section className="flex flex-col gap-3" data-pergunta-segundo-dia>
      <h2 className="titulo-tema px-1 text-[1.6rem] font-normal leading-tight text-ink">
        O que você <b className="font-semibold">quer agora?</b>
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {OPCOES_QUER.map((o) => {
          const Icone = ICONE_DO_QUER[o.icone];
          return (
            <form key={o.chave} action={escolherQuerAction.bind(null, o.chave)}>
              <button type="submit" className="glass flex min-h-[104px] w-full flex-col items-start gap-3 rounded-[22px] p-3.5 text-left active:scale-[0.98]">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
                  <Icone size={19} strokeWidth={1.8} />
                </span>
                <b className="text-[15px] font-semibold leading-tight text-ink">{o.titulo}</b>
              </button>
            </form>
          );
        })}
      </div>
      <p className="px-1 text-sm font-medium text-ink-muted">Isso muda o que eu te mostro primeiro.</p>
    </section>
  );
}
