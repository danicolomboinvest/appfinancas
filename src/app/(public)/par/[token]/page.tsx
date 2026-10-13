import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth.config";
import { profileThemeCss } from "@/lib/profiles/themes";
import { coresDoCasalCss } from "@/lib/casal-login/cores";
import { limparToken, tokenTemFormato } from "@/lib/casal-login/token";
import { chaveDaOrigem } from "@/lib/casal-login/limite";
import { lerConviteParaTela, tentativaNaPaginaDoConvite } from "@/lib/repositories/casal-login.repo";
import { TelaDoConvite } from "@/components/casal-login/TelaDoConvite";

/**
 * O link do convite do par: financas.danicolombo.com.br/par/<código>.
 *
 * Abre igual no navegador (o par toca no link do WhatsApp) e dentro do app do iPhone (o
 * Capacitor carrega este mesmo domínio). Sem sessão, mostra o convite e o login; com sessão, diz
 * se é a própria titular, alguém já dentro, ou outra conta. Cada motivo de o link não abrir tem
 * a sua tela (vencido, usado, cancelado, trocado, pausado).
 *
 * Sem indexar e sem Referer: o código do link não pode vazar para buscador nem para outro site.
 */
export const metadata: Metadata = {
  title: "Convite para o Nós dois",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

/** Sem preferência salva no aparelho, segue o modo do celular (quem abre o link é gente nova). */
const MODO_DO_APARELHO = `try{var c=document.documentElement.classList;if(!c.contains("light")&&!c.contains("dark")){c.add(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}}catch(e){}`;

function diaMes(d: Date): string {
  // O prazo é um instante; o "vale até" é o dia em Brasília.
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export default async function ConviteDoParPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await params;
  const token = limparToken(bruto);
  const session = await auth();

  // Código com cara errada não vai ao banco, mas conta no limite da origem (um robô varrendo).
  const h = await headers();
  const chave = chaveDaOrigem(h.get("x-forwarded-for") ?? h.get("x-real-ip"));
  const cabe = tokenTemFormato(token) ? true : await tentativaNaPaginaDoConvite(chave);

  const dados = await lerConviteParaTela(token, session?.user?.id ?? null);
  if (dados.tela === "ja-esta-aqui") redirect("/mensal/foco");
  const tela = !cabe ? "limite" : dados.tela;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MODO_DO_APARELHO }} />
      {/* O convite abre no tema do Nós dois de quem convidou. */}
      <style dangerouslySetInnerHTML={{ __html: profileThemeCss(dados.tema) + coresDoCasalCss(dados.tema) }} />
      <TelaDoConvite
        tela={tela}
        token={token}
        nomeTitular={dados.nomeTitular}
        nomePar={dados.nomePar}
        valeAte={dados.expiraEm ? diaMes(new Date(dados.expiraEm.getTime() - 1)) : null}
        emailDoVisitante={dados.emailDoVisitante}
      />
    </>
  );
}
