import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { formatPhone } from "@/lib/phone";
import { Cabecalho } from "../_ajustes/Lista";
import { ProfileForm } from "./ProfileForm";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";

export const metadata = { title: "Meus dados · SPI Finance" };

/** Meus dados (rodada 25): nome e celular; o e-mail é o de acesso. A foto troca no topo. */
export default async function MeusDadosPage() {
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const [user, plano] = await Promise.all([getOwnUser(ctx), getMonthlyPlan(ctx, agora.getFullYear(), agora.getMonth() + 1)]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Meus dados" sub="Nome, e-mail, celular, nascimento e renda." />
      <ProfileForm
        defaults={{
          name: user.name,
          email: user.email,
          phone: formatPhone(user.phone),
          nascimento: user.nascimento ? user.nascimento.toISOString().slice(0, 10) : null,
          renda: plano && plano.plannedIncome > 0 ? plano.plannedIncome : null,
        }}
      />
    </div>
  );
}
