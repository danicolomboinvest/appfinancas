/**
 * Os cartões que a pessoa pode ligar, tirar e reordenar no Resumo (pedido de uma cliente em
 * 15/10/2026, aprovado pela Dani no protótipo `resumo-editar-proposta`). A escolha vale por conta e
 * por perfil e fica no registro de decisões (tipo "resumo_layout"), sem migration.
 *
 * Os cartões que o Resumo já tinha ficam do jeito de sempre (largos). Os novos são quadrados, com
 * uma cor suave, e a pessoa os adiciona em "Editar". A sugestão, o acerto do Nós dois e os primeiros passos não são cartões: continuam onde sempre
 * estiveram.
 */
export const CARTOES_DO_RESUMO = ["hoje", "mes", "cats", "semana", "proximos", "ateagora"] as const;
/** Os cartões quadrados que a pessoa pode adicionar (nenhum vem ligado). */
export const CARTOES_NOVOS = ["guardado", "reserva", "divida", "contas", "cartao", "assin", "carteira"] as const;
export type CartaoDoResumo = (typeof CARTOES_DO_RESUMO)[number] | (typeof CARTOES_NOVOS)[number];
/** Uma meta no Resumo: "meta:" mais o id dela. A pessoa escolhe qual ao adicionar. */
export const PREFIXO_DA_META = "meta:";

/** A ordem de quem nunca editou: o Resumo de hoje, com a faixa do dia no topo. */
export const ORDEM_PADRAO: readonly CartaoDoResumo[] = ["hoje", "mes", "cats", "semana", "proximos"];

export const NOMES_DOS_CARTOES: Record<(typeof CARTOES_DO_RESUMO)[number] | (typeof CARTOES_NOVOS)[number], { nome: string; desc: string }> = {
  hoje: { nome: "Para gastar hoje", desc: "O valor do dia, até domingo" },
  mes: { nome: "Quanto saiu no mês", desc: "Contra o mês passado" },
  cats: { nome: "Categorias que mudaram", desc: "As que mais pesaram" },
  semana: { nome: "Para gastar na semana", desc: "Com a data do último extrato" },
  proximos: { nome: "Próximos meses", desc: "Parcelas e contas que vêm" },
  // O quadro "Outubro até agora" do Resumo antigo (pedido da Dani, 18/10/2026): largo, do jeito
  // que era, mas fora da ordem padrão (a pessoa adiciona em "Editar").
  ateagora: { nome: "O mês até agora", desc: "Entrou, gastou, guardou e sobrou" },
  guardado: { nome: "Guardado no ano", desc: "O total e a parte do que entrou" },
  reserva: { nome: "Reserva de emergência", desc: "Quantos meses ela cobre" },
  divida: { nome: "Dívidas", desc: "Só quanto falta pagar" },
  contas: { nome: "Contas desta semana", desc: "Quantas vencem e quanto soma" },
  cartao: { nome: "Gasto no cartão", desc: "O que foi no cartão neste mês" },
  assin: { nome: "Assinaturas", desc: "Quanto custam por mês" },
  carteira: { nome: "Carteira e rendimento", desc: "Quanto vale e quanto rendeu no mês" },
};

const ID_DE_META = /^meta:[A-Za-z0-9_-]{6,40}$/;

export function ehCartaoDoResumo(v: unknown): v is CartaoDoResumo {
  return typeof v === "string" && ((CARTOES_DO_RESUMO as readonly string[]).includes(v) || (CARTOES_NOVOS as readonly string[]).includes(v) || ID_DE_META.test(v));
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
