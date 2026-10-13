"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { cabeMaisUmaLimpeza, limparDados, PerfilDeOutraPessoa } from "@/lib/repositories/limpar-dados.repo";
import { revogarNaPluggy } from "@/lib/pluggy/revogar";
import { confirmacaoValida, ehEscopoDaLimpeza, lerPartes, PALAVRA_DE_CONFIRMACAO, PARTES, type ContagensDaLimpeza, type EscopoDaLimpeza, type Parte } from "@/lib/limpar-dados/regras";
import { exportAssetsCsvAction, exportEntriesCsvAction } from "./actions";

/*
 * "Limpar meus dados e recomeçar" (12/10/2026): a tela é Configurações › Apagar dados ou conta
 * (ApagarDadosOuConta.tsx). Apagar a CONTA continua em delete-account-actions.ts.
 */

export type LimparDadosEntrada = {
  /** "perfil" = um perfil só; "todos" = todos os perfis dela. */
  escopo: EscopoDaLimpeza;
  /** Com "perfil": qual (um dos dela, ou o Casal aberto agora). Sem ele, o perfil aberto agora. */
  perfilId?: string;
  /** O que sai (ver PARTES). Sem ele, tudo. O servidor confere e aplica as dependências. */
  partes?: Parte[];
  /** Compatível com a primeira versão: false guarda o progresso do Money Reset quando `partes` não vem. */
  zerarMoneyReset?: boolean;
  /** A palavra de confirmação ("LIMPAR"). A tela manda depois de ela segurar o botão. */
  confirmacao: string;
};

export type LimparDadosResultado =
  | { ok: true; contagens: ContagensDaLimpeza; partes: Parte[]; recomecar: boolean }
  | { ok: false; erro: string; contagens?: undefined };

/** As telas que mostram dinheiro: depois de limpar, nenhuma pode servir a versão guardada. */
const TELAS = ["/mensal", "/mensal/foco", "/orcamento", "/planejamento", "/carteira", "/dividas", "/metas", "/divisao", "/empresa", "/money-reset", "/configuracoes", "/comecar"];

export async function limparDadosAction(entrada: LimparDadosEntrada): Promise<LimparDadosResultado> {
  const ctx = await getRequiredSession();
  // Tudo que vem da tela é conferido aqui: a tela pode ter sido pulada.
  if (!entrada || !ehEscopoDaLimpeza(entrada.escopo)) return { ok: false, erro: "Escolha o que limpar." };
  if (entrada.perfilId !== undefined && (typeof entrada.perfilId !== "string" || entrada.escopo !== "perfil")) return { ok: false, erro: "Escolha um dos seus perfis." };
  const partes = entrada.partes === undefined ? PARTES.filter((p) => p !== "moneyReset" || entrada.zerarMoneyReset !== false) : lerPartes(entrada.partes);
  if (!partes) return { ok: false, erro: "Escolha o que limpar." };
  if (!confirmacaoValida(entrada.confirmacao)) return { ok: false, erro: `Para confirmar, digite ${PALAVRA_DE_CONFIRMACAO}.` };
  if (!(await cabeMaisUmaLimpeza(ctx.userId))) return { ok: false, erro: "Você já limpou seus dados agora há pouco. Tente de novo daqui a uma hora." };

  let resultado: Awaited<ReturnType<typeof limparDados>>;
  try {
    resultado = await limparDados(ctx, { escopo: entrada.escopo, perfilId: entrada.perfilId, partes });
  } catch (err) {
    if (err instanceof PerfilDeOutraPessoa) return { ok: false, erro: "Escolha um dos seus perfis." };
    console.error("limparDadosAction falhou:", err);
    return { ok: false, erro: "Não consegui limpar agora. Nada foi apagado. Tente de novo em instantes." };
  }

  // Os bancos que saíram do app são revogados na Pluggy também (o mesmo do apagar conta): a
  // conexão já sumiu daqui, e o itemId só existe neste resultado.
  await revogarNaPluggy(resultado.itensPluggy);

  // Registro de auditoria nos logs do servidor: só números e ids opacos, nunca valor, nome ou
  // descrição.
  console.info(
    "[dados-limpos]",
    JSON.stringify({ userId: ctx.userId, escopo: entrada.escopo, partes: resultado.partes, perfis: resultado.perfis, contagens: resultado.contagens, itensPluggy: resultado.itensPluggy }),
  );

  // Quem voltou ao começo não pode ter a tela atual redesenhada agora: o layout do app mandaria
  // para /comecar antes da tela final aparecer. A tela final abre o começo com navegação inteira
  // (sem cache nenhum), então não precisa revalidar aqui.
  if (!resultado.recomecar) {
    revalidatePath("/", "layout");
    for (const tela of TELAS) revalidatePath(tela);
  }
  return { ok: true, contagens: resultado.contagens, partes: resultado.partes, recomecar: resultado.recomecar };
}

/**
 * "Baixar uma cópia antes": as mesmas exportações de Configurações › Dados (lançamentos e
 * carteira, de todos os perfis, com a coluna Perfil). A tela oferece; não é obrigatório.
 */
export async function copiaAntesDeLimparAction(): Promise<{ lancamentos: string; carteira: string }> {
  const [lancamentos, carteira] = await Promise.all([exportEntriesCsvAction(), exportAssetsCsvAction()]);
  return { lancamentos, carteira };
}
