import { prisma } from "@/lib/db/prisma";
import { isImplausivelMessage, leituraIncompletaDoRegistro, MARCA_NAO_FECHOU } from "@/lib/repositories/import-diagnostic.repo";

/**
 * Quem teve problema na importação e continua sem solução — a lista que chega pra Dani decidir
 * quem chamar, em vez de esperar a pessoa pedir ajuda.
 *
 * Sete pessoas pediram reembolso sem nunca ter falado com a Dani. Elas subiram um arquivo, não
 * deu certo, e o app não fez nada. Até 29/09/2026 esta lista disparava o ManyChat sozinha; a Dani
 * pediu que nenhuma mensagem saia pra cliente sem ela aprovar no dia (alarme falso pra quem
 * importou certo é pior que o silêncio), então agora ela só vai no e-mail diário.
 *
 * Quem entra na lista:
 *
 * 1. **Só quem ficou sem solução.** Quem errou e na tentativa seguinte conseguiu importar sai da
 *    lista — ser abordada por um problema que ela já resolveu sozinha é ruído.
 * 2. **Quem já foi avisada sobre o problema mais recente, não.** A marca `avisadoEm` no
 *    diagnóstico vem da época do ManyChat; hoje nada grava ela.
 */

/** Quanto tempo depois do erro ainda faz sentido puxar conversa. Depois disso é estranho. */
const JANELA_DIAS = 7;

export type PessoaAAvisar = {
  diagnosticId: string;
  userId: string;
  email: string;
  nome: string | null;
  /** O que aconteceu, em português, pra Dani saber do que se trata sem abrir nada. */
  problema: string;
  fileName: string | null;
  quando: Date;
};

/** O que a regra precisa saber de cada tentativa. Bate com o que a consulta traz. */
export type TentativaDeImport = {
  id: string;
  userId: string;
  stage: string;
  ok: boolean;
  created: number;
  moneyLines: number;
  parsed: number;
  message: string | null;
  fileName: string | null;
  avisadoEm: Date | null;
  createdAt: Date;
  user: { email: string; name: string | null };
};

/**
 * A REGRA de quem recebe mensagem, separada do banco porque é ela que pode incomodar cliente de
 * verdade. As tentativas chegam da mais nova pra mais velha.
 */
export function escolherQuemAvisar(rows: TentativaDeImport[]): PessoaAAvisar[] {
  const problemaDe = (r: TentativaDeImport): string | null => {
    if (!r.ok) return r.message?.split(".")[0] ?? "o app não conseguiu ler o arquivo";
    if (isImplausivelMessage(r.message)) return "os valores entraram errados no app";
    if (leituraIncompletaDoRegistro(r))
      return r.message?.startsWith(MARCA_NAO_FECHOU)
        ? "a soma do que o app leu não bateu com o total do arquivo"
        : `o app leu só ${r.parsed} de ${r.moneyLines} linhas do arquivo`;
    return null;
  };

  const resolvido = new Set<string>();
  const escolhidas = new Map<string, PessoaAAvisar>();

  // Em ordem do mais novo pro mais velho: a primeira coisa boa que a pessoa fez já a tira da fila.
  for (const r of rows) {
    if (r.stage === "confirm" && r.ok && r.created > 0) {
      resolvido.add(r.userId);
      continue;
    }
    if (resolvido.has(r.userId) || escolhidas.has(r.userId)) continue;
    if (r.avisadoEm) {
      // Já falamos com ela sobre o problema mais recente: não fala de novo.
      resolvido.add(r.userId);
      continue;
    }
    const problema = problemaDe(r);
    if (!problema) continue;
    escolhidas.set(r.userId, {
      diagnosticId: r.id,
      userId: r.userId,
      email: r.user.email,
      nome: r.user.name,
      problema,
      fileName: r.fileName,
      quando: r.createdAt,
    });
  }

  return [...escolhidas.values()];
}

/** Busca no banco e aplica a regra. */
export async function pessoasAAvisar(agora = new Date()): Promise<PessoaAAvisar[]> {
  const desde = new Date(agora.getTime() - JANELA_DIAS * 86_400_000);
  const rows = await prisma.importDiagnostic.findMany({
    where: { createdAt: { gte: desde } },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return escolherQuemAvisar(rows);
}
