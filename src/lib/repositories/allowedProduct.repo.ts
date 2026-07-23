import { prisma } from "@/lib/db/prisma";

/**
 * Produtos do Hubla que dão acesso ao app. O webhook consulta isto pra decidir se uma compra
 * libera ou não: só libera se o produto comprado estiver aqui e ativo. Assim "só alguns
 * produtos" (os cursos certos) liberam, e não qualquer coisa vendida no Hubla.
 *
 * O casamento é tolerante: por hublaProductId quando conhecido, senão pelo nome normalizado
 * (minúsculo, sem espaços nas pontas), pra a Dani poder cadastrar só pelo nome antes da 1ª venda.
 */

export type HublaProduct = { id: string | null; name: string | null };

export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}

/** A compra libera acesso? Confere id e nome contra a lista de produtos ativos. */
export async function isProductAllowed(product: HublaProduct): Promise<boolean> {
  const actives = await prisma.allowedProduct.findMany({ where: { active: true } });
  const nName = product.name ? normalizeProductName(product.name) : null;
  return actives.some(
    (p) =>
      (product.id != null && p.hublaProductId === product.id) ||
      (nName != null && normalizeProductName(p.name) === nName),
  );
}

/**
 * Registra um produto que o webhook viu numa compra mas que não está na lista, como INATIVO,
 * pra aparecer no painel e a Dani decidir se libera. Se já existe (por id ou nome), não duplica;
 * e aproveita pra preencher o hublaProductId de um produto que ela tinha cadastrado só pelo nome.
 */
export async function recordSeenProduct(product: HublaProduct): Promise<void> {
  if (!product.id && !product.name) return;
  const nName = product.name ? normalizeProductName(product.name) : null;

  const existing = await prisma.allowedProduct.findFirst({
    where: {
      OR: [
        ...(product.id ? [{ hublaProductId: product.id }] : []),
        ...(nName ? [{ name: { equals: product.name!, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  if (existing) {
    // Preenche o id do Hubla num produto que a Dani tinha adicionado só pelo nome.
    if (product.id && !existing.hublaProductId) {
      await prisma.allowedProduct.update({ where: { id: existing.id }, data: { hublaProductId: product.id } });
    }
    return;
  }

  await prisma.allowedProduct.create({
    data: {
      hublaProductId: product.id ?? null,
      name: product.name ?? product.id ?? "Produto sem nome",
      source: "HUBLA",
      active: false, // aparece desligado, a Dani liga se esse produto deve dar acesso
    },
  });
}

export async function listAllowedProducts() {
  return prisma.allowedProduct.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
}

/** Adiciona (ou reativa) um produto pelo nome — usado no painel, antes da 1ª venda. */
export async function addAllowedProductByName(name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const existing = await prisma.allowedProduct.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
  });
  if (existing) {
    await prisma.allowedProduct.update({ where: { id: existing.id }, data: { active: true } });
    return;
  }
  await prisma.allowedProduct.create({ data: { name: clean, source: "MANUAL", active: true } });
}

export async function setAllowedProductActive(id: string, active: boolean) {
  return prisma.allowedProduct.update({ where: { id }, data: { active } });
}

export async function removeAllowedProduct(id: string) {
  return prisma.allowedProduct.delete({ where: { id } });
}

/** Existe algum produto ativo? Se não, o webhook não liberaria nada — o painel avisa a Dani. */
export async function hasActiveProduct(): Promise<boolean> {
  return (await prisma.allowedProduct.count({ where: { active: true } })) > 0;
}
