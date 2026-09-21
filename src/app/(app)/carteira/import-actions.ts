"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { AssetClass, FixedIncomeIndex } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAsset } from "@/lib/repositories/asset.repo";
import { refreshDividendsForTickers } from "@/lib/repositories/dividend.repo";
import { parsePortfolioStatement, guessAssetClass } from "@/lib/import/portfolio-parser";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";
import { profileDocument } from "@/lib/import/profile";
import { isPartialRead, recordImportDiagnostic, safeHeader } from "@/lib/repositories/import-diagnostic.repo";
import { storeFailedImportFile } from "@/lib/repositories/import-file.repo";
import { NUMBERS_ONLY_MESSAGE, pdfTextQuality } from "@/lib/import/pdf-quality";

/** Record (não array solto) por classe existente: se um valor novo entrar no enum AssetClass
 * sem passar por aqui, o TypeScript acusa na hora — evita repetir o bug de uma classe nova
 * (ex.: INTERNACIONAL) cair batida pro "OUTRO" nesse guard sem ninguém perceber. */
const ASSET_CLASS_GUARD: Record<AssetClass, true> = {
  RENDA_FIXA: true,
  ACAO: true,
  FII: true,
  TESOURO_DIRETO: true,
  FUNDO: true,
  CRIPTO: true,
  INTERNACIONAL: true,
  OUTRO: true,
};
const ASSET_CLASS_VALUES = Object.keys(ASSET_CLASS_GUARD) as AssetClass[];

/** Situação de cada ativo do extrato em relação à carteira atual:
 * novo (não existe), atualizado (quantidade/valor mudou) ou igual (nada a fazer). */
export type HoldingStatus = "new" | "changed" | "unchanged";

export type ParsedHoldingItem = {
  key: number;
  ticker: string;
  quantity: number;
  value: number;
  /** Quanto foi investido (do extrato, quando informado), base do lucro/prejuízo. */
  investedValue: number | null;
  assetClass: AssetClass;
  /** Indexador da renda fixa detectado no extrato (pós/IPCA/prefixado), ou null. */
  fixedIncomeIndex: FixedIncomeIndex | null;
  status: HoldingStatus;
  /** Valores atuais na carteira (para mostrar o "antes → depois" na revisão). */
  prevQuantity: number | null;
  prevValue: number | null;
};

export type ParsePortfolioResult =
  | { ok: true; holdings: ParsedHoldingItem[]; summary: string }
  | { ok: false; error: string; needsPassword?: boolean };

/** Lê o extrato/nota da corretora ou relatório da B3 (CSV/Excel/PDF), identifica os ativos e
 * COMPARA com a carteira atual, quem reimporta o extrato vê só o que mudou.
 * O arquivo vem CRU num FormData ({ file, encoding }), string grande como argumento de
 * action estoura o limite de serialização do React (~1M chars). */
