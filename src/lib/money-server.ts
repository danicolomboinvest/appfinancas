import { cache } from "react";
import { cookies } from "next/headers";
import { COOKIE_VALORES_OCULTOS } from "@/lib/valores-ocultos";
import { auth } from "@/lib/auth/auth.config";
import { getOwnUser } from "@/lib/repositories/user.repo";
import {
  toCurrencyCode,
  makeMoneyFormatter,
  type CurrencyCode,
  type MoneyFormatter,
} from "@/lib/money";

/**
 * A moeda da pessoa, do lado do servidor.
 *
 * `cache()` do React é o que torna isso barato e SEGURO ao mesmo tempo: o resultado vale só
 * dentro da requisição atual, então vinte componentes da mesma página fazem uma consulta só, e
 * a moeda de um usuário nunca vaza para a requisição de outro — o que aconteceria com uma
 * variável de módulo comum, já que o servidor atende várias pessoas no mesmo processo.
 *
 * Assim nenhum componente precisa receber a moeda por prop: cada Server Component pergunta.
 */
export const getUserCurrency = cache(async (): Promise<CurrencyCode> => {
  const session = await auth();
  if (!session?.user) return toCurrencyCode(null);
  // Mesma leitura cacheada que o layout usa pro tema: uma consulta por requisição, não duas.
  const user = await getOwnUser({ userId: session.user.id, role: session.user.role });
  return toCurrencyCode(user.currency);
});

/** O olho do topo fechado ("Ocultar valores"), neste aparelho. */
export const valoresOcultos = cache(async (): Promise<boolean> => (await cookies()).get(COOKIE_VALORES_OCULTOS)?.value === "1");

/** Açúcar pro uso mais comum: `const money = await serverMoney();` e depois `money(valor)`. */
export async function serverMoney(): Promise<MoneyFormatter> {
  const [moeda, ocultos] = await Promise.all([getUserCurrency(), valoresOcultos()]);
  return makeMoneyFormatter(moeda, ocultos);
}
