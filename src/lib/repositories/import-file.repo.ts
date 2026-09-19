import { prisma } from "@/lib/db/prisma";

/**
 * Guarda o arquivo de importação QUE DEU ERRADO, pra dar pra consertar o leitor sem depender de
 * pedir o arquivo pra pessoa.
 *
 * O motivo nº 1 de reembolso é "subi meu extrato e não veio nada". Até aqui, quando isso
 * acontecia sobrava só o cabeçalho no diagnóstico — e cabeçalho não diz onde ficam as colunas
 * de um banco que o app ainda não conhece. A saída era pedir o arquivo no WhatsApp, o que só
 * funciona com quem reclama; quem desiste calado (a maioria) some com o problema junto.
 *
 * Extrato bancário é dado pessoal sensível, então as regras aqui são estreitas de propósito:
 * - Só o que falhou ou veio pela metade. Importação bem sucedida NUNCA é guardada.
 * - Prazo de validade curto: a checagem diária apaga o que venceu.
 * - Arquivo grande demais não entra (e nem precisa: formato se descobre nos primeiros KB).
 * - Leitura só pelo ADMIN, por uma rota que exige sessão de admin.
 */

/** Quantos dias o arquivo fica guardado antes da checagem diária apagar. */
export const IMPORT_FILE_RETENTION_DAYS = 30;

/** Teto do que a gente guarda. Acima disso o arquivo é ignorado (o diagnóstico continua). */
export const IMPORT_FILE_MAX_BYTES = 6 * 1024 * 1024;

export type StoreImportFileInput = {
  userId: string;
  /** O diagnóstico que registrou esta falha, pra abrir os dois lado a lado depois. */
  diagnosticId?: string | null;
  /** O arquivo cru que veio no FormData. */
  file: unknown;
  /** text | xlsx | pdf */
  encoding?: string | null;
  /** "falha" = não leu nada; "parcial" = leu menos da metade das linhas com valor. */
  reason: "falha" | "parcial";
};

/**
 * Nunca derruba a importação: se guardar falhar, a pessoa não pode perder a tentativa dela por
 * causa de uma linha de suporte. Mesmo princípio do recordImportDiagnostic.
 */
export async function storeFailedImportFile(input: StoreImportFileInput): Promise<void> {
  try {
    const file = input.file;
    if (!(file instanceof Blob)) return;
    if (file.size === 0 || file.size > IMPORT_FILE_MAX_BYTES) return;

    const content = Buffer.from(await file.arrayBuffer());
    await prisma.importFile.create({
      data: {
        userId: input.userId,
        diagnosticId: input.diagnosticId ?? null,
        fileName: file instanceof File ? file.name.slice(0, 200) : null,
        encoding: input.encoding ?? null,
        mimeType: file.type || null,
        bytes: content.byteLength,
        content,
        reason: input.reason,
        expiresAt: new Date(Date.now() + IMPORT_FILE_RETENTION_DAYS * 86_400_000),
      },
    });
  } catch (err) {
    console.error("storeFailedImportFile falhou (ignorado)", err);
  }
}

/**
 * Apaga o que passou do prazo. Roda junto com a checagem diária: se a retenção dependesse de
 * alguém lembrar de limpar, extrato de cliente ficaria no banco pra sempre.
 */
export async function purgeExpiredImportFiles(): Promise<number> {
  try {
    const { count } = await prisma.importFile.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    return count;
  } catch (err) {
    console.error("purgeExpiredImportFiles falhou (ignorado)", err);
    return 0;
  }
}

export type StoredImportFile = {
  id: string;
  fileName: string | null;
  encoding: string | null;
  bytes: number;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  email: string;
  /** O que o diagnóstico daquela tentativa registrou, quando existe. */
  diagnostico: { target: string; ok: boolean; moneyLines: number; parsed: number; message: string | null; header: string | null } | null;
};

/** Lista pro painel do admin. NÃO traz o conteúdo: só o que precisa pra decidir qual abrir. */
export async function listStoredImportFiles(limit = 50): Promise<StoredImportFile[]> {
  const rows = await prisma.importFile.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      fileName: true,
      encoding: true,
      bytes: true,
      reason: true,
      createdAt: true,
      expiresAt: true,
      user: { select: { email: true } },
      diagnostic: { select: { target: true, ok: true, moneyLines: true, parsed: true, message: true, header: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    encoding: r.encoding,
    bytes: r.bytes,
    reason: r.reason,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    email: r.user.email,
    diagnostico: r.diagnostic,
  }));
}

/** O arquivo em si, pro download do admin. */
export async function readStoredImportFile(
  id: string,
): Promise<{ fileName: string; mimeType: string; content: Buffer } | null> {
  const row = await prisma.importFile.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, content: true },
  });
  if (!row) return null;
  return {
    fileName: row.fileName ?? `importacao-${id}`,
    mimeType: row.mimeType || "application/octet-stream",
    content: Buffer.from(row.content),
  };
}
