import { respostaDaDecisao, respostaDoPlanoMexido, type LinhaDeDecisao, type Resposta } from "./regra";
import { TIPOS_DE_SUGESTAO, type Dispensa, type TipoDeSugestao } from "./sugestoes";

/**
 * Junta o que veio do banco (respostas.ts) nas respostas da regra única. Puro, para o teste cobrir
 * exatamente o que as telas recebem: quem é dono de cada resposta (casal), o período de cada uma e
 * o plano que subiu no mês sem resposta gravada.
 */

export type Dono = { userId: string; profileId: string };
export type DecisaoDoBanco = LinhaDeDecisao & { userId: string; profileId: string | null; createdAt: Date };
export type PlanoMexido = { chave: string; planejado: number; createdAt: Date; updatedAt: Date };
export type GastoComHora = { chave: string; valor: number; createdAt: Date };

/**
 * O plano que subiu no mês depois de criado (o Editar meu plano, ou o lápis de antes desta regra),
 * contra o plano do mês passado. A categoria de onde ela tirou para cobrir outra desceu: ela não
 * respondeu nada sobre essa.
 */
export function planosQueSubiram(mexidos: PlanoMexido[], planoAntes: Record<string, number>): PlanoMexido[] {
  return mexidos.filter((b) => b.updatedAt.getTime() - b.createdAt.getTime() > 60_000 && b.planejado > (planoAntes[b.chave] ?? 0));
}

export function juntarRespostas(e: {
  eu: Dono;
  linhas: DecisaoDoBanco[];
  /** Meia-noite do dia 1 do mês (Brasília). */
  comeco: Date;
  subiram?: PlanoMexido[];
  /** Os gastos das categorias que subiram, com a hora em que entraram no app. */
  gastosDosQueSubiram?: GastoComHora[];
}): { respostas: Resposta[]; dispensas: Dispensa[] } {
  const respostas: Resposta[] = [];
  const dispensas: Dispensa[] = [];
  for (const l of e.linhas) {
    const minha = l.userId === e.eu.userId && l.profileId === e.eu.profileId;
    const r = respostaDaDecisao(l);
    if (l.tipo === "sugestao_dispensada") {
      // O "Agora não" do Resumo é de quem olha: o do outro da casa não mexe no cartão dela.
      if (!minha) continue;
      const [tipo, ...resto] = (l.chave ?? "").split("|");
      if ((TIPOS_DE_SUGESTAO as readonly string[]).includes(tipo)) {
        const dados = (l.dados && typeof l.dados === "object" ? l.dados : {}) as Record<string, unknown>;
        dispensas.push({
          tipo: tipo as TipoDeSugestao,
          id: resto.join("|"),
          marca: l.descricao ?? "",
          em: l.createdAt,
          boa: dados.boa === true,
          semana: typeof dados.semana === "string" ? dados.semana : undefined,
          como: r?.como,
          gasto: typeof dados.gasto === "number" ? dados.gasto : undefined,
          excesso: typeof dados.excesso === "number" ? dados.excesso : undefined,
        });
      }
      // A resposta de categoria do Resumo é do mês (as outras sugestões têm a marca do extrato).
      if (r && r.assunto.startsWith("categoria:") && l.createdAt < e.comeco) continue;
    }
    if (!r) continue;
    // Do outro da casa, só o que é do orçamento que os dois dividem (a categoria).
    if (!minha && !r.assunto.startsWith("categoria:")) continue;
    respostas.push(r);
  }
  for (const b of e.subiram ?? []) {
    // O gasto da categoria na hora em que o plano mudou: o que já tinha entrado no app.
    const naHora = (e.gastosDosQueSubiram ?? []).filter((g) => g.chave === b.chave && g.createdAt <= b.updatedAt).reduce((s, g) => s + g.valor, 0);
    respostas.push(respostaDoPlanoMexido(b.chave, Math.max(0, naHora)));
  }
  return { respostas, dispensas };
}
