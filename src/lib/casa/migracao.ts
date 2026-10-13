/**
 * A migração do Nós dois para o Casal simples (fase 5), como conta pura: recebe o retrato de uma
 * casa e devolve o plano do que muda. Quem executa (scripts/migrar-casal-simples.ts) só segue o
 * plano, e grava no vínculo o caminho de volta.
 *
 * As regras (proposta aprovada, "E o Nós dois de hoje? Vira isso, sem perder nada"):
 * - Gasto do perfil Nós dois vai para o Pessoal de quem pagou (a coluna pessoa: A ou B).
 * - "Só meu" continua só de quem lançou: vai para o Pessoal do dono do registro (nunca para o
 *   do outro, mesmo que a pessoa marcada seja a outra) e continua Só meu.
 * - "Da pessoa" (fora do acerto) continua fora do acerto (doCasal = false fica).
 * - Acertos, meses fechados, metas a dois e o orçamento do casal ficam onde estão (o perfil
 *   Casal antigo, que some do menu mas não é apagado). O aporte de uma meta a dois fica junto da
 *   meta, senão a meta perde o que já tinha guardado.
 * - Lançamento que já existe no Pessoal de destino (o mesmo id do banco do Open Finance) fica
 *   no Casal: mover criaria uma duplicata.
 */

export type Destino = "titular" | "par";

export type LancamentoDoCasal = {
  id: string;
  userId: string;
  pessoa: string | null;
  soMeu: boolean;
  doCasal: boolean | null;
  category: string;
  amount: number;
  year: number;
  month: number;
  entryDate: string | null;
  description: string | null;
  externalId: string | null;
  /** O aporte é de uma meta do perfil Casal (meta a dois). */
  metaDoCasal: boolean;
  /** Nome da categoria personalizada do perfil Casal, quando o lançamento usa uma. */
  categoriaPersonalizada: { id: string; nome: string } | null;
};

export type RetratoDaCasa = {
  membroId: string;
  casalProfileId: string;
  titularId: string;
  parId: string;
  letraPar: "A" | "B";
  nomes: { titular: string; par: string };
  pessoalTitular: string | null;
  pessoalPar: string | null;
  lancamentos: LancamentoDoCasal[];
  /** externalId que já existe em cada Pessoal de destino. */
  externosNoDestino: Record<Destino, string[]>;
  /** "ano-mes-dia-valor-descrição" do que já existe em cada Pessoal (para avisar de repetido). */
  assinaturasNoDestino: Record<Destino, string[]>;
  /** O que fica preservado no perfil Casal, só para o relatório. */
  preservados: { acertos: string[]; fechamentos: number; metas: number; orcamentos: number; lotes: number };
};

export type Movimento = { id: string; destino: Destino; soMeu: boolean; categoriaPersonalizada: { id: string; nome: string } | null };

export type PlanoDaMigracao = {
  membroId: string;
  movimentos: Movimento[];
  ficam: { id: string; motivo: "meta a dois" | "já existe no Pessoal" | "de outra conta" }[];
  contagem: {
    paraTitular: { quantos: number; gasto: number; entrada: number };
    paraPar: { quantos: number; gasto: number; entrada: number };
    soMeu: Record<Destino, number>;
    daPessoaForaDoAcerto: number;
  };
  /** Categorias personalizadas do Casal que precisam existir no Pessoal de destino (com o mesmo nome). */
  categorias: { destino: Destino; nome: string; deId: string }[];
  /** Iguais em dia, valor e descrição ao que já está no Pessoal: podem ser o mesmo gasto lançado duas vezes. */
  possiveisRepetidos: { id: string; destino: Destino; descricao: string; valor: number; dia: string }[];
  criarPessoal: Record<Destino, boolean>;
  preservados: RetratoDaCasa["preservados"];
};

