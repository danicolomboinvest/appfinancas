import { getRequiredSession } from "@/lib/auth/session";
import { PROFILE_THEMES, profileTheme } from "@/lib/profiles/themes";
import { abertura, type Tom } from "@/lib/decisoes/respostas";
import { serverMoney } from "@/lib/money-server";
import { Cabecalho } from "../_ajustes/Lista";
import { EscolherVoz } from "./EscolherVoz";

export const metadata = { title: "Voz do app · SPI Finance" };

/**
 * Voz do app (rodadas 25 e 70): a voz vem junto com o estilo. Cada uma mostra como ela te
 * cumprimentaria agora, com o seu nome, e escolher a voz troca o estilo do perfil.
 */
export default async function VozPage() {
  const ctx = await getRequiredSession();
  // Protótipo: o mesmo aviso dito por cada voz (a abertura do tema + "saúde passou R$ 67 do plano").
  const money = await serverMoney();
  const vozes = PROFILE_THEMES.map((t) => {
    const abre = abertura(t.key as Tom, "atencao");
    const aviso = `saúde passou ${money(67, { round: true })} do plano.`;
    return { key: t.key, nome: t.nomeDaVoz ?? t.label, frase: abre ? `${abre}${aviso}` : `${aviso.charAt(0).toUpperCase()}${aviso.slice(1)}` };
  });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Voz do app" sub="A voz vem com o estilo do app. É o mesmo aviso dito de cada jeito:" />
      <EscolherVoz perfilId={ctx.profileId} atual={profileTheme(ctx.profileTheme).key} vozes={vozes} />
    </div>
  );
}
