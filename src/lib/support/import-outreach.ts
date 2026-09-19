import { prisma } from "@/lib/db/prisma";
import { avisarErroDeImportacao, isManychatConfigured } from "@/lib/manychat/client";
import { isImplausivelMessage, isPartialRead } from "@/lib/repositories/import-diagnostic.repo";

/**
 * Puxa conversa com quem teve problema na importação, em vez de esperar a pessoa pedir ajuda.
 *
 * Sete pessoas pediram reembolso sem nunca ter falado com a Dani. Elas subiram um arquivo, não
 * deu certo, e o app não fez nada — nem avisou, nem ofereceu ajuda, nem contou pra ninguém. Esta
 * função é o outro lado disso: todo dia olha quem ficou na mão e manda o ManyChat abrir conversa.
 *
 * Três decisões que importam mais que o código:
 *
 * 1. **Só quem ficou sem solução.** Quem errou e na tentativa seguinte conseguiu importar não
 *    recebe nada — ser abordada por um problema que ela já resolveu sozinha é ruído, e ruído
 *    faz a próxima mensagem ser ignorada.
 * 2. **Uma vez por problema.** O aviso fica marcado no diagnóstico. Sem isso o cron repetiria a
 *    mesma mensagem todo dia, que é a forma mais rápida de virar spam pra quem já está irritada.
 * 3. **Falha de entrega não vira silêncio.** Fora da janela de 24h do WhatsApp, ou sem contato
 *    no ManyChat, a tentativa fica registrada com o motivo e a pessoa entra na lista que vai no
 *    e-mail da Dani, pra ela chamar na mão. O pior resultado possível seria o app "avisar" e
 *    ninguém ficar sabendo que não chegou.
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
    if (r.stage === "parse" && isPartialRead(r.moneyLines, r.parsed))
      return `o app leu só ${r.parsed} de ${r.moneyLines} linhas do arquivo`;
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

/**
 * Falhas que são configuração NOSSA, não um fato sobre a pessoa.
 *
 * A diferença importa: um contato que não existe no ManyChat hoje também não vai existir amanhã,
 * então insistir só gasta chamada. Mas "falta o token" é um buraco do nosso lado — no dia em que
 * for preenchido, essas pessoas precisam ser avisadas. Marcá-las como avisadas enquanto o app
 * nem conseguia tentar as apagaria da fila pra sempre, e elas são justamente quem já estava
 * esperando ajuda.
 */
const FALTA_CONFIGURACAO = new Set(["sem-token", "sem-fluxo", "sem-configuracao"]);

export function marcaComoAvisada(status: string): boolean {
  return !FALTA_CONFIGURACAO.has(status);
}

export type ResultadoDoAviso = PessoaAAvisar & {
  enviado: boolean;
  /** "enviado" | "fora-da-janela" | "nao-encontrado" | "sem-token" | "sem-fluxo" | "erro" */
  status: string;
};

/**
 * Manda o ManyChat abrir conversa com cada uma. `dryRun` devolve a lista sem mandar nada —
 * é como dá pra conferir quem receberia antes de mandar de verdade pra cliente de verdade.
 */
export async function avisarPessoas(pessoas: PessoaAAvisar[], dryRun = false): Promise<ResultadoDoAviso[]> {
  const resultados: ResultadoDoAviso[] = [];
  for (const p of pessoas) {
    if (dryRun) {
      resultados.push({ ...p, enviado: false, status: isManychatConfigured() ? "simulado" : "sem-configuracao" });
      continue;
    }
    const r = await avisarErroDeImportacao(p.email);
    const status = r.ok ? "enviado" : r.motivo;
    resultados.push({ ...p, enviado: r.ok, status });
    if (marcaComoAvisada(status)) {
      await prisma.importDiagnostic
        .update({ where: { id: p.diagnosticId }, data: { avisadoEm: new Date(), avisoStatus: status } })
        .catch((err) => console.error("marcar aviso falhou (ignorado)", err));
    }
  }
  return resultados;
}
