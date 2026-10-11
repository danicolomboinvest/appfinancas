import type { Titulos } from "@/lib/profiles/voice";
import { sobrouDoMes } from "@/lib/consolidation/sobrou";

/**
 * O que a rota do resumo mensal manda pro modelo do e-mail (monthlyRecapEmail).
 *
 * 1) O valor grande é o SOBROU da regra única do app: entrou − gastou − guardou (versão nova,
 *    11/10/2026; ver lib/consolidation/sobrou.ts). Positivo é "sobrou", zero é "empatou" e
 *    negativo é "faltou", sempre sem sinal. Embaixo, Entrou, Gastou e Guardou fecham a conta.
 *    Antes o e-mail mostrava renda − gastos e o guardado à parte, e o número não batia com o
 *    da tela.
 *
 * 2) O botão leva pro fechamento do mês (/mensal/foco/fechamento), então fala disso: "Fechar
 *    setembro", e não "Ver o mês completo".
 *
 * Os rótulos trocados só valem pra este e-mail: a rota passa esta cópia do catálogo ao modelo.
 */
export function ajustarResumoPorEmail(
  t: Titulos,
  valores: { income: number; expense: number; investment: number },
  mesNome: string,
  /** Perfil Empresa: a linha do guardado continua com o termo de negócio ("Reteve"). */
  empresa = false,
): { balance: number; t: Titulos } {
  const balance = sobrouDoMes({ entrou: valores.income, gastou: valores.expense, guardou: valores.investment });
  return {
    balance,
    t: {
      ...t,
      emailRecapBotao: t.emailRecapBotaoFechar(mesNome),
      ...(!empresa ? { aportou: t.emailRecapGuardou } : {}),
    },
  };
}
