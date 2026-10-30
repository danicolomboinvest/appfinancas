/**
 * "O que você montou no Nós dois está no seu Pessoal" (30/10/2026).
 *
 * Quem monta o perfil Casal antes de o par aceitar (orçamento, lançamentos, metas) e depois vê o
 * par entrar fica sem o Casal no menu: no Casal simples cada um usa o próprio Pessoal, e o aceite
 * leva o que ela lançou para o Pessoal dela (lib/repositories/casal-dados). Ninguém avisava. Caso
 * de 27/10/2026: a cliente achou que tinha perdido tudo, refez tudo num Nós dois novo e ficou em
 * dobro.
 *
 * O aviso é um cartão discreto no Resumo, uma vez só, só para a titular, só quando o aceite moveu
 * algo. Fica registrado em Decisao (tipo "casal_no_pessoal", chave = id do perfil Casal, criado
 * no aceite com `resolvidaEm` nulo); "Entendi" preenche `resolvidaEm` e ele não volta.
 *
 * Texto puro, sem React e sem banco, para dar para testar. Sem travessão, sem emoji, "para" e
 * nunca "pra".
 */

export const TIPO_AVISO_CASAL_NO_PESSOAL = "casal_no_pessoal" as const;

export type AvisoDoCasalNoPessoal = {
  /** Quantos registros o aceite levou do Casal para o Pessoal (Decisao.valor). */
  movidos: number;
};

/**
 * Quem vê o aviso: a titular, dentro do Pessoal dela na casa, enquanto a Decisao do aceite estiver
 * sem resposta. O par nunca vê (nada dele foi movido); fora da casa (na Empresa) também não.
 */
export function mostraAvisoDoCasalNoPessoal(p: { naCasa: boolean; papel: "titular" | "par" | null; pendente: boolean }): boolean {
  if (!p.naCasa || p.papel !== "titular") return false;
  return p.pendente;
}

/** O aceite só deixa o aviso quando levou alguma coisa: Casal vazio não tem o que explicar. */
export function aceiteDeixaAviso(movidos: number): boolean {
  return movidos > 0;
}

export function textosDoAvisoDoCasalNoPessoal(nomeDoPar: string): { titulo: string; texto: string; entendi: string; verACasa: string } {
  const nome = nomeDoPar.trim() || "Seu par";
  return {
    titulo: `${nome} entrou`,
    texto: `O que você montou no Nós dois está aqui, no seu Pessoal. A casa junta o seu e o de ${nome}, nada se perdeu.`,
    entendi: "Entendi",
    verACasa: "Ver a casa",
  };
}

/**
 * "Criar Nós dois" com a casa já ligada: não existe um segundo Nós dois para criar, e dizer só
 * "já existe" foi o que fez a cliente refazer tudo. Uma linha dizendo onde está.
 */
export function mensagemDoCriarNosDoisComCasa(nomeDoPar: string): string {
  const nome = nomeDoPar.trim() || "seu par";
  return `Você já está numa casa com ${nome}: o que é da casa fica no seu Pessoal. Para ver ou ajustar, abra Configurações › Casa.`;
}
