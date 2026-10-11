import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { MESES, resumoDaEmpresa } from "@/lib/empresa/resumo";
import { chaveDoMes } from "@/lib/empresa/regras";
import { paraO } from "@/lib/empresa/config";
import { serverMoney } from "@/lib/money-server";
import { Cartao, Titulo, Voltar } from "../partes";

/**
 * Relatórios: a DRE do último mês fechado em palavras de dona (a conta é a mesma do recibo e do
 * ponto de equilíbrio). O painel do ano, que já existia, continua a um toque.
 */
export default async function RelatoriosPage() {
  const ctx = await getRequiredSession();
  const [dados, money] = await Promise.all([carregarEmpresa(ctx), serverMoney()]);
  if (!dados.config) redirect("/empresa");
  const m0 = (v: number) => money(v, { round: true });
  const R = resumoDaEmpresa(dados);
  const r = R.reciboFechado;
  const pago = dados.lancamentos.find((l) => l.externalId === `prolabore:${chaveDoMes(R.ultimoFechado)}`)?.amount ?? null;
  const sal = pago ?? Math.min(R.salario, Math.max(0, r.sobrou));
  const sobraFixo = r.entrou - r.impostos - r.variaveis;
  const linhas: [string, number, boolean][] = [
    ["Faturou", r.entrou, false],
    [R.ehMei ? "Guia do MEI" : "Impostos", -r.impostos, false],
    ["Sobe com a venda", -r.variaveis, false],
    ["Sobra para o fixo", sobraFixo, true],
    ["Contas do mês", -r.fixas, false],
    [`Sobrou ${paraO(dados.negocio)}`, r.sobrou, true],
    ["Seu salário", -sal, false],
    ["Fica no caixa", r.sobrou - sal, true],
  ];
  return (
    <>
      <Voltar>{dados.nome}</Voltar>
      <Titulo nota={`A DRE de ${MESES[R.ultimoFechado.mes - 1]}, em palavras de dona.`}>Relatórios</Titulo>
      <Cartao className="divide-y divide-border px-4">
        {linhas.map(([t, v, forte]) => (
          <p key={t} className={`flex min-h-12 items-center justify-between gap-3 text-[15px] ${forte ? "font-medium text-ink" : "text-ink"}`}>
            <span>{t}</span>
            <b className={`tabular-nums ${forte ? "font-semibold" : "font-normal"}`}>
              {v < 0 ? "−" : ""}
              {m0(Math.abs(v))}
            </b>
          </p>
        ))}
      </Cartao>
      <Link href="/dashboard" className="flex min-h-14 items-center justify-between gap-3 rounded-3xl border border-border bg-surface px-4">
        <span className="text-[15px] text-ink">Painel completo do ano</span>
        <ChevronRight size={18} className="text-ink-muted" aria-hidden />
      </Link>
    </>
  );
}
