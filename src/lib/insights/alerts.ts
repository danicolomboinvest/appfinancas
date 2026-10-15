import type { ParentCategory, ProfileKind } from "@prisma/client";
import { categoryLabel } from "@/lib/categories";
import type { DadosDoAviso } from "@/lib/email/templates";
import { planoDeCobrir, porDiaComOLivre, quantoPassou, tempoDoMes, type CategoriaParaRemanejo } from "@/lib/planning/remanejo";

/** `dados` é o que o e-mail precisa para desenhar o aviso (barra, número, de onde tirar). */
export type Alert = { key: string; title: string; body: string; url: string; dados?: DadosDoAviso };

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Money = (v: number) => string;

/**
 * Dias que faltam no mês, CONTANDO HOJE (a régua do Orçamento: 25 dias no dia 7 de outubro; 1 no
 * último dia). É a única conta de dias dos avisos: o texto do aviso (que vira a prévia do e-mail)
 * e o corpo do e-mail leem daqui. Antes o texto contava sem hoje e o corpo com hoje, e o mesmo
 * e-mail dizia "faltam 24 dias" na prévia e "faltam 25 dias" lá dentro.
 */
export function diasQueFaltam(ano: number, mes: number, hoje: Date): number {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  return Math.max(1, diasNoMes - hoje.getDate() + 1);
}

/** "1 dia" / "25 dias". */
function dias(n: number): string {
  return n === 1 ? "1 dia" : `${n} dias`;
}

/**
 * Avisos de orçamento no meio do mês. Dois tipos, um aviso por categoria por mês em cada:
 * - 80% do planejado gasto com pelo menos 5 dias pela frente ("vai passar se seguir assim");
 * - passou do planejado ("Saúde passou R$ 67"; desde 11/10/2026 o app diz passou, nunca estourou).
 * A chave leva ano-mês, categoria e nível: o cron pode rodar todo dia sem repetir.
 *
 * "Passou" é gasto MAIOR que o plano, igual ao resto do app (compareCategoryBudget marca
 * DENTRO quando bate exato, e Análises usa percent > 1). Com `>=`, o aluguel de R$ 2.000 num
 * orçamento de R$ 2.000 mandava "Moradia estourou" no dia 1 enquanto o painel dizia DENTRO.
 *
 * O nível de 80% desconta dos dois lados o que já estava lançado ANTES do mês começar (o
 * aluguel com "Repetir até dezembro", as parcelas criadas pela importação da fatura): é conta
 * marcada, não ritmo de gasto — a mesma regra de ritmoDoMes e do Foco. Sem isso, o aluguel de
 * R$ 1.800 num plano de R$ 2.000 dava "Moradia já usou 90%" no dia 1.
 */
