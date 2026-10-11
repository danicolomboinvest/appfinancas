import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { formatPhone } from "@/lib/phone";
import { Cabecalho } from "../_ajustes/Lista";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Meus dados · SPI Finance" };

/** Meus dados (rodada 25): nome e celular; o e-mail é o de acesso. A foto troca no topo. */
export default async function MeusDadosPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Meus dados" sub="Nome, e-mail e celular." />
      <ProfileForm defaults={{ name: user.name, email: user.email, phone: formatPhone(user.phone) }} />
    </div>
  );
}
