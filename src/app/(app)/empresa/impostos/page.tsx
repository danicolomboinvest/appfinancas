import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { diaDaSemanaDe, resumoDaEmpresa, MESES } from "@/lib/empresa/resumo";
import { ehGuiaDoMei } from "@/lib/empresa/regras";
import { textoDaGuia } from "@/lib/empresa/legal";
import { serverMoney } from "@/lib/money-server";
import { Cartao, Heroi, Titulo, Voltar } from "../partes";

/**
 * Impostos: a guia do MEI do mês, com a data e a fonte no "?". Autônoma e ME aparecem como "em breve":
 * sem fonte, o app não mostra número (plano, pendências 5.1.12 e 5.2.10).
 */
export default async function ImpostosPage() {
  const ctx = await getRequiredSession();
  const [dados, money] = await Promise.all([carregarEmpresa(ctx), serverMoney()]);
  if (!dados.config) redirect("/empresa");
  const R = resumoDaEmpresa(dados);
  const ultima = dados.lancamentos.find((l) => ehGuiaDoMei(l));
  const pagasNoAno = dados.lancamentos.filter((l) => l.year === dados.mesAtual.ano && ehGuiaDoMei(l));
  const ajuda = textoDaGuia(dados.legal, ultima?.amount ?? null);
  return (
    <>
      <Voltar>{dados.nome}</Voltar>
      <Titulo>Impostos</Titulo>
      {R.guia ? (
        <Heroi rotulo={`Guia do MEI de ${MESES[dados.mesAtual.mes - 1]}`} valor={money(R.guia.valor)} ajuda={ajuda}>
          <p className="text-sm font-medium">{R.guia.paga ? "paga" : R.guia.diasAte < 0 ? `venceu dia ${Number(R.guia.vence.slice(8))}` : `vence ${diaDaSemanaDe(R.guia.vence)}`}</p>
        </Heroi>
      ) : null}
      {R.guia && pagasNoAno.length > 0 && (
        <Cartao className="flex min-h-14 items-center justify-between gap-3 px-4">
          <span className="text-[15px] text-ink">
            Pagas em {dados.mesAtual.ano} <small className="text-ink-muted">({pagasNoAno.length})</small>
          </span>
          <b className="text-[15px] font-medium tabular-nums text-ink">{money(pagasNoAno.reduce((s, l) => s + l.amount, 0))}</b>
        </Cartao>
      )}
      <p className="flex items-start gap-2 rounded-3xl bg-surface-2 px-4 py-3.5 text-sm text-ink">
        <CircleAlert size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
        <span>
          {R.ehMei ? (
            <>
              Autônoma e ME: <b className="font-semibold">em breve</b>. Quando chegar, é com um contador.
            </>
          ) : (
            <>
              Os impostos de autônoma e ME chegam <b className="font-semibold">em breve</b>. Até lá, confira com um contador.
            </>
          )}
        </span>
      </p>
    </>
  );
}
