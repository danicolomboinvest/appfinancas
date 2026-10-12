import { notFound, redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { naAppDaApple, noAppAndroid } from "@/lib/apple/app-da-apple";
import { guardarTokenApple } from "@/lib/repositories/assinaturaApple.repo";
import { temAdicional } from "@/lib/adicionais/acesso";
import { ADICIONAIS, ehAdicional, precoDoAdicional } from "@/lib/adicionais/config";
import { CompraDoAdicional, type ComoPagar } from "./CompraDoAdicional";

/**
 * A tela de compra de um adicional (11/10/2026): /adicionais/perfil_empresa e
 * /adicionais/conta_parceiro. A trava do perfil Empresa manda pra cá (perfis/actions.ts).
 * Quem já tem (ou antes do lançamento, quando todo mundo tem) volta para os perfis.
 *
 * Como paga depende de onde ela está: no app iOS, só pela Apple (guideline 3.1.1); no app Android,
 * só o aviso de que se compra pelo site, sem link (política do Google Play); no navegador, o
 * checkout da Hubla.
 */
export default async function AdicionalPage(props: PageProps<"/adicionais/[qual]">) {
  const { qual } = await props.params;
  if (!ehAdicional(qual)) notFound();
  const ctx = await getRequiredSession();
  if (await temAdicional(ctx.userId, qual)) redirect("/configuracoes/perfis");

  const dados = ADICIONAIS[qual];
  let comoPagar: ComoPagar;
  if (await naAppDaApple()) comoPagar = { via: "apple", produto: dados.apple, token: await guardarTokenApple(await getOwnUser(ctx)) };
  else if (await noAppAndroid()) comoPagar = { via: "site" };
  else comoPagar = { via: "hubla", link: dados.hubla };

  return <CompraDoAdicional adicional={qual} nome={dados.nome} frase={dados.frase} preco={precoDoAdicional(qual)} comoPagar={comoPagar} />;
}
