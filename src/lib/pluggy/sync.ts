import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { classify, type LearnedRule } from "@/lib/import/classify";
import { listTransactionRules } from "@/lib/repositories/transaction-rule.repo";
import { getItem, listAccounts, listTransactions, type PluggyTransaction } from "./client";

export type SyncResult = { created: number; skipped: number; uncategorized: number; accounts: number };

const FIRST_SYNC_DAYS = 90;
const OVERLAP_DAYS = 5;

/** Descrição como vai pro lançamento: parcela vira "(3/10)", que o app já sabe ler. */
function describe(t: PluggyTransaction): string {
  const base = (t.description ?? "").replace(/\s+/g, " ").trim() || "Lançamento";
  const m = t.creditCardMetadata;
  if (m?.installmentNumber && m.totalInstallments && m.totalInstallments > 1 && !/\d{1,2}\/\d{1,2}/.test(base)) {
    return `${base} ${String(m.installmentNumber).padStart(2, "0")}/${m.totalInstallments}`;
  }
  return base;
}

/**
 * Traz o que há de novo numa conexão: contas e cartões do item, transações desde a última
 * busca (com 5 dias de folga, porque o banco posta atrasado) e grava como lançamentos, num
 * lote de importação próprio ("openfinance") pra aparecer no histórico e poder ser desfeito.
 * Cada transação leva o id do banco: a segunda vez que aparecer, é ignorada.
 */
export async function syncConnection(ctx: AuthContext, connectionId: string): Promise<SyncResult> {
  const conn = await prisma.bankConnection.findFirst({ where: { id: connectionId, userId: ctx.userId } });
  if (!conn) throw new Error("conexão não encontrada");

  const item = await getItem(conn.itemId).catch(() => null);
  if (item) await prisma.bankConnection.update({ where: { id: conn.id }, data: { status: item.status, connectorName: item.connector?.name ?? conn.connectorName } });

  const accounts = await listAccounts(conn.itemId);
  const to = new Date();
  const from = new Date(conn.lastSyncAt ? conn.lastSyncAt.getTime() - OVERLAP_DAYS * 86_400_000 : to.getTime() - FIRST_SYNC_DAYS * 86_400_000);

  const rules = await listTransactionRules(ctx);
  const learned: LearnedRule[] = rules.map((r) => ({ pattern: r.pattern, parentCategory: r.parentCategory, subcategory: r.subcategory ?? undefined }));

  let created = 0;
  let skipped = 0;
  let uncategorized = 0;
  let batchId: string | null = null;

  for (const account of accounts) {
    const txns = await listTransactions(account.id, from, to);
    for (const t of txns) {
      if (t.status === "PENDING") continue;
      const externalId = `pluggy:${t.id}`;
      const exists = await prisma.monthlyEntry.findFirst({ where: { userId: ctx.userId, externalId }, select: { id: true } });
      if (exists) {
        skipped += 1;
        continue;
      }
      // Cartão: positivo = compra (gasto); negativo = pagamento da fatura ou estorno (não é gasto, fica de fora).
      // Conta: CREDIT = entrou (renda); DEBIT = saiu (gasto).
      let category: "INCOME" | "EXPENSE";
      let amount: number;
      if (account.type === "CREDIT") {
        if (t.amount <= 0) continue;
        category = "EXPENSE";
        amount = t.amount;
      } else {
        const isCredit = t.type ? t.type === "CREDIT" : t.amount > 0;
        category = isCredit ? "INCOME" : "EXPENSE";
        amount = Math.abs(t.amount);
      }
      if (amount <= 0) continue;
      const description = describe(t);
      const classification = category === "EXPENSE" ? classify(description, learned) : null;
      if (category === "EXPENSE" && !classification) uncategorized += 1;
      const date = new Date(`${t.date.slice(0, 10)}T12:00:00`);
      if (!batchId) {
        const batch = await prisma.importBatch.create({ data: { userId: ctx.userId, docType: "openfinance", fileName: `${conn.connectorName} · ${to.toLocaleDateString("pt-BR")}` } });
        batchId = batch.id;
      }
      await prisma.monthlyEntry.create({
        data: {
          userId: ctx.userId,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          category,
          parentCategory: classification?.parentCategory ?? null,
          subcategory: classification?.subcategory ?? (account.type === "CREDIT" ? "Cartão" : null),
          description,
          amount,
          entryDate: date,
          externalId,
          importBatchId: batchId,
        },
      });
      created += 1;
    }
  }

  await prisma.bankConnection.update({ where: { id: conn.id }, data: { lastSyncAt: to, lastSyncCount: created, lastError: null } });
  return { created, skipped, uncategorized, accounts: accounts.length };
}
