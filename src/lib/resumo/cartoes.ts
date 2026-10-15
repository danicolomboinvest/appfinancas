/**
 * Os cartões que a pessoa pode ligar, tirar e reordenar no Resumo (pedido de uma cliente em
 * 15/10/2026, aprovado pela Dani no protótipo `resumo-editar-proposta`). A escolha vale por conta e
 * por perfil e fica no registro de decisões (tipo "resumo_layout"), sem migration.
 *
 * Nesta primeira leva só entram os cartões que o Resumo já tinha, mais a faixa "Para gastar hoje".
 * A sugestão, o acerto do Nós dois e os primeiros passos não são cartões: continuam onde sempre
 * estiveram.
 */
export const CARTOES_DO_RESUMO = ["hoje", "mes", "cats", "semana", "proximos"] as const;
export type CartaoDoResumo = (typeof CARTOES_DO_RESUMO)[number];

/** A ordem de quem nunca editou: o Resumo de hoje, com a faixa do dia no topo. */
export const ORDEM_PADRAO: readonly CartaoDoResumo[] = ["hoje", "mes", "cats", "semana", "proximos"];

export const NOMES_DOS_CARTOES: Record<CartaoDoResumo, { nome: string; desc: string }> = {
  hoje: { nome: "Para gastar hoje", desc: "O valor do dia, até domingo" },
  mes: { nome: "Quanto saiu no mês", desc: "Contra o mês passado" },
  cats: { nome: "Categorias que mudaram", desc: "As que mais pesaram" },
  semana: { nome: "Para gastar na semana", desc: "Com a data do último extrato" },
  proximos: { nome: "Próximos meses", desc: "Parcelas e contas que vêm" },
};

export function ehCartaoDoResumo(v: unknown): v is CartaoDoResumo {
  return typeof v === "string" && (CARTOES_DO_RESUMO as readonly string[]).includes(v);
}

/** Só ids que existem, sem repetir. Vazio (a pessoa tirou todos) é uma escolha válida. */
export function limparOrdem(v: unknown): CartaoDoResumo[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<CartaoDoResumo>();
  for (const item of v) if (ehCartaoDoResumo(item)) vistos.add(item);
  return [...vistos];
}

/**
 * A ordem que vale: a que a pessoa salvou (`salva`), ou a padrão quando nunca editou (`null`).
 * Um cartão que a pessoa nunca viu (entrou numa versão nova) não aparece sozinho: ela adiciona.
 */
export function ordemQueVale(salva: unknown): CartaoDoResumo[] {
  if (salva === null || salva === undefined) return [...ORDEM_PADRAO];
  return limparOrdem(salva);
}
