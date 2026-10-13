import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { resumoDaEmpresa } from "@/lib/empresa/resumo";
import { chaveDoMes } from "@/lib/empresa/regras";
import { hrefDaLista, noPeriodoTexto, resumoDoPeriodo, umMesSo, type Grupo } from "@/lib/empresa/periodo";
import { lancamentosParaOPeriodo, padraoDaEmpresa, periodoDaTela } from "@/lib/empresa/periodo-dados";
import { paraO } from "@/lib/empresa/config";
import { serverMoney } from "@/lib/money-server";
import { Cartao, Titulo, Voltar } from "../partes";
import { SeletorDePeriodo } from "../SeletorDePeriodo";


/**
 * Relatórios: a DRE em palavras de dona (a conta é a mesma do recibo e do ponto de equilíbrio). Abre
 * no último mês fechado, como antes; o seletor de período (13/10/2026) mostra a DRE do ano, dos
 * últimos 12 meses ou de datas escolhidas. Cada linha abre os lançamentos dela, para editar.
 * Num mês só, o salário é o pago (ou o combinado, até o que sobrou); em mais de um mês, o pró-labore
 * lançado no período.
 */
export default async function RelatoriosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const [dados, money] = await Promise.all([carregarEmpresa(ctx), serverMoney()]);
  if (!dados.config) redirect("/empresa");
  const m0 = (v: number) => money(v, { round: true });
  const periodo = periodoDaTela(sp, dados.hoje, () => padraoDaEmpresa(dados));
  const lancs = await lancamentosParaOPeriodo(ctx, dados, periodo);
  const R = resumoDaEmpresa(dados);
  const P = resumoDoPeriodo(lancs, periodo, dados.hoje);
  const r = P.recibo;
  const mes = umMesSo(periodo, dados.hoje);
  const pago = mes ? (lancs.find((l) => l.externalId === `prolabore:${chaveDoMes(mes)}`)?.amount ?? null) : null;
  const sal = mes ? (pago ?? Math.min(R.salario, Math.max(0, r.sobrou))) : P.proLabore;
  const sobraFixo = r.entrou - r.impostos - r.variaveis;
  const linhas: [string, number, boolean, Grupo][] = [
    ["Faturou", r.entrou, false, "entradas"],
    [R.ehMei ? "Guia do MEI" : "Impostos", -r.impostos, false, "impostos"],
    ["Sobe com a venda", -r.variaveis, false, "variaveis"],
    ["Sobra para o fixo", sobraFixo, true, "lucro"],
    ["Contas do mês", -r.fixas, false, "fixas"],
    [`Sobrou ${paraO(dados.negocio)}`, r.sobrou, true, "lucro"],
    ["Seu salário", -sal, false, "prolabore"],
    ["Fica no caixa", r.sobrou - sal, true, "lucro"],
  ];
  return (
    <>
      <Voltar>{dados.nome}</Voltar>
      <Titulo nota={`A DRE ${noPeriodoTexto(periodo, dados.hoje)}, em palavras de dona.`}>Relatórios</Titulo>
      <SeletorDePeriodo periodo={periodo} hoje={dados.hoje} caminho="/empresa/relatorios" />
      <Cartao className="divide-y divide-border px-4" >
        {linhas.map(([t, v, forte, g]) => (
          <Link key={t} href={hrefDaLista(periodo, g, "/empresa/relatorios")} className={`flex min-h-12 items-center justify-between gap-3 text-[15px] ${forte ? "font-medium text-ink" : "text-ink"}`}>
            <span>{t}</span>
            <span className="flex items-center gap-1">
              <b className={`tabular-nums ${forte ? "font-semibold" : "font-normal"}`}>
                {v < 0 ? "−" : ""}
                {m0(Math.abs(v))}
              </b>
              <ChevronRight size={16} className="text-ink-muted" aria-hidden />
            </span>
          </Link>
        ))}
      </Cartao>
      <Link href="/empresa/como-vai" className="flex min-h-14 items-center justify-between gap-3 rounded-3xl border border-border bg-surface px-4">
        <span className="text-[15px] text-ink">Como vai a empresa</span>
        <ChevronRight size={18} className="text-ink-muted" aria-hidden />
      </Link>
    </>
  );
}