export async function parsePortfolioAction(formData: FormData): Promise<ParsePortfolioResult> {
  const ctx = await getRequiredSession();
  const encoding = String(formData.get("encoding") ?? "text");

  const uploaded = formData.get("file");
  const uploadedName = uploaded instanceof File ? uploaded.name : null;
  /** Toda saída em erro deixa rastro: é o que alimenta a checagem diária. */
  const falha = async (message: string, extra: Partial<Parameters<typeof recordImportDiagnostic>[0]> = {}) => {
    const diagnosticId = await recordImportDiagnostic({
      userId: ctx.userId,
      target: "carteira",
      stage: "parse",
      ok: false,
      fileName: uploadedName,
      encoding,
      message,
      ...extra,
    });
    // Guarda o arquivo que não deu certo, pra dar pra ensinar o formato ao app sem precisar
    // pedir de volta pra pessoa (quem desiste calado nunca responde).
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "falha" });
  };

  let text: string;
  try {
    ({ text } = await extractUploadFromForm(formData));
  } catch (err) {
    if (err instanceof PasswordRequiredError) return { ok: false, error: err.message, needsPassword: true };
    if (err instanceof UploadReadError) {
      // A pessoa vê a frase limpa; o diagnóstico guarda também a causa técnica.
      await falha(err.detail ? `${err.message} [${err.detail}]` : err.message);
      return { ok: false, error: err.message };
    }
    // Biblioteca de PDF/Excel engasgou num arquivo fora do padrão. Antes estourava e a pessoa
    // via só "Application error"; agora fica registrado no log com o que importa pra reproduzir.
    const file = formData.get("file");
    console.error("parsePortfolioAction: leitura falhou", {
      name: file instanceof File ? file.name : "?",
      size: file instanceof Blob ? file.size : 0,
      encoding,
      err,
    });
    const msg = "Não consegui abrir esse arquivo. Tente exportar de novo em Excel (.xlsx) ou CSV.";
    await falha(`${msg} [${err instanceof Error ? err.message.slice(0, 120) : "erro desconhecido"}]`);
    return { ok: false, error: msg };
  }

  // Lê o arquivo INTEIRO e monta o perfil (banco, período, o que tem dentro) antes de decidir.
  // Extrato de conta no lugar da posição é o engano mais comum; a resposta diz o que foi
  // entendido e pra onde ir, em vez de "não identifiquei ativos".
  const fileMeta = formData.get("file");
  const fileName = fileMeta instanceof File ? fileMeta.name : null;
  const profile = profileDocument(text, fileName);
  if (profile.kind === "irpf") {
    const msg = `Li o arquivo inteiro: ${profile.summary}. A declaração serve pra pegar o preço médio: use o botão "Preço médio (IR)" na carteira.`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, header: safeHeader(text) });
    return { ok: false, error: msg };
  }
  if ((profile.kind === "statement" || profile.kind === "invoice") && !profile.contents.includes("position")) {
    const msg = `Li o arquivo inteiro: ${profile.summary}. Ele traz entradas e saídas, não a posição dos investimentos. Pra lançar no mês, use Registrar › Importar extrato. Pra carteira, suba a posição da corretora ou o relatório da B3 (Área do Investidor › Posição).`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, header: safeHeader(text) });
    return { ok: false, error: msg };
  }

  // PDF escaneado/foto não tem texto extraível; PDF "impresso" pelo celular tem só os números.
  // Nos dois casos a resposta certa é pedir o Excel, e dizer POR QUÊ.
  const quality = encoding === "pdf" ? pdfTextQuality(text) : "ok";
  if (quality === "empty") {
    return {
      ok: false,
      error:
        "Não consegui ler este PDF, ele parece ser escaneado ou uma foto. Suba a posição em Excel (.xlsx) ou CSV que aí funciona.",
    };
  }
  if (quality === "numbers-only") return { ok: false, error: NUMBERS_ONLY_MESSAGE };

  const parsed = parsePortfolioStatement(text);
  if (parsed.length === 0) {
    // Diagnóstico pro suporte: perfil + cabeçalho (sem valores), pra reconhecer o formato.
    const header = text.split(/\r?\n/).find((l) => l.trim())?.slice(0, 200) ?? "";
    console.error("parsePortfolioAction: zero ativos", { fileName, encoding, kind: profile.kind, contents: profile.contents, positionRows: profile.positionRows, chars: text.length, header });
    const msg =
      profile.kind === "position"
        ? `Li o arquivo inteiro (${profile.summary}) e reconheci ${profile.positionRows} linha${profile.positionRows === 1 ? "" : "s"} de ativo, mas não consegui ler as quantidades e valores nesse formato. Manda o arquivo pro suporte que a gente ensina o app.`
        : `Li o arquivo inteiro (${profile.summary}) e não identifiquei ativos com quantidade e valor. Se for um PDF escaneado/foto, suba a posição em Excel (.xlsx) ou CSV, costuma ler melhor.`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, moneyLines: profile.positionRows, header: safeHeader(text) });
    return { ok: false, error: msg };
  }

  // Carteira atual indexada por ticker E por nome, imports antigos usam o ticker como nome.
  const existing = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    select: { name: true, ticker: true, quantity: true, currentValue: true },
  });
  const byKey = new Map<string, (typeof existing)[number]>();
  for (const a of existing) {
    if (a.ticker) byKey.set(a.ticker.toUpperCase(), a);
    byKey.set(a.name.toUpperCase(), a);
  }

  const holdings: ParsedHoldingItem[] = parsed.map((h, index) => {
    const match = byKey.get(h.ticker.toUpperCase());
    let status: HoldingStatus = "new";
    let prevQuantity: number | null = null;
    let prevValue: number | null = null;
    if (match) {
      prevQuantity = match.quantity !== null ? Number(match.quantity) : null;
      prevValue = Number(match.currentValue);
      // Mudança de verdade: quantidade diferente (compra/venda) ou valor >1% distante
      // (rendimento acumulado). Oscilação diária de preço não vira ruído na revisão.
      const qtyChanged = h.quantity > 0 && prevQuantity !== null && Math.abs(h.quantity - prevQuantity) > 1e-6;
      const valueChanged =
        h.value > 0 && (prevValue > 0 ? Math.abs(h.value - prevValue) / prevValue > 0.01 : true);
      status = qtyChanged || valueChanged ? "changed" : "unchanged";
    }
    return {
      key: index,
      ticker: h.ticker,
      quantity: h.quantity,
      value: h.value,
      investedValue: h.investedValue ?? null,
      // Extratos em seções (BTG etc.) já dizem a classe (Renda Fixa, Tesouro, Fundo, FII);
      // senão, inferimos pela terminação do ticker.
      assetClass: h.assetClass ?? guessAssetClass(h.ticker),
      fixedIncomeIndex: h.fixedIncomeIndex ?? null,
      status,
      prevQuantity,
      prevValue,
    };
  });
  const diagnosticId = await recordImportDiagnostic({
    userId: ctx.userId,
    target: "carteira",
    stage: "parse",
    ok: true,
    fileName: uploadedName,
    encoding,
    kind: profile.kind,
    institution: profile.institution,
    moneyLines: profile.positionRows,
    parsed: parsed.length,
    header: safeHeader(text),
  });
  // Leu bem menos ativos do que o arquivo mostrava: guarda pra conferir o que ficou de fora.
  if (isPartialRead(profile.positionRows, parsed.length)) {
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "parcial" });
  }
  return { ok: true, holdings, summary: profile.summary };
}

