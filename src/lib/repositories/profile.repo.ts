import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { DEFAULT_PROFILE_THEME, isProfileThemeKey } from "@/lib/profiles/themes";
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

/**
 * Os tipos que a tela oferece. São três, por decisão da Dani: mais que isso vira uma lista
 * que ninguém lê, e Casa/Projeto na prática eram "Outro" com outro nome.
 *
 * A lista de CIMA continua com os seis porque o banco ainda pode ter perfis dos outros tipos
 * (o enum do Postgres segue inteiro — derrubar valor de enum em produção é risco à toa). Quem
 * tiver um perfil "Casa" continua vendo "Casa" escrito nele; só não dá mais pra escolher.
 */
export const PROFILE_KINDS_ESCOLHIVEIS: ProfileKind[] = ["PESSOAL", "EMPRESA", "CASAL"];

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
  theme: string;
  position: number;
  isDefault: boolean;
  /** Preferências das categorias padrão (JSON cru; ler com lerPreferenciasDeCategoria). */
  categorias: Prisma.JsonValue | null;
  /** Perfil Casal: nomes, forma de divisão e meses acertados (ler com lerConfigCasal). */
  casal: Prisma.JsonValue;
};

const CAMPOS = { id: true, name: true, kind: true, icon: true, theme: true, position: true, isDefault: true, categorias: true, casal: true } as const;

export async function listProfiles(userId: string): Promise<ProfileRow[]> {
  return prisma.financialProfile.findMany({
    where: { userId },
    select: CAMPOS,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

/** O perfil com que toda conta nasce: criado junto com o usuário e, na falta dele, na hora. */
export const PERFIL_INICIAL = {
  name: "Pessoal",
  kind: "PESSOAL",
  icon: ICONE_PADRAO.PESSOAL,
  theme: DEFAULT_PROFILE_THEME,
  isDefault: true,
} as const;

/**
 * O perfil ativo da conta. Cria um na hora se a pessoa ainda não tiver nenhum.
 *
 * A criação preguiçosa aqui não é preciosismo: sem ela, uma conta nova (ou uma que escapou do
 * backfill) ficaria sem perfil e TODA consulta com escopo devolveria vazio — a pessoa veria o
 * app inteiro zerado sem nenhuma explicação.
 *
 * O layout e a página rodam em paralelo e os dois chamam isto na primeira entrada: sem trava,
 * cada um achava "nenhum perfil" e criava o seu, e a conta nascia com dois "Pessoal" ativos.
 * Por isso a parte que cria roda sob um lock do Postgres por conta, relendo depois de travar.
 * O `orderBy` deixa a resposta estável pra conta que já ficou com duas marcas: sempre o mais
 * antigo, em vez de um diferente a cada consulta.
 */
export async function getOrCreateActiveProfile(userId: string): Promise<ProfileRow> {
  const ativo = await prisma.financialProfile.findFirst({ where: { userId, isDefault: true }, select: CAMPOS, orderBy: { createdAt: "asc" } });
  if (ativo) return ativo;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`perfil-ativo|${userId}`}))`;
    // Quem esperou a trava encontra o perfil que a outra chamada acabou de criar.
    const criadoEnquantoEsperava = await tx.financialProfile.findFirst({ where: { userId, isDefault: true }, select: CAMPOS, orderBy: { createdAt: "asc" } });
    if (criadoEnquantoEsperava) return criadoEnquantoEsperava;

    const qualquer = await tx.financialProfile.findFirst({
      where: { userId },
      select: CAMPOS,
      orderBy: { createdAt: "asc" },
    });
    if (qualquer) {
      await tx.financialProfile.update({ where: { id: qualquer.id }, data: { isDefault: true } });
      return { ...qualquer, isDefault: true };
    }

    return tx.financialProfile.create({ data: { userId, ...PERFIL_INICIAL }, select: CAMPOS });
  });
}

export type NovoPerfil = { name: string; kind: ProfileKind; icon?: string; theme?: string };

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
      // Chave desconhecida cai no Padrão em vez de entrar crua no banco: o que chega aqui
      // veio de um formulário, e formulário é o lado de fora.
      theme: isProfileThemeKey(input.theme) ? input.theme : DEFAULT_PROFILE_THEME,
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
      ...(isProfileThemeKey(input.theme) ? { theme: input.theme } : {}),
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
