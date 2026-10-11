import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PROFILE_THEMES, profileTheme } from "@/lib/profiles/themes";
import { periodoDoDia, vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { Cabecalho } from "../_ajustes/Lista";
import { EscolherVoz } from "./EscolherVoz";

export const metadata = { title: "Voz do app · SPI Finance" };

/**
 * Voz do app (rodadas 25 e 70): a voz vem junto com o estilo. Cada uma mostra como ela te
 * cumprimentaria agora, com o seu nome, e escolher a voz troca o estilo do perfil.
 */
export default async function VozPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  const nome = user.name?.split(" ")[0] || user.email.split("@")[0];
  const periodo = periodoDoDia(nowInBrazil().getHours());
  const vozes = PROFILE_THEMES.map((t) => ({ key: t.key, nome: t.nomeDaVoz ?? t.label, frase: vozDoTema(t.key, ctx.profileKind).saudacao(periodo, nome) }));
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Voz do app" sub="O jeito que o app fala com você." />
      <p className="text-sm text-ink">A voz vem junto com o estilo do app. Os números são os mesmos; muda o jeito de falar.</p>
      <EscolherVoz perfilId={ctx.profileId} atual={profileTheme(ctx.profileTheme).key} vozes={vozes} />
    </div>
  );
}