export function buildBudgetAlerts(input: {
  year: number;
  month: number;
  today: Date;
  planned: { parentCategory: ParentCategory; planned: number }[];
  spent: { parentCategory: ParentCategory; spent: number }[];
  /** Parte de `spent` criada antes do mês começar (conta fixa pré-lançada), por categoria. */
  preCriado?: { parentCategory: ParentCategory; spent: number }[];
  money: Money;
  /** Tipo do perfil de quem recebe: numa Empresa o aviso fala de "Estrutura", não de "Moradia". */
  kind?: ProfileKind | string | null;
  /**
   * As categorias criadas pela pessoa, com plano e gasto do mês: entram como origem possível do
   * "Tirar de" (a Compras da Ana é dela), nunca como aviso.
   */
  outras?: CategoriaParaRemanejo[];
  /** Categorias-mãe marcadas como essenciais (nunca viram origem). */
  essenciais?: ReadonlySet<string>;
  /** O livre do mês (plano − gastou), para a opção "Usar o livre". Null sem orçamento. */
  livre?: number | null;
}): Alert[] {
  const ym = `${input.year}-${String(input.month).padStart(2, "0")}`;
  // Uma conta só, contando hoje: o texto do aviso e o e-mail dizem o mesmo número.
  const diasComHoje = diasQueFaltam(input.year, input.month, input.today);
  const mesNome = NOMES_DOS_MESES[input.month - 1];
  const spentBy = new Map(input.spent.map((s) => [s.parentCategory, s.spent]));
  const preCriadoBy = new Map((input.preCriado ?? []).map((s) => [s.parentCategory, s.spent]));
  const out: Alert[] = [];
  for (const p of input.planned) {
    if (p.planned <= 0) continue;
    const spent = spentBy.get(p.parentCategory) ?? 0;
    const label = categoryLabel(input.kind, p.parentCategory);
    // Ritmo do 80%: só o que correu DENTRO do mês contra o que sobrou do plano depois das contas
    // marcadas. Se as contas marcadas já tomam o plano inteiro, não há ritmo pra medir.
    const fixo = Math.max(0, Math.min(preCriadoBy.get(p.parentCategory) ?? 0, spent));
    const planoVariavel = p.planned - fixo;
    const ritmo = planoVariavel > 0 ? (spent - fixo) / planoVariavel : 0;
    if (spent > p.planned) {
      const passou = quantoPassou({ planejado: p.planned, gasto: spent });
      out.push({
        key: `${ym}:${p.parentCategory}:100`,
        title: `${label} passou ${input.money(passou)}`,
        body: `${input.money(spent)} de ${input.money(p.planned)} planejados, e ${diasComHoje === 1 ? "ainda falta" : "ainda faltam"} ${dias(diasComHoje)}.`,
        // Abre a folha "O que fazer?" da categoria no Orçamento: o app sugere e ela confirma lá.
        url: `/orcamento/${input.year}?resolver=${p.parentCategory}`,
        dados: dadosDoPassou(p.parentCategory, label, p.planned, spent, passou),
      });
    } else if (ritmo >= 0.8 && diasComHoje - 1 >= 5) {
      // O corte continua o de antes: 5 dias pela frente depois de hoje.
      out.push({
        key: `${ym}:${p.parentCategory}:80`,
        // A porcentagem do título é a do plano inteiro (a que aparece nas outras telas); o
        // desconto das contas marcadas só decide SE avisa.
        title: `${label} já usou ${Math.round((spent / p.planned) * 100)}%`,
        body: `${diasComHoje === 1 ? "Falta" : "Faltam"} ${dias(diasComHoje)} e sobram ${input.money(p.planned - spent)} do planejado.`,
        url: `/orcamento/${input.year}`,
        dados: { tipo: "perto", categoriaKey: p.parentCategory, categoria: label, gasto: spent, plano: p.planned, mesNome, diasRestantes: diasComHoje },
      });
    }
  }
  return out;

  /** O que o e-mail do "passou" mostra: de onde tirar e como fica o livre, pela regra do app. */
  function dadosDoPassou(key: string, label: string, planejado: number, gasto: number, passou: number): DadosDoAviso {
    const todas: CategoriaParaRemanejo[] = [
      ...input.planned.map((c) => ({ key: c.parentCategory, label: categoryLabel(input.kind, c.parentCategory), planejado: c.planned, gasto: spentBy.get(c.parentCategory) ?? 0, essencial: input.essenciais?.has(c.parentCategory) })),
      ...(input.outras ?? []),
    ];
    const plano = planoDeCobrir({ key, label, planejado, gasto }, todas, tempoDoMes(diasComHoje, new Date(input.year, input.month, 0).getDate()));
    const origem = plano.origens.length === 1 ? plano.origens[0] : null;
    const livre = input.livre ?? null;
    return {
      tipo: "passou",
      categoriaKey: key,
      categoria: label,
      gasto,
      plano: planejado,
      passou,
      mesNome,
      diasRestantes: diasComHoje,
      tirar: origem ? { de: origem.label, sobraDepois: origem.sobraDepois, principal: plano.principal === "tirar" } : null,
      livre: livre !== null && livre > 0 ? { antes: livre, depois: Math.max(0, livre - passou), porDia: porDiaComOLivre(livre, passou, diasComHoje) } : null,
    };
  }
}

export function buildGoalAlerts(input: {
  year: number;
  month: number;
  goals: { id: string; name: string; behind: boolean; monthly: number; guardado?: number; alvo?: number }[];
  money: Money;
}): Alert[] {
  const ym = `${input.year}-${String(input.month).padStart(2, "0")}`;
  return input.goals
    .filter((g) => g.behind)
    .map((g) => ({
      key: `${ym}:goal:${g.id}`,
      title: `"${g.name}" ficou para trás`,
      body: g.monthly > 0 ? `Para voltar ao ritmo, guarde ${input.money(g.monthly)} este mês.` : "Revise o prazo ou o valor da meta.",
      url: `/planejamento/metas/${g.id}`,
      ...(g.alvo !== undefined ? { dados: { tipo: "meta-atras" as const, nome: g.name, guardado: g.guardado ?? 0, alvo: g.alvo, porMes: g.monthly } } : {}),
    }));
}

/** Chave do "Você chegou lá": uma por meta, para sempre (não leva o mês). */
export function chaveDaMetaAtingida(goalId: string): string {
  return `goal-done:${goalId}`;
}

export type MetaAtingida = { id: string; nome: string; alvo: number; meses: number; mediaPorMes: number };

/**
 * As metas que chegaram lá (11/10/2026): guardado maior ou igual ao alvo. Só conta a meta que
 * teve aporte NESTE mês: a meta concluída há meses, que nunca recebeu o e-mail porque ele não
 * existia, não ganha um "você chegou lá" atrasado no dia em que isto for ao ar. A chave
 * goal-done:<id> no NotificationLog faz sair uma vez só.
 */
export function metasQueChegaramLa(input: {
  hoje: Date;
  goals: { id: string; name: string; alvo: number; guardado: number; criadaEm: Date; temAporteNoMes: boolean }[];
}): MetaAtingida[] {
  return input.goals
    .filter((g) => g.alvo > 0 && g.guardado >= g.alvo && g.temAporteNoMes)
    .map((g) => {
      const meses = Math.max(1, Math.round((input.hoje.getTime() - g.criadaEm.getTime()) / (30.44 * 86_400_000)));
      return { id: g.id, nome: g.name, alvo: g.alvo, meses, mediaPorMes: g.alvo / meses };
    });
}
