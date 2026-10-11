import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { serverMoney } from "@/lib/money-server";
import { analiseDaRendaFixa } from "@/lib/analysis/analises-dados";
import { numBR } from "@/lib/analysis/quatro-perguntas";
import { AnaliseCompleta } from "../../analises/AnaliseCompleta";

/**
 * A análise de um título de renda fixa da carteira: as quatro perguntas (quanto rende, até quando,
 * garantia, tirar antes), no mesmo formato de cartão. Só o que está no cadastro e na regra pública
 * do produto; o resto fica "Sem esse dado".
 */
export default async function AnaliseDaRendaFixaPage(props: PageProps<"/fichas/renda-fixa/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const rf = await analiseDaRendaFixa(ctx, id);
  if (!rf) notFound();
  const dif = rf.investido !== null ? rf.valor - rf.investido : null;
  return (
    <AnaliseCompleta
      ticker={rf.nome}
      titulo={rf.nome}
      subtitulo={null}
      perguntas={rf.perguntas}
      logo={rf.logo}
      centro={rf.perguntas[0].r}
      centroEhTexto
      fonte={null}
      paraVoce={[
        {
          rotulo: "Você tem",
          valor: money(rf.valor, { round: true }),
          detalhe: `${numBR(rf.peso)}% da carteira${dif !== null && rf.investido ? ` · ${money(Math.abs(dif), { round: true })} ${dif >= 0 ? "de rendimento" : "abaixo do investido"}` : ""}`,
        },
      ]}
      numeros={[]}
      naCarteira
      comparaCom={null}
      aviso="Renda fixa: a regra é fixa e pública. O imposto de renda cai com o tempo."
    />
  );
}
