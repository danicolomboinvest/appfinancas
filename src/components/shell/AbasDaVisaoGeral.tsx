"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { hrefDoMes, periodoDaRota, type AbaComMes } from "@/lib/visao-geral/periodo";
import { ABAS_DA_VISAO_GERAL, abaAtiva } from "./flow-tabs";
import { CarrosselDeAbas, ConteudoQueDesliza } from "./Carrossel";
import { SeletorDeMes } from "./SeletorDeMes";

const ABA_COM_MES: Record<string, AbaComMes | undefined> = { "/mensal/foco": "resumo", "/orcamento": "orcamento", "/mensal": "transacoes" };

/** O endereço de cada aba, levando o mês escolhido (Recorrentes não tem mês). */
function useHrefsDasAbas(): string[] {
  const caminho = usePathname();
  const busca = useSearchParams();
  const agora = nowInBrazil();
  const periodo = periodoDaRota(caminho, busca.get("mes"), agora);
  return ABAS_DA_VISAO_GERAL.map((aba) => {
    const comMes = ABA_COM_MES[aba.href];
    return periodo && comMes ? hrefDoMes(comMes, periodo.mes, agora) : aba.href;
  });
}

/**
 * As quatro abas da Visão geral (Resumo, Orçamento, Transações, Recorrentes) em pílulas que
 * deslizam de lado, e embaixo delas o seletor de mês (protótipo aprovado). A pílula aberta rola
 * para o meio quando troca; tocar perto da borda mostra a próxima inteira ("Recorrentes" não fica
 * mais cortado sem jeito de chegar nele).
 */
export function AbasDaVisaoGeral() {
  return (
    <Suspense fallback={<AbasSemMes />}>
      <AbasComMes />
    </Suspense>
  );
}

function AbasSemMes() {
  return <Pilulas hrefs={ABAS_DA_VISAO_GERAL.map((a) => a.href)} />;
}

function AbasComMes() {
  const hrefs = useHrefsDasAbas();
  return (
    <>
      <Pilulas hrefs={hrefs} />
      <SeletorDeMes />
    </>
  );
}

function Pilulas({ hrefs }: { hrefs: string[] }) {
  const pathname = usePathname();
  const ativa = abaAtiva(pathname);
  return (
    <div className="mb-3" data-tour="fluxo">
      <CarrosselDeAbas rotulo="Abas da Visão geral" ativa={ativa?.href ?? null} itens={ABAS_DA_VISAO_GERAL.map((aba, i) => ({ chave: aba.href, rotulo: aba.label, href: hrefs[i] }))} />
    </div>
  );
}

/**
 * Arrastar o conteúdo para o lado troca de aba (protótipo: o painel acompanha o dedo). Uns 70 px
 * de dedo levam para a aba do lado, com o mesmo mês; menos que isso, volta ao lugar.
 */
export function DeslizarEntreAbas({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Deslizar>{children}</Deslizar>
    </Suspense>
  );
}

function Deslizar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hrefs = useHrefsDasAbas();
  const ativa = abaAtiva(pathname);
  const i = ativa ? ABAS_DA_VISAO_GERAL.findIndex((a) => a.href === ativa.href) : -1;
  return (
    <ConteudoQueDesliza hrefs={hrefs} indice={i}>
      {children}
    </ConteudoQueDesliza>
  );
}
