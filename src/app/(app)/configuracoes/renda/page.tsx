import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { Cabecalho } from "../_ajustes/Lista";
import { FormDaRenda } from "./FormDaRenda";

export const metadata = { title: "Renda e dia do pagamento · SPI Finance" };

/** "Renda e dia do pagamento" (protótipo, Configurações › Seu dinheiro): a renda do plano e o dia em que cai. */
export default async function RendaPage() {
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const [user, plano] = await Promise.all([getOwnUser(ctx), getMonthlyPlan(ctx, agora.getFullYear(), agora.getMonth() + 1)]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Renda e dia do pagamento" sub="É a renda do plano do mês. As contas do app partem dela." />
      <FormDaRenda renda={plano && plano.plannedIncome > 0 ? plano.plannedIncome : null} dia={user.diaDoPagamento ?? null} />
    </div>
  );
}
