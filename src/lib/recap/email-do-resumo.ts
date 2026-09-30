import type { Titulos } from "@/lib/profiles/voice";

/**
 * O que a rota do resumo mensal manda pro modelo do e-mail (monthlyRecapEmail), ajustado pra
 * dizer a coisa certa sem mexer no modelo (ele é de outra frente de trabalho).
 *
 * 1) Guardar não é "faltar". O saldo antes era renda − gastos − guardado: quem ganhou 5.000,
 *    gastou 3.000 e guardou 2.500 recebia "Faltou no mês 🫣 R$ 500" em vermelho, justo no mês
 *    em que mais caprichou. Agora o valor grande é o que sobrou DEPOIS DOS GASTOS (renda −
 *    gastos), e o guardado vem logo abaixo como conquista ("E ainda guardou 🐷✨"). "Faltou" só
 *    aparece quando ela gastou mais do que entrou.
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
  const balance = valores.income - valores.expense;
  const guardou = valores.investment > 0;
  return {
    balance,
    t: {
      ...t,
      emailRecapBotao: t.emailRecapBotaoFechar(mesNome),
      // Sem nada guardado, "Sobrou no mês" continua certo (renda − gastos é tudo que sobrou).
      ...(guardou && balance >= 0 ? { emailRecapSobrou: t.emailRecapSobrouDepoisDosGastos } : {}),
      ...(guardou && !empresa ? { aportou: t.emailRecapGuardou } : {}),
    },
  };
}
