import { prisma } from "@/lib/db/prisma";

/**
 * Registro de toda tentativa de importação, inclusive (principalmente) as que falharam.
 *
 * Antes disso, arquivo que o app não conseguia ler sumia sem deixar rastro: nenhum lote era
 * criado e o log da Vercel apagava em poucos dias. Resultado prático: sete pedidos de reembolso
 * sem a gente conseguir dizer qual banco ou qual formato quebrou.
 *
 * O que fica guardado é só o que serve pra reproduzir — nome do arquivo, o que o app entendeu,
 * quantas linhas com valor viu, quantas conseguiu ler e a mensagem de erro — mais o CABEÇALHO
 * do arquivo, que é a linha de nomes de coluna e é o que identifica o formato do banco.
 * Nunca o conteúdo: nenhuma transação, nenhum valor, nenhum nome de terceiro.
 */
export type ImportDiagnosticInput = {
  userId: string;
  /** "extrato" | "fatura" | "carteira" */
  target: string;
  /** "parse" = leitura do arquivo; "confirm" = gravação do que a pessoa confirmou. */
  stage: "parse" | "confirm";
  ok: boolean;
  fileName?: string | null;
  encoding?: string | null;
  kind?: string | null;
  institution?: string | null;
  moneyLines?: number;
  parsed?: number;
  created?: number;
  skipped?: number;
  message?: string | null;
  header?: string | null;
};

/**
 * Marca no início da mensagem de um diagnóstico que deu "ok" mas saiu com número implausível.
 * É o que faz a leitura errada aparecer na checagem diária: sem ela, importação que grava lixo
 * fica indistinguível de importação boa, que foi como quatro extratos corrompidos passaram
 * semanas no banco sem ninguém ficar sabendo.
 */
export const MARCA_IMPLAUSIVEL = "[implausível]";

/** Monta a mensagem marcada. Quem grava e quem lê usam esta dupla, nunca a string solta. */
export function mensagemImplausivel(motivos: string[]): string {
  return `${MARCA_IMPLAUSIVEL} ${motivos.join(" ")}`;
}

/** Reconhece a marca. Se esta e `mensagemImplausivel` divergirem, a leitura errada some do relatório. */
export function isImplausivelMessage(message: string | null | undefined): boolean {
  return message?.startsWith(MARCA_IMPLAUSIVEL) ?? false;
}

/**
 * "Leu só parte do arquivo": viu bastante linha com valor e aproveitou menos da metade.
 * Mora aqui pra checagem diária e a hora de guardar o arquivo usarem a MESMA régua — se as duas
 * divergirem, o relatório acusa uma leitura parcial e o arquivo dela não está guardado.
 */
export function isPartialRead(moneyLines: number, parsed: number): boolean {
  return moneyLines > 3 && parsed < moneyLines * 0.5;
}

/** Cabeçalho sem valores: corta em 160 caracteres e tira qualquer número com 6+ dígitos. */
export function safeHeader(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return first.replace(/\d{6,}/g, "…").slice(0, 160);
}

/**
 * Grava o diagnóstico sem NUNCA derrubar a importação: se esta escrita falhar, a pessoa não
 * pode perder o arquivo dela por causa de uma linha de telemetria.
 */
export async function recordImportDiagnostic(input: ImportDiagnosticInput): Promise<string | null> {
  try {
    const row = await prisma.importDiagnostic.create({
      select: { id: true },
      data: {
        userId: input.userId,
        target: input.target,
        stage: input.stage,
        ok: input.ok,
        fileName: input.fileName ?? null,
        encoding: input.encoding ?? null,
        kind: input.kind ?? null,
        institution: input.institution ?? null,
        moneyLines: input.moneyLines ?? 0,
        parsed: input.parsed ?? 0,
        created: input.created ?? 0,
        skipped: input.skipped ?? 0,
        message: input.message ? input.message.slice(0, 400) : null,
        header: input.header ?? null,
      },
    });
    return row.id;
  } catch (err) {
    console.error("recordImportDiagnostic falhou (ignorado)", err);
    return null;
  }
}

