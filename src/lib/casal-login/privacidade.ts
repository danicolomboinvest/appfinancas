import type { Prisma } from "@prisma/client";

/**
 * O filtro de privacidade do Nós dois, num lugar só (proposta aprovada: "uma função usada por
 * toda leitura do perfil Casal, com teste").
 *
 * Como o dado mora no banco:
 * - Tudo que é do casal ("nosso" e "da pessoa", que os dois veem) é gravado com o userId da
 *   TITULAR, dona do perfil. Se o par sai, o histórico fica com quem paga.
 * - O "só meu" da titular também é dela (userId dela) e leva soMeu = true.
 * - O "só meu" do par é gravado com o userId DELE. As 250 consultas que o app já tinha filtram
 *   por userId + profileId, então a titular nunca lê o só meu do par, sem mudar nenhuma delas.
 *
 * O par entra no app com o userId DELE (nunca o da titular). Por isso qualquer consulta antiga
 * que ele alcance devolve vazio, e não o dinheiro dela: o par só vê o casal pelas leituras daqui,
 * que pedem o perfil (sempre o Casal em que ele é membro) e escondem:
 * - o "só meu" da titular (nem o total);
 * - a renda da titular, a menos que ela ligue "mostrar minha renda" (ele vê só a proporção).
 *
 * O Pessoal e a Empresa da titular são outros perfis: nenhum filtro daqui sai do profileId do
 * Casal, então não há caminho até eles.
 */

/** O que a leitura precisa saber de quem está olhando. É um pedaço do AuthContext. */
export type QuemOlha = {
  userId: string;
  profileId: string;
  /** Dona do perfil, quando quem olha é o par. Ausente = quem olha é a dona. */
  donoId?: string;
  par?: { letra: "A" | "B"; mostrarRenda: boolean } | null;
};

export function ehOPar(q: QuemOlha): q is QuemOlha & { donoId: string; par: { letra: "A" | "B"; mostrarRenda: boolean } } {
  return Boolean(q.par && q.donoId && q.donoId !== q.userId);
}

/** O dono dos registros do perfil: a titular, para os dois. */
export function donoDoPerfil(q: QuemOlha): string {
  return ehOPar(q) ? q.donoId : q.userId;
}

/**
 * Os lançamentos do perfil Casal que quem olha pode VER (listas, totais, busca, "O meu no casal").
 * Para a dona é exatamente o filtro de sempre (userId + profileId).
 */
export function lancamentosVisiveis(q: QuemOlha): Prisma.MonthlyEntryWhereInput {
  if (!ehOPar(q)) return { userId: q.userId, profileId: q.profileId };
  const daTitular: Prisma.MonthlyEntryWhereInput = { userId: q.donoId, soMeu: false };
  // A renda da titular fica escondida: ele vê a renda que é dele (pessoa = a letra dele).
  if (!q.par.mostrarRenda) daTitular.OR = [{ category: { not: "INCOME" } }, { pessoa: q.par.letra }];
  return { profileId: q.profileId, OR: [daTitular, { userId: q.userId }] };
}

/**
 * Os lançamentos que entram na CONTA do acerto e do fechamento. Lidos só no servidor: a renda
 * da titular entra aqui (a fração pela renda depende dela), mas o que sai para a tela do par é
 * só a proporção. Nenhum "só meu" entra (de ninguém).
 */
export function lancamentosDoAcerto(q: QuemOlha): Prisma.MonthlyEntryWhereInput {
  return { userId: donoDoPerfil(q), profileId: q.profileId, soMeu: false };
}

/**
 * Os que quem olha pode EDITAR ou APAGAR. A titular, como sempre, mexe em tudo do perfil dela
 * (menos no só meu do par, que nem chega até ela). O par só mexe no que ele lançou.
 */
export function lancamentosQuePodeMexer(q: QuemOlha): Prisma.MonthlyEntryWhereInput {
  if (!ehOPar(q)) return { userId: q.userId, profileId: q.profileId };
  return { profileId: q.profileId, OR: [{ userId: q.donoId, autorUserId: q.userId }, { userId: q.userId }] };
}

/**
 * De quem é o registro novo. Nosso e "da pessoa" vão para a titular (o histórico fica com quem
 * paga); o só meu fica com quem lançou.
 */
export function donoDoNovoLancamento(q: QuemOlha, soMeu: boolean): string {
  return soMeu ? q.userId : donoDoPerfil(q);
}

/** Metas do casal: as do perfil Casal, que os dois veem e criam. Sempre da titular. */
export function metasDoCasal(q: QuemOlha): Prisma.GoalWhereInput {
  return { userId: donoDoPerfil(q), profileId: q.profileId };
}
