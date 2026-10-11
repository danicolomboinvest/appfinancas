import { prisma } from "@/lib/db/prisma";
import type { ParametrosDoMei, Parametro } from "@/lib/empresa/legal";

/**
 * Os números legais do MEI valendo numa data (a linha mais nova de cada chave que já começou a
 * valer). Tabela da plataforma, não de perfil: o teto do MEI é o mesmo para todo mundo.
 */
export async function parametrosDoMei(data: string): Promise<ParametrosDoMei> {
  const linhas = await prisma.parametroLegal.findMany({
    where: { chave: { startsWith: "mei_" }, vigenteDesde: { lte: new Date(`${data}T00:00:00Z`) } },
    orderBy: { vigenteDesde: "desc" },
  });
  const pega = (chave: string): Parametro | null => {
    const l = linhas.find((x) => x.chave === chave);
    return l ? { valor: Number(l.valor), fonte: l.fonte, fonteData: l.fonteData.toISOString().slice(0, 10) } : null;
  };
  return {
    teto: pega("mei_teto_anual"),
    tolerancia: pega("mei_teto_tolerancia"),
    das: pega("mei_das_servico"),
    diaDoDas: pega("mei_das_dia_vencimento"),
  };
}
