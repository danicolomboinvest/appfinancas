import { cache } from "react";
import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
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
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true },
  });
  return toCurrencyCode(user?.currency);
});

/** Açúcar pro uso mais comum: `const money = await serverMoney();` e depois `money(valor)`. */
export async function serverMoney(): Promise<MoneyFormatter> {
  return makeMoneyFormatter(await getUserCurrency());
}
