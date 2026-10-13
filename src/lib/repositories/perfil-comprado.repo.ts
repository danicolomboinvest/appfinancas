import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { createProfile, SEM_CASAL_MIGRADO } from "@/lib/repositories/profile.repo";
import { ADICIONAIS, adicionalDoProdutoApple, IDS_APPLE_ADICIONAIS, type Adicional } from "@/lib/adicionais/config";
import { podeCriar } from "@/lib/perfis/lugares";
import { CHAVES_DO_PERFIL_COMPRADO as CHAVE, NOME_DA_EMPRESA_COMPRADA, PREFIXO_DO_PERFIL_COMPRADO, type AvisoDoPerfilComprado } from "@/lib/perfis/perfil-comprado";

/**
 * O perfil comprado aparece sozinho (13/10/2026). Antes, quem comprava o perfil Empresa só ganhava
 * a liberação (ProdutoLiberado) e precisava achar Configurações › Perfis › Novo perfil › "Criar
 * Empresa". Uma cliente comprou e escreveu "não aparece nada nesse segundo".
 *
 * Agora, quem comprou e ainda não tem perfil Empresa ganha um, com o nome que a tela usa
 * ("Empresa"), sem trocar o perfil em uso. Acontece ao entrar no app (layout) e no webhook da
 * compra quando a conta já existe; quem comprou antes desta mudança ganha na próxima entrada.
 *
 * As marcas moram em NotificationLog (único por conta + chave), sem migration:
 * - "perfil-comprado:empresa": a compra já foi tratada. Gravada ANTES de criar, na mesma
 *   transação: a segunda aba que chega junto bate no índice único e não cria outro. Também é o que
 *   impede de recriar a Empresa que ela apagou de propósito.
 * - "perfil-comprado:empresa:aviso": a Empresa foi criada por aqui, o "Sua Empresa está pronta" fica
 *   pendente. "…:visto" fecha ele (Abrir ou Depois).
 * - "perfil-comprado:casal:visto": o aviso do Casal já foi visto.
 *
 * Reembolso não apaga nada: a Empresa fica, e a trava de sempre (perfis/actions.ts, exigirAdicional)
 * manda para a compra quem tenta abrir sem o adicional.
 */

/** O que ela pagou de verdade (Hubla, liberação da Dani ou Apple), sem a regra do "antes do
 * lançamento todo mundo tem": essa regra liberaria, não compraria, e criaria Empresa para todos. */
export async function comprasDosAdicionais(userId: string, email: string, agora: Date = new Date()): Promise<Record<Adicional, boolean>> {
  const produtos = Object.keys(ADICIONAIS) as Adicional[];
  const [liberados, apple] = await Promise.all([
    prisma.produtoLiberado.findMany({ where: { email: normalizeEmail(email), produto: { in: produtos }, ativo: true }, select: { produto: true } }),
    prisma.assinaturaApple.findMany({ where: { userId, productId: { in: [...IDS_APPLE_ADICIONAIS] }, revogadaEm: null, expiresAt: { gt: agora } }, select: { productId: true } }),
  ]);
  const tem = new Set<string>(liberados.map((l) => l.produto));
  for (const a of apple) {
    const qual = adicionalDoProdutoApple(a.productId);
    if (qual) tem.add(qual);
  }
  return { perfil_empresa: tem.has("perfil_empresa"), conta_parceiro: tem.has("conta_parceiro") };
}

export type ResultadoDaEmpresa = "criada" | "ja-tinha" | "ja-tratada" | "sem-perfil";

class SemPerfil extends Error {}

function chaveRepetida(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/**
 * Cria a Empresa comprada uma vez só. Quem chama já conferiu a compra. Não troca o perfil em uso:
 * o perfil nasce com isDefault falso.
 *
 * Conta sem nenhum outro perfil (acabou de ser criada, ainda sem o Pessoal) fica para depois: a
 * Empresa viraria o perfil que abre o app. Desfaz a marca, para tentar de novo na próxima entrada.
 */
export async function criarEmpresaCompradaUmaVez(userId: string): Promise<ResultadoDaEmpresa> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.notificationLog.create({ data: { userId, key: CHAVE.empresa } });
      const perfis = await tx.financialProfile.findMany({ where: { userId, ...SEM_CASAL_MIGRADO }, select: { id: true, name: true, kind: true, isDefault: true } });
      if (perfis.some((p) => p.kind === "EMPRESA")) return "ja-tinha" as const;
      if (perfis.length === 0) throw new SemPerfil();
      // Até 3 perfis, um de cada: com a compra, o lugar da Empresa está liberado.
      if (!podeCriar("EMPRESA", perfis, { casal: false, empresa: true })) return "ja-tinha" as const;
      await createProfile(userId, { name: NOME_DA_EMPRESA_COMPRADA, kind: "EMPRESA" }, tx);
      await tx.notificationLog.create({ data: { userId, key: CHAVE.avisoEmpresa } });
      return "criada" as const;
    });
  } catch (e) {
    // Outra aba (ou o webhook) gravou a marca primeiro: ela é que cria.
    if (chaveRepetida(e)) return "ja-tratada";
    if (e instanceof SemPerfil) return "sem-perfil";
    throw e;
  }
}