export type ConfirmedHolding = {
  ticker: string;
  quantity: number;
  value: number;
  investedValue: number | null;
  assetClass: AssetClass;
  fixedIncomeIndex: FixedIncomeIndex | null;
  /** create = ativo novo; update = já existe, atualiza quantidade/valores. */
  mode: "create" | "update";
};

export type ImportPortfolioResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; error: string };

/** Aplica o extrato na carteira: cria os novos e atualiza os que mudaram (quantidade, valor
 * atual e, quando o extrato traz preço médio, o valor investido). Ativos sem mudança nem
 * chegam aqui. Objetivo padrão OUTRO nos novos; o usuário refina depois. */
export async function importPortfolioAction(holdings: ConfirmedHolding[]): Promise<ImportPortfolioResult> {
  const ctx = await getRequiredSession();
  let created = 0;
  let updated = 0;

  // Proteção contra duplicar em cliques repetidos/reenvio: create de quem já existe vira skip.
  const existing = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    select: { id: true, name: true, ticker: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const existingKeys = new Set(existing.flatMap((a) => [a.ticker?.toUpperCase(), a.name.toUpperCase()].filter(Boolean)));
  // Do código pro ID de UM ativo. O mesmo papel pode estar em duas linhas (objetivos
  // diferentes, ex.: PETR4 na meta da casa e PETR4 na liberdade financeira); o updateMany
  // gravava a posição inteira do extrato NAS DUAS e dobrava a carteira. Atualiza a mais antiga.
  const idByKey = new Map<string, string>();
  for (const a of existing) {
    for (const k of [a.ticker?.toUpperCase(), a.name.toUpperCase()]) {
      if (k && !idByKey.has(k)) idByKey.set(k, a.id);
    }
  }

  for (const h of holdings) {
    const key = h.ticker.toUpperCase();
    if (h.mode === "update" || existingKeys.has(key)) {
      const targetId = idByKey.get(key);
      if (!targetId) continue;
      const result = await prisma.asset.updateMany({
        // updateMany com o id + userId: uma linha só, e ainda com a trava de dono.
        where: { id: targetId, userId: ctx.userId, profileId: ctx.profileId },
        data: {
          ...(h.quantity > 0 ? { quantity: h.quantity } : {}),
          ...(h.value >= 0 ? { currentValue: h.value } : {}),
          // Preço médio do extrato mantém o investido fiel após novos aportes; sem ele, não mexe.
          ...(h.investedValue !== null ? { investedValue: h.investedValue } : {}),
          ...(h.fixedIncomeIndex !== null ? { fixedIncomeIndex: h.fixedIncomeIndex } : {}),
        },
      });
      if (result.count > 0) updated += 1;
      continue;
    }

    existingKeys.add(key); // evita duplicata dentro do próprio arquivo
    const assetClass = ASSET_CLASS_VALUES.includes(h.assetClass) ? h.assetClass : "OUTRO";
    await createAsset(ctx, {
      name: h.ticker,
      ticker: h.ticker,
      assetClass,
      objective: "OUTRO",
      quantity: h.quantity > 0 ? h.quantity : undefined,
      // Sem preço médio no extrato, o investido começa igual ao valor atual (lucro zera hoje).
      investedValue: h.investedValue ?? (h.value >= 0 ? h.value : 0),
      currentValue: h.value >= 0 ? h.value : 0,
      fixedIncomeIndex: h.fixedIncomeIndex ?? undefined,
    });
    created += 1;
  }

  // Calendário de dividendos de TODOS os tickers do lote, depois de responder — não trava a
  // revisão da importação esperando dezenas de requisições ao investidor10.
  const tickers = holdings.map((h) => h.ticker).filter(Boolean);
  if (tickers.length > 0) after(() => refreshDividendsForTickers(tickers));

  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, created, updated };
}
