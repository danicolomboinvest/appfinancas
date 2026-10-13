"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { cabeMaisUmaLimpeza, limparDados } from "@/lib/repositories/limpar-dados.repo";
import { confirmacaoValida, ehEscopoDaLimpeza, PALAVRA_DE_CONFIRMACAO, type ContagensDaLimpeza, type EscopoDaLimpeza } from "@/lib/limpar-dados/regras";
import { exportAssetsCsvAction, exportEntriesCsvAction } from "./actions";

/*
 * "Limpar meus dados e recomeçar" (12/10/2026). A tela ainda vai ser desenhada; estas são as duas
 * ações que ela chama. Apagar a CONTA continua em delete-account-actions.ts.
 */

export type LimparDadosEntrada = {
  /** "perfil" = só o perfil aberto agora; "todos" = todos os perfis dela. A tela decide. */
  escopo: EscopoDaLimpeza;
  /** O progresso do Money Reset sai junto (padrão). A compra do Money Reset nunca sai. */
  zerarMoneyReset?: boolean;
  /** A palavra digitada por ela ("LIMPAR"). */
  confirmacao: string;
};

export type LimparDadosResultado = { ok: true; contagens: ContagensDaLimpeza } | { ok: false; erro: string; contagens?: undefined };

/** As telas que mostram dinheiro: depois de limpar, nenhuma pode servir a versão guardada. */
const TELAS = ["/mensal", "/mensal/foco", "/orcamento", "/planejamento", "/carteira", "/dividas", "/metas", "/divisao", "/empresa", "/money-reset", "/configuracoes", "/comecar"];

export async function limparDadosAction(entrada: LimparDadosEntrada): Promise<LimparDadosResultado> {
  const ctx = await getRequiredSession();
  // Tudo que vem da tela é conferido aqui: a tela pode ter sido pulada.
  if (!entrada || !ehEscopoDaLimpeza(entrada.escopo)) return { ok: false, erro: "Escolha o que limpar." };
  if (!confirmacaoValida(entrada.confirmacao)) return { ok: false, erro: `Para confirmar, digite ${PALAVRA_DE_CONFIRMACAO}.` };
  if (!(await cabeMaisUmaLimpeza(ctx.userId))) return { ok: false, erro: "Você já limpou seus dados agora há pouco. Tente de novo daqui a uma hora." };

  const zerarMoneyReset = entrada.zerarMoneyReset !== false;
  let resultado: Awaited<ReturnType<typeof limparDados>>;
  try {
    resultado = await limparDados(ctx, { escopo: entrada.escopo, zerarMoneyReset });
  } catch (err) {
    console.error("limparDadosAction falhou:", err);
    return { ok: false, erro: "Não consegui limpar agora. Nada foi apagado. Tente de novo em instantes." };
  }

  // Registro de auditoria nos logs do servidor: só números e ids opacos, nunca valor, nome ou
  // descrição. Os itens da Pluggy ficam aqui porque a conexão foi removida só no app (a
  // revogação na Pluggy é manual por enquanto: ver o relatório da limpeza).
  console.info(
    "[dados-limpos]",
    JSON.stringify({ userId: ctx.userId, escopo: entrada.escopo, zerarMoneyReset, perfis: resultado.perfis, contagens: resultado.contagens, itensPluggy: resultado.itensPluggy }),
  );

  revalidatePath("/", "layout");
  for (const tela of TELAS) revalidatePath(tela);
  return { ok: true, contagens: resultado.contagens };
}

/**
 * "Baixar uma cópia antes": as mesmas exportações de Configurações › Dados (lançamentos e
 * carteira, de todos os perfis, com a coluna Perfil). A tela oferece; não é obrigatório.
 */
export async function copiaAntesDeLimparAction(): Promise<{ lancamentos: string; carteira: string }> {
  const [lancamentos, carteira] = await Promise.all([exportEntriesCsvAction(), exportAssetsCsvAction()]);
  return { lancamentos, carteira };
}