export type ImportHealthWindow = {
  desde: Date;
  total: number;
  falhas: number;
  /** Leu o arquivo, mas achou pouca coisa perto do que tinha: quase sempre formato não suportado. */
  parciais: number;
  /** Leu tudo, mas os números não parecem dinheiro: coluna errada, sinal perdido. */
  implausiveis: number;
  /** Agrupado pelo que dá pra agir: mesma mensagem + mesmo formato de arquivo. */
  porCausa: { causa: string; vezes: number; pessoas: number; exemplos: string[] }[];
  /** Pessoas que tentaram e não conseguiram nada — é quem pede reembolso. */
  pessoasSemSucesso: { userId: string; email: string; tentativas: number }[];
};

/** Extensão do arquivo, que é o que separa "csv do Nubank" de "xls do Itaú". */
function extOf(fileName: string | null): string {
  const m = (fileName ?? "").toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "sem extensão";
}

/**
 * Raio-X da importação numa janela de dias: o que quebrou, por qual motivo, quantas pessoas
 * foram afetadas e quem ficou sem nada. É o que a checagem diária manda pra Dani.
 */
export async function getImportHealth(days = 1): Promise<ImportHealthWindow> {
  const desde = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.importDiagnostic.findMany({
    where: { createdAt: { gte: desde } },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const falhas = rows.filter((r) => !r.ok);
  // Leu menos da metade das linhas com valor (e ficou faltando coisa de verdade).
  const parciais = rows.filter((r) => r.ok && r.stage === "parse" && isPartialRead(r.moneyLines, r.parsed));
  // Leu tudo e o resultado não parece dinheiro de gente.
  const implausiveis = rows.filter((r) => r.ok && isImplausivelMessage(r.message));

  const grupos = new Map<string, { vezes: number; pessoas: Set<string>; exemplos: Set<string> }>();
  // Uma mesma tentativa pode ser parcial E implausível: deduplica pra não contar duas vezes.
  const problematicos = [...new Map([...falhas, ...parciais, ...implausiveis].map((r) => [r.id, r])).values()];
  for (const r of problematicos) {
    const motivo = isImplausivelMessage(r.message)
      ? `leu números implausíveis — ${r.message!.slice(MARCA_IMPLAUSIVEL.length).trim().split(".")[0]}`
      : r.ok
        ? "leu só parte do arquivo"
        : (r.message ?? "erro sem mensagem").split(".")[0];
    const causa = `${r.target}/${extOf(r.fileName)} · ${motivo}`;
    const g = grupos.get(causa) ?? { vezes: 0, pessoas: new Set<string>(), exemplos: new Set<string>() };
    g.vezes += 1;
    g.pessoas.add(r.userId);
    if (r.header) g.exemplos.add(r.header);
    grupos.set(causa, g);
  }

  // Quem tentou na janela e não levou NENHUM lançamento pra dentro.
  const porPessoa = new Map<string, { email: string; tentativas: number; sucesso: boolean }>();
  for (const r of rows) {
    const atual = porPessoa.get(r.userId) ?? { email: r.user.email, tentativas: 0, sucesso: false };
    atual.tentativas += 1;
    if (r.stage === "confirm" && r.ok && r.created > 0) atual.sucesso = true;
    porPessoa.set(r.userId, atual);
  }

  return {
    desde,
    total: rows.length,
    falhas: falhas.length,
    parciais: parciais.length,
    implausiveis: implausiveis.length,
    porCausa: [...grupos.entries()]
      .map(([causa, g]) => ({ causa, vezes: g.vezes, pessoas: g.pessoas.size, exemplos: [...g.exemplos].slice(0, 3) }))
      .sort((a, b) => b.pessoas - a.pessoas || b.vezes - a.vezes),
    pessoasSemSucesso: [...porPessoa.entries()]
      .filter(([, v]) => !v.sucesso)
      .map(([userId, v]) => ({ userId, email: v.email, tentativas: v.tentativas })),
  };
}
