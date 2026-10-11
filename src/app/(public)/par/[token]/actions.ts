"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/lib/auth/auth.config";
import { loginSchema, registerSchema } from "@/lib/validations/auth.schema";
import { findUserByEmail } from "@/lib/repositories/user.repo";
import { aceitarConvite, tentativaNaPaginaDoConvite } from "@/lib/repositories/casal-login.repo";
import { chaveDaOrigem } from "@/lib/casal-login/limite";
import { limparToken } from "@/lib/casal-login/token";
import { TERMOS_DO_PAR_VERSAO, type TelaDoConvite } from "@/lib/casal-login/regras";
import { CASA_DO_PAR } from "@/lib/casal-login/rotas-do-par";

/**
 * As três portas do link do convite: criar o login (e-mail e senha), entrar com a conta que já
 * tem, ou aceitar com a conta que já está logada. Apple e Google entram depois como mais portas
 * que terminam no mesmo `aceitarConvite` (ver PROVEDORES_DO_PAR em TelaDoConvite).
 *
 * Todas passam pelo limite por origem antes de tocar no banco, e nenhuma devolve a senha.
 */

export type EstadoDoFormulario = { erro?: string; tela?: TelaDoConvite | "email-em-uso" | "limite"; valores?: { nome?: string; email?: string } };

const DESTINO = `${CASA_DO_PAR}?entrou=1`;

async function cabe(): Promise<boolean> {
  const h = await headers();
  return tentativaNaPaginaDoConvite(chaveDaOrigem(h.get("x-forwarded-for") ?? h.get("x-real-ip")));
}

function texto(f: FormData, campo: string): string {
  const v = f.get(campo);
  return typeof v === "string" ? v : "";
}

const MSG_TERMOS = "Para entrar, aceite os termos do Nós dois.";

export async function criarLoginEEntrarAction(_: EstadoDoFormulario, f: FormData): Promise<EstadoDoFormulario> {
  const token = limparToken(f.get("token"));
  const valores = { nome: texto(f, "nome"), email: texto(f, "email") };
  if (!(await cabe())) return { tela: "limite", valores };
  if (f.get("termos") !== "on") return { erro: MSG_TERMOS, valores };
  const p = registerSchema.safeParse({ name: f.get("nome"), email: f.get("email"), password: f.get("senha") });
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Confira os campos.", valores };

  const r = await aceitarConvite({ token, termosVersao: TERMOS_DO_PAR_VERSAO, novaConta: { nome: p.data.name, email: p.data.email, senha: p.data.password } });
  if (!r.ok) {
    if (r.tela === "email-em-uso") return { erro: "Este e-mail já tem conta no SPI. Toque em \"Já tenho conta no SPI\" e entre com ela.", tela: "email-em-uso", valores };
    return { tela: r.tela, valores };
  }
  try {
    await signIn("credentials", { email: p.data.email, password: p.data.password, redirectTo: DESTINO });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e; // o redirect do signIn chega aqui e precisa subir
  }
  redirect(`/login?callbackUrl=${encodeURIComponent(DESTINO)}`);
}

export async function entrarEAceitarAction(_: EstadoDoFormulario, f: FormData): Promise<EstadoDoFormulario> {
  const token = limparToken(f.get("token"));
  const valores = { email: texto(f, "email") };
  if (!(await cabe())) return { tela: "limite", valores };
  if (f.get("termos") !== "on") return { erro: MSG_TERMOS, valores };
  const p = loginSchema.safeParse({ email: f.get("email"), password: f.get("senha") });
  if (!p.success) return { erro: p.error.issues[0]?.message ?? "Confira os campos.", valores };

  const user = await findUserByEmail(p.data.email);
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return { erro: `Muitas tentativas de senha. Espere ${min} minuto${min === 1 ? "" : "s"} e tente de novo.`, valores };
  }
  try {
    // Sem redirecionar ainda: primeiro a senha, depois o convite. Errou a senha, o convite fica intacto.
    await signIn("credentials", { email: p.data.email, password: p.data.password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { erro: "E-mail ou senha incorretos.", valores };
    throw e;
  }
  if (!user) return { erro: "E-mail ou senha incorretos.", valores };
  const r = await aceitarConvite({ token, termosVersao: TERMOS_DO_PAR_VERSAO, userId: user.id });
  if (!r.ok) return { tela: r.tela === "email-em-uso" ? "invalido" : r.tela, valores };
  redirect(DESTINO);
}

export async function aceitarLogadoAction(_: EstadoDoFormulario, f: FormData): Promise<EstadoDoFormulario> {
  const token = limparToken(f.get("token"));
  if (!(await cabe())) return { tela: "limite" };
  if (f.get("termos") !== "on") return { erro: MSG_TERMOS };
  const session = await auth();
  if (!session?.user?.id) return { tela: "entrar" };
  const r = await aceitarConvite({ token, termosVersao: TERMOS_DO_PAR_VERSAO, userId: session.user.id });
  if (!r.ok) return { tela: r.tela === "email-em-uso" ? "invalido" : r.tela };
  redirect(DESTINO);
}

/** "Usar outra conta": sai desta e volta para o mesmo link, já sem login. */
export async function usarOutraContaAction(f: FormData): Promise<void> {
  const token = limparToken(f.get("token"));
  await signOut({ redirectTo: `/par/${encodeURIComponent(token)}` });
}
