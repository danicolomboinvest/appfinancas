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
  // Sem acentos: no Hubla o produto está "Do zero a liberdade financeira" e no painel a Dani
  // cadastrou "Do Zero à Liberdade Financeira" — têm que casar mesmo assim.
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * O que um produto da lista libera (05/10/2026): "app" é o acesso de sempre; "money_reset" é só o
 * programa de 21 dias, vendido no order bump. O Money Reset sozinho NÃO abre o app.
 */
export type Concede = "app" | "money_reset";
export const CONCESSOES: Concede[] = ["app", "money_reset"];

function casaCom(p: { hublaProductId: string | null; name: string }, product: HublaProduct): boolean {
  const nName = product.name ? normalizeProductName(product.name) : null;
  return (product.id != null && p.hublaProductId === product.id) || (nName != null && normalizeProductName(p.name) === nName);
}

/**
 * Cada produto da compra contra a lista ativa: o primeiro que libera o app, o primeiro que libera
 * o Money Reset e os que não estão ligados na lista. Uma compra com order bump traz os dois (o
 * SPI Finance e o Money Reset) e precisa liberar os dois.
 */
export async function oQueACompraLibera(products: HublaProduct[]): Promise<{ app: HublaProduct | null; moneyReset: HublaProduct | null; foraDaLista: HublaProduct[] }> {
  const ativos = await prisma.allowedProduct.findMany({ where: { active: true } });
  let app: HublaProduct | null = null;
  let moneyReset: HublaProduct | null = null;
  const foraDaLista: HublaProduct[] = [];
  for (const product of products) {
    const achado = ativos.find((p) => casaCom(p, product));
    if (!achado) foraDaLista.push(product);
    else if (achado.concede === "money_reset") moneyReset ??= product;
    else app ??= product;
  }
  return { app, moneyReset, foraDaLista };
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

export async function setAllowedProductConcede(id: string, concede: Concede) {
  return prisma.allowedProduct.update({ where: { id }, data: { concede } });
}

export async function removeAllowedProduct(id: string) {
  return prisma.allowedProduct.delete({ where: { id } });
}

/** Existe algum produto ativo que libera o app? Se não, o webhook não liberaria ninguém — o painel avisa a Dani. */
export async function hasActiveProduct(): Promise<boolean> {
  return (await prisma.allowedProduct.count({ where: { active: true, concede: "app" } })) > 0;
}