export function assinatura(l: { year: number; month: number; entryDate: string | null; amount: number; description: string | null }): string {
  const desc = (l.description ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${l.year}-${l.month}-${l.entryDate ?? ""}-${Math.abs(l.amount).toFixed(2)}-${desc}`;
}

/** Para onde vai um lançamento do perfil Casal. Nulo = não é de nenhum dos dois. */
export function destinoDe(l: Pick<LancamentoDoCasal, "userId" | "pessoa" | "soMeu">, r: Pick<RetratoDaCasa, "titularId" | "parId" | "letraPar">): Destino | null {
  if (l.userId !== r.titularId && l.userId !== r.parId) return null;
  // O "Só meu" é de quem lançou, nunca do outro (a promessa do Nós dois de antes).
  if (l.soMeu) return l.userId === r.parId ? "par" : "titular";
  if (l.userId === r.parId) return "par";
  return l.pessoa === r.letraPar ? "par" : "titular";
}

export function planejarMigracao(r: RetratoDaCasa): PlanoDaMigracao {
  const externos: Record<Destino, Set<string>> = { titular: new Set(r.externosNoDestino.titular), par: new Set(r.externosNoDestino.par) };
  const assinaturas: Record<Destino, Set<string>> = { titular: new Set(r.assinaturasNoDestino.titular), par: new Set(r.assinaturasNoDestino.par) };
  const plano: PlanoDaMigracao = {
    membroId: r.membroId,
    movimentos: [],
    ficam: [],
    contagem: {
      paraTitular: { quantos: 0, gasto: 0, entrada: 0 },
      paraPar: { quantos: 0, gasto: 0, entrada: 0 },
      soMeu: { titular: 0, par: 0 },
      daPessoaForaDoAcerto: 0,
    },
    categorias: [],
    possiveisRepetidos: [],
    criarPessoal: { titular: !r.pessoalTitular, par: !r.pessoalPar },
    preservados: r.preservados,
  };
  const categoriasVistas = new Set<string>();
  for (const l of r.lancamentos) {
    const destino = destinoDe(l, r);
    if (!destino) {
      plano.ficam.push({ id: l.id, motivo: "de outra conta" });
      continue;
    }
    if (l.metaDoCasal) {
      plano.ficam.push({ id: l.id, motivo: "meta a dois" });
      continue;
    }
    if (l.externalId && externos[destino].has(l.externalId)) {
      plano.ficam.push({ id: l.id, motivo: "já existe no Pessoal" });
      continue;
    }
    plano.movimentos.push({ id: l.id, destino, soMeu: l.soMeu, categoriaPersonalizada: l.categoriaPersonalizada });
    const c = destino === "titular" ? plano.contagem.paraTitular : plano.contagem.paraPar;
    c.quantos++;
    if (l.category === "EXPENSE") c.gasto += Math.abs(l.amount);
    if (l.category === "INCOME") c.entrada += Math.abs(l.amount);
    if (l.soMeu) plano.contagem.soMeu[destino]++;
    if (!l.soMeu && l.category === "EXPENSE" && l.doCasal === false) plano.contagem.daPessoaForaDoAcerto++;
    if (l.categoriaPersonalizada) {
      const k = `${destino}|${l.categoriaPersonalizada.nome}`;
      if (!categoriasVistas.has(k)) {
        categoriasVistas.add(k);
        plano.categorias.push({ destino, nome: l.categoriaPersonalizada.nome, deId: l.categoriaPersonalizada.id });
      }
    }
    if (assinaturas[destino].has(assinatura(l))) {
      plano.possiveisRepetidos.push({ id: l.id, destino, descricao: l.description ?? "", valor: Math.abs(l.amount), dia: l.entryDate ?? `${l.year}-${String(l.month).padStart(2, "0")}` });
    }
  }
  const centavos = (v: number) => Math.round(v * 100) / 100;
  for (const c of [plano.contagem.paraTitular, plano.contagem.paraPar]) {
    c.gasto = centavos(c.gasto);
    c.entrada = centavos(c.entrada);
  }
  return plano;
}

/** O caminho de volta, gravado no vínculo (MembroCasal.migracao) quando a migração roda. */
export type RegistroDaMigracao = {
  versao: 1;
  em: string;
  lancamentos: { id: string; userId: string; profileId: string; customCategoryId: string | null }[];
  perfisCriados: string[];
  categoriasCriadas: string[];
  /** A titular estava com o perfil Casal aberto: o Pessoal virou o padrão dela. */
  padraoDaTitularAntes: string | null;
  /** O par nunca tinha passado pelo começo: a migração marcou (a volta desmarca). */
  onboardingDoParMarcado: boolean;
};
