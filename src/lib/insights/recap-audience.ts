/**
 * Quem recebe o quê no dia 1º: quem teve movimento no mês ganha o RESUMO; quem não teve ganha
 * um CONVITE pra começar. São os dois lados do mesmo envio mensal — ninguém recebe os dois, e
 * ninguém fica de fora por acaso.
 *
 * Regra separada da rotina de envio de propósito: é aqui que mora a diferença entre "lembrete
 * útil" e "e-mail chato", então precisa ser testável sem banco nem e-mail no meio.
 */

/** Depois de algumas tentativas sem resposta, o app para de insistir. Quem não usou o app em
 * três meses seguidos não vai passar a usar porque chegou o quarto e-mail — daí em diante é
 * só incômodo. */
export const MAX_NUDGES = 3;

export type RecapDecision = "resumo" | "convite" | "nada";

export type RecapCandidate = {
  /** Teve lançamento no mês que está sendo fechado. */
  hasActivityInMonth: boolean;
  /** Já recebeu o e-mail deste mês (trava de reenvio do cron). */
  alreadySentThisMonth: boolean;
  /** Desligou o e-mail em Configurações › Notificações. */
  wantsEmail: boolean;
  /** Quantos convites já foram enviados até agora. */
  nudgeCount: number;
  /** Conta criada ANTES do mês que está sendo fechado. */
  existedBeforeMonth: boolean;
};

/**
 * O que enviar (ou não) pra uma pessoa. "nada" é resposta legítima e comum — silêncio é melhor
 * que e-mail sem motivo.
 */
export function decideRecapEmail(candidate: RecapCandidate): RecapDecision {
  if (!candidate.wantsEmail) return "nada";
  if (candidate.alreadySentThisMonth) return "nada";
  if (candidate.hasActivityInMonth) return "resumo";

  // Quem criou a conta DENTRO do mês que está fechando não recebe "você não fez nada em
  // setembro" no dia 1º de outubro — mal teve tempo de conhecer o app.
  if (!candidate.existedBeforeMonth) return "nada";
  if (candidate.nudgeCount >= MAX_NUDGES) return "nada";
  return "convite";
}

/**
 * De qual perfil é o resumo do mês. A decisão (resumo ou convite) e os números precisam sair do
 * MESMO perfil: antes a atividade contava todos os perfis e os totais só o ativo, e quem lançou
 * o mês inteiro no Pessoal e terminou olhando a Empresa recebia "entrou R$ 0, gastou R$ 0" — com
 * o e-mail do mês marcado como enviado, o resumo certo nunca chegava.
 *
 * Vale o perfil ativo se ele teve lançamento no mês (é o que ela vê ao clicar no e-mail); senão,
 * o perfil com mais lançamentos. null = nenhum perfil teve movimento (lançamento sem perfil é
 * histórico de antes dos perfis e não aparece em tela nenhuma), então não há resumo pra mandar.
 */
export function escolherPerfilDoResumo(
  lancamentosPorPerfil: { profileId: string | null; lancamentos: number }[],
  perfilAtivoId: string,
): string | null {
  const comMovimento = lancamentosPorPerfil.filter(
    (p): p is { profileId: string; lancamentos: number } => p.profileId !== null && p.lancamentos > 0,
  );
  if (comMovimento.some((p) => p.profileId === perfilAtivoId)) return perfilAtivoId;
  let melhor: { profileId: string; lancamentos: number } | null = null;
  for (const p of comMovimento) if (!melhor || p.lancamentos > melhor.lancamentos) melhor = p;
  return melhor?.profileId ?? null;
}
