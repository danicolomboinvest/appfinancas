import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { profileTheme } from "@/lib/profiles/themes";
import { Cabecalho, Grupo } from "../_ajustes/Lista";
import { AjustesRapidos } from "../_ajustes/AjustesRapidos";
import { EscolherEstilo } from "../_ajustes/EscolherEstilo";

export const metadata = { title: "Aparência · SPI Finance" };

/** Aparência (rodadas 25, 63 e 64): o modo (claro, escuro, automático) e os 4 estilos do app. */
export default async function AparenciaPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Aparência" sub="Tema e modo escuro." />
      <Grupo>
        <AjustesRapidos so="modo" moeda={user.currency} modo={user.theme} podeEscolherModo rotulos={{ modo: "Modo", claro: "Claro", escuro: "Escuro", moeda: "", moedaAviso: "" }} />
      </Grupo>
      <Grupo titulo="Estilo do app">
        <div className="pt-2">
          <EscolherEstilo perfilId={ctx.profileId} atual={profileTheme(ctx.profileTheme).key} />
        </div>
      </Grupo>
      <p className="px-1 text-[13px] text-ink-muted">O estilo vale para o perfil aberto. Cada perfil pode ter o seu.</p>
    </div>
  );
}
