import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { DEFAULT_PROFILE_COLOR, isProfileColorKey } from "@/lib/profiles/palette";
import type { ProfileKind } from "@prisma/client";

/**
 * Perfis financeiros: criar, renomear, trocar de cor, reordenar, excluir e — o principal —
 * dizer qual está ativo.
 *
 * O perfil ativo é o `isDefault`, e não um cookie ou um campo de sessão. Assim a pessoa abre o
 * app no perfil em que estava, em qualquer aparelho, sem nada pra sincronizar. Trocar de perfil
 * é mover essa marca, sempre numa transação: dois perfis marcados ao mesmo tempo fariam a conta
 * abrir num perfil imprevisível.
 */

export const PROFILE_KINDS: ProfileKind[] = ["PESSOAL", "EMPRESA", "CASAL", "CASA", "PROJETO", "OUTRO"];

export const PROFILE_KIND_LABEL: Record<ProfileKind, string> = {
  PESSOAL: "Pessoal",
  EMPRESA: "Empresa / PJ",
  CASAL: "Casal",
  CASA: "Casa",
  PROJETO: "Projeto",
  OUTRO: "Outro",
};

/** Ícone sugerido por tipo (lucide). A pessoa troca depois; isto é só um ponto de partida. */
const ICONE_PADRAO: Record<ProfileKind, string> = {
  PESSOAL: "wallet",
  EMPRESA: "briefcase",
  CASAL: "heart",
  CASA: "home",
  PROJETO: "target",
  OUTRO: "circle",
};

export type ProfileRow = {
  id: string;
  name: string;
  kind: ProfileKind;
  icon: string;
  color: string;
  position: number;
  isDefault: boolean;
};

const CAMPOS = { id: true, name: true, kind: true, icon: true, color: true, position: true, isDefault: true } as const;

export async function listProfiles(userId: string): Promise<ProfileRow[]> {
  return prisma.financialProfile.findMany({
    where: { userId },
    select: CAMPOS,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * O perfil ativo da conta. Cria um na hora se a pessoa ainda não tiver nenhum.
 *
 * A criação preguiçosa aqui não é preciosismo: sem ela, uma conta nova (ou uma que escapou do
 * backfill) ficaria sem perfil e TODA consulta com escopo devolveria vazio — a pessoa veria o
 * app inteiro zerado sem nenhuma explicação.
 */
export async function getOrCreateActiveProfile(userId: string): Promise<ProfileRow> {
  const ativo = await prisma.financialProfile.findFirst({ where: { userId, isDefault: true }, select: CAMPOS });
  if (ativo) return ativo;

  const qualquer = await prisma.financialProfile.findFirst({
    where: { userId },
    select: CAMPOS,
    orderBy: { createdAt: "asc" },
  });
  if (qualquer) {
    await prisma.financialProfile.update({ where: { id: qualquer.id }, data: { isDefault: true } });
    return { ...qualquer, isDefault: true };
  }

  return prisma.financialProfile.create({
    data: { userId, name: "Pessoal", kind: "PESSOAL", icon: ICONE_PADRAO.PESSOAL, color: DEFAULT_PROFILE_COLOR, isDefault: true },
    select: CAMPOS,
  });
}

export type NovoPerfil = { name: string; kind: ProfileKind; icon?: string; color?: string };

export async function createProfile(userId: string, input: NovoPerfil): Promise<ProfileRow> {
  const nome = input.name.trim().slice(0, 40);
  if (!nome) throw new Error("O perfil precisa de um nome.");
  const ultimo = await prisma.financialProfile.findFirst({
    where: { userId },
    select: { position: true },
    orderBy: { position: "desc" },
  });
  return prisma.financialProfile.create({
    data: {
      userId,
      name: nome,
      kind: input.kind,
      icon: input.icon?.trim() || ICONE_PADRAO[input.kind],
      color: isProfileColorKey(input.color) ? input.color : DEFAULT_PROFILE_COLOR,
      position: (ultimo?.position ?? -1) + 1,
    },
    select: CAMPOS,
  });
}

export async function updateProfile(ctx: AuthContext, id: string, input: Partial<NovoPerfil>): Promise<void> {
  // O `userId` no where é o que impede alguém de editar o perfil de outra conta mandando um id.
  const dono = await prisma.financialProfile.findFirst({ where: { id, userId: ctx.userId }, select: { id: true } });
  if (!dono) throw new Error("Perfil não encontrado.");
  await prisma.financialProfile.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 40) || "Sem nome" } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.icon !== undefined ? { icon: input.icon.trim() || "wallet" } : {}),
      ...(isProfileColorKey(input.color) ? { color: input.color } : {}),
    },
  });
}

/** Troca o perfil ativo. Numa transação, porque duas marcas simultâneas deixariam a conta instável. */
export async function switchProfile(ctx: AuthContext, id: string): Promise<void> {
  const alvo = await prisma.financialProfile.findFirst({ where: { id, userId: ctx.userId }, select: { id: true } });
  if (!alvo) throw new Error("Perfil não encontrado.");
  await prisma.$transaction([
    prisma.financialProfile.updateMany({ where: { userId: ctx.userId, isDefault: true }, data: { isDefault: false } }),
    prisma.financialProfile.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

/**
 * Exclui o perfil E tudo que vive dentro dele (o banco cascateia).
 *
 * Duas travas: não dá pra apagar o último perfil, senão a conta fica sem lugar pra guardar
 * dinheiro nenhum; e se o excluído era o ativo, outro assume na hora, porque uma conta sem
 * perfil ativo abre vazia.
 */
export async function deleteProfile(ctx: AuthContext, id: string): Promise<void> {
  const perfis = await prisma.financialProfile.findMany({ where: { userId: ctx.userId }, select: { id: true, isDefault: true } });
  if (!perfis.some((p) => p.id === id)) throw new Error("Perfil não encontrado.");
  if (perfis.length <= 1) throw new Error("Este é o seu único perfil. Crie outro antes de excluir este.");

  const eraOAtivo = perfis.find((p) => p.id === id)?.isDefault ?? false;
  await prisma.financialProfile.delete({ where: { id } });
  if (eraOAtivo) {
    const proximo = perfis.find((p) => p.id !== id)!;
    await prisma.financialProfile.update({ where: { id: proximo.id }, data: { isDefault: true } });
  }
}

export async function reorderProfiles(ctx: AuthContext, idsNaOrdem: string[]): Promise<void> {
  const meus = new Set((await prisma.financialProfile.findMany({ where: { userId: ctx.userId }, select: { id: true } })).map((p) => p.id));
  const validos = idsNaOrdem.filter((id) => meus.has(id));
  await prisma.$transaction(
    validos.map((id, i) => prisma.financialProfile.update({ where: { id }, data: { position: i } })),
  );
}
