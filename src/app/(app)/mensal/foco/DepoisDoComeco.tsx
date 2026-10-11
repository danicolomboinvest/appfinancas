import Link from "next/link";
import { FileText, Wallet } from "lucide-react";
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
  bancosPendentes,
  tituloDoPassoDoExtrato,
  mesDoTexto,
  nomeDoMes,
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
  const voltaAoExtrato = `/comecar?passo=${comeco.banco ? "volta" : "banco"}`;

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
      <section className="flex flex-col gap-2.5">
        <h2 className="titulo-tema px-1 text-[1.6rem] font-normal leading-tight text-ink">
          Pronto, {nome}. <b className="font-semibold">Seu primeiro gasto está aqui.</b>
        </h2>
        <Card className="flex flex-col gap-3 p-4">
          {g && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <LogoDoLancamento descricao={g.descricao} icon={Icone} size={40} />
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[15px] font-semibold text-ink">{titulo}</b>
                <small className="text-[12.5px] font-medium text-ink-muted">{g.parentCategory ? `${categoryLabel(ctx.categorias ?? ctx.profileKind, g.parentCategory)} · Hoje` : "Hoje"}</small>
              </span>
              <em className="whitespace-nowrap text-[15px] font-medium not-italic tabular-nums text-ink">{money(g.valor)}</em>
            </div>
          )}
          <p className="text-[15px] font-medium text-ink">Traga o extrato e eu monto o mês inteiro.</p>
          <Link href={voltaAoExtrato} className={BOTAO}>
            <FileText size={18} aria-hidden />
            Trazer meu extrato
          </Link>
        </Card>
        {rodape}
      </section>
    );
  }

  // O mês que o extrato montou (o de mais lançamentos no arquivo); sem ele, o mês de hoje.
  const hoje = nowInBrazil();
  const mes = mesDoTexto(comeco.mesDoExtrato) ?? { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, nome: nomeDoMes(hoje) };
  const aha = ahaDoMes(await resumoDoMesImportadoAction(mes.ano, mes.mes, ctx.profileId));
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
      {rodape}
    </section>
  );
}

/** Para onde cada um dos Primeiros passos leva. */
function hrefDoPasso(chave: PrimeiroPasso, hrefMes: string, comeco: Comeco): string {
  if (chave === "extrato") {
    const falta = bancosPendentes(comeco)[0];
    if (falta) return `/comecar?passo=tutorial&banco=${falta}`;
    return `/comecar?passo=${comeco.banco ? "volta" : "banco"}`;
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