async function marcas(userId: string): Promise<Set<string>> {
  const linhas = await prisma.notificationLog.findMany({ where: { userId, key: { startsWith: PREFIXO_DO_PERFIL_COMPRADO } }, select: { key: true } });
  return new Set(linhas.map((l) => l.key));
}

/** Pelo webhook da compra: a conta já existe, então a Empresa já fica lá quando ela abrir o app. */
export async function garantirEmpresaComprada(userId: string, agora: Date = new Date()): Promise<ResultadoDaEmpresa | "sem-compra"> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return "sem-compra";
  const compras = await comprasDosAdicionais(userId, user.email, agora);
  if (!compras.perfil_empresa) return "sem-compra";
  if ((await marcas(userId)).has(CHAVE.empresa)) return "ja-tratada";
  return criarEmpresaCompradaUmaVez(userId);
}

/**
 * Ao entrar no app (uma vez por carregamento do layout): cria a Empresa comprada que falta e diz
 * qual aviso mostrar. Para quem não comprou nenhum adicional, são duas consultas pequenas.
 *
 * Casal (Nós dois): NÃO cria perfil. No Casal simples (13/10/2026) cada um fica no próprio Pessoal;
 * o perfil Casal é só onde o convite nasce. Quem comprou e ainda não tem casa nem par vê uma vez o
 * aviso que leva ao convite (convidarParCompradoAction, que só então prepara o Casal).
 */
export async function perfilCompradoNaEntrada(
  userId: string,
  email: string,
  { naCasa, agora = new Date() }: { naCasa: boolean; agora?: Date },
): Promise<{ aviso: AvisoDoPerfilComprado | null; criouEmpresa: boolean }> {
  const compras = await comprasDosAdicionais(userId, email, agora);
  if (!compras.perfil_empresa && !compras.conta_parceiro) return { aviso: null, criouEmpresa: false };
  let feitas = await marcas(userId);
  let criouEmpresa = false;
  if (compras.perfil_empresa && !feitas.has(CHAVE.empresa)) {
    criouEmpresa = (await criarEmpresaCompradaUmaVez(userId)) === "criada";
    feitas = await marcas(userId);
  }

  if (compras.perfil_empresa && feitas.has(CHAVE.avisoEmpresa) && !feitas.has(CHAVE.vistoEmpresa)) {
    const empresa = await prisma.financialProfile.findFirst({ where: { userId, kind: "EMPRESA" }, select: { id: true, isDefault: true }, orderBy: { createdAt: "asc" } });
    // Já está nela (abriu por outro caminho): o aviso não tem mais o que mostrar.
    if (empresa && !empresa.isDefault) return { aviso: { tipo: "empresa", perfilId: empresa.id }, criouEmpresa };
  }

  if (compras.conta_parceiro && !naCasa && !feitas.has(CHAVE.vistoCasal)) {
    // Já tem par (como titular ou como par de alguém): o convite já foi.
    const comPar = await prisma.membroCasal.count({ where: { saiuEm: null, OR: [{ userId }, { profile: { userId } }] } });
    if (comPar === 0) return { aviso: { tipo: "casal" }, criouEmpresa };
  }
  return { aviso: null, criouEmpresa };
}

export async function marcarAvisoDoPerfilCompradoVisto(userId: string, tipo: AvisoDoPerfilComprado["tipo"]): Promise<void> {
  await prisma.notificationLog.createMany({ data: [{ userId, key: tipo === "empresa" ? CHAVE.vistoEmpresa : CHAVE.vistoCasal }], skipDuplicates: true });
}

/**
 * "Convidar meu par": o convite nasce no perfil Casal (ver criarConvite). Usa o que ela já tem ou
 * cria um, com o nome da tela ("Nós dois"). A trava evita dois Casais com dois toques.
 */
export async function casalParaOConvite(userId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`perfil-comprado-casal|${userId}`}))`;
    const perfis = await tx.financialProfile.findMany({ where: { userId, ...SEM_CASAL_MIGRADO }, select: { id: true, name: true, kind: true, isDefault: true } });
    const casal = perfis.find((p) => p.kind === "CASAL");
    if (casal) return casal.id;
    if (perfis.length === 0 || !podeCriar("CASAL", perfis, { casal: true, empresa: false })) return null;
    return (await createProfile(userId, { name: "Nós dois", kind: "CASAL" }, tx)).id;
  });
}
