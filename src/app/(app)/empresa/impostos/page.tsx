import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { diaDaSemanaDe, resumoDaEmpresa, MESES } from "@/lib/empresa/resumo";
import { ehGuiaDoMei } from "@/lib/empresa/regras";
import { textoDaGuia } from "@/lib/empresa/legal";
import { serverMoney } from "@/lib/money-server";
import { Cartao, Heroi, Titulo, Voltar } from "../partes";

/**
 * Impostos: a guia do MEI do mês, com a data e a fonte no "?". Autônoma e ME não têm esta tela (sem
 * fonte, o app não mostra número; plano, pendências 5.1.12 e 5.2.10), nem o MEI sem a guia na
 * tabela: volta para a Visão geral da Empresa (12/10/2026, nada de "em breve").
 */
export default async function ImpostosPage() {
  const ctx = await getRequiredSession();
  const [dados, money] = await Promise.all([carregarEmpresa(ctx), serverMoney()]);
  if (!dados.config) redirect("/empresa");
  const { guia } = resumoDaEmpresa(dados);
  if (!guia) redirect("/empresa");
  const ultima = dados.lancamentos.find((l) => ehGuiaDoMei(l));
  const pagasNoAno = dados.lancamentos.filter((l) => l.year === dados.mesAtual.ano && ehGuiaDoMei(l));
  const ajuda = textoDaGuia(dados.legal, ultima?.amount ?? null);
  return (
    <>
      <Voltar>{dados.nome}</Voltar>
      <Titulo>Impostos</Titulo>
      <Heroi rotulo={`Guia do MEI de ${MESES[dados.mesAtual.mes - 1]}`} valor={money(guia.valor)} ajuda={ajuda}>
        <p className="text-sm font-medium">{guia.paga ? "paga" : guia.diasAte < 0 ? `venceu dia ${Number(guia.vence.slice(8))}` : `vence ${diaDaSemanaDe(guia.vence)}`}</p>
      </Heroi>
      {pagasNoAno.length > 0 && (
        <Cartao className="flex min-h-14 items-center justify-between gap-3 px-4">
          <span className="text-[15px] text-ink">
            Pagas em {dados.mesAtual.ano} <small className="text-ink-muted">({pagasNoAno.length})</small>
          </span>
          <b className="text-[15px] font-medium tabular-nums text-ink">{money(pagasNoAno.reduce((s, l) => s + l.amount, 0))}</b>
        </Cartao>
      )}
    </>
  );
}
