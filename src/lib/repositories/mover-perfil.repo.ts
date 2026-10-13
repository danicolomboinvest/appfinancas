import type { ParentCategory, ProfileKind } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { listProfiles, type ProfileRow } from "@/lib/repositories/profile.repo";
import { ehPessoa } from "@/lib/casal/acerto";
import { chaveUtil } from "@/lib/import/comerciante";
import {
  camposQueSaem,
  categoriaNoDestino,
  comerciantesParaLembrar,
  parcelasDaMesmaCompra,
} from "@/lib/perfis/mover-lancamentos";

/**
 * Mover lançamentos já importados de um perfil para outro do MESMO usuário (12/10/2026). O
 * lançamento continua o mesmo registro (mesmo id, mesmo lote de importação, mesmo id do banco):
 * só troca de perfil. Assim:
 * - o "Desfazer importação" do lote ainda leva a linha, como já acontece com a linha mandada para
 *   outro perfil na revisão (ver deleteImportBatchWithEntries);
 * - o próximo extrato do Pessoal reconhece a linha como já lançada (a importação compara com o
 *   que um lote DESTE perfil mandou para outro);
 * - o Open Finance não traz de novo (o id do banco é procurado em todos os perfis dela).
 *
 * Quem não pode: o par do Casal (o Casal é da titular), e ninguém move o que outra pessoa lançou.
 */

export type PerfilDestino = { id: string; name: string; kind: ProfileKind; icon: string; theme: string };

/** Os outros perfis dela, para onde dá para mandar. Vazio para o par e para quem tem um perfil só. */
export async function perfisDeDestino(ctx: AuthContext): Promise<PerfilDestino[]> {
  if (ctx.par) return [];
  const perfis = await listProfiles(ctx.userId);
  return perfis.filter((p) => p.id !== ctx.profileId).map(({ id, name, kind, icon, theme }) => ({ id, name, kind, icon, theme }));
}

/** O que o "Desfazer" precisa para devolver cada lançamento como estava. */
export type LinhaMovida = {
  id: string;
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
  goalId: string | null;
  pessoa: string | null;
  doCasal: boolean | null;
  soMeu: boolean;
  cliente: string | null;
  formaDeRecebimento: string | null;
  recebeEm: string | null;
  recebidoEm: string | null;
};

export type ResultadoDaMudanca =
  | { ok: true; movidos: number; ficaram: number; destino: PerfilDestino; desfazer: { destinoId: string; linhas: LinhaMovida[]; regras: string[] }; meses: { year: number; month: number }[] }
  | { ok: false; erro: string };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** O lançamento que ela pode mover: dela, deste perfil, e não lançado pelo par. */
function ondeDela(ctx: AuthContext, ids: string[]) {
  return { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId, OR: [{ autorUserId: null }, { autorUserId: ctx.userId }] };
}

async function destinoValido(ctx: AuthContext, destinoId: string): Promise<ProfileRow | null> {
  if (ctx.par || !destinoId || destinoId === ctx.profileId) return null;
  return (await listProfiles(ctx.userId)).find((p) => p.id === destinoId) ?? null;
}

/**
 * As outras parcelas da mesma compra, ainda neste perfil (para a pergunta "Levar as outras 5
 * parcelas?"). Busca só o que começa com o mesmo nome, não o histórico inteiro.
 */
export async function outrasParcelas(ctx: AuthContext, ids: string[]): Promise<string[]> {
  if (ctx.par || ids.length === 0) return [];
  const escolhidos = await prisma.monthlyEntry.findMany({ where: ondeDela(ctx, ids), select: { id: true, description: true, amount: true } });
  const prefixos = [...new Set(escolhidos.flatMap((e) => {
    const p = (e.description ?? "").split(/\d/)[0].trim();
    return p.length >= 3 ? [p.slice(0, 40)] : [];
  }))];
  if (prefixos.length === 0) return [];
  const candidatos = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: prefixos.map((p) => ({ description: { startsWith: p, mode: "insensitive" as const } })), AND: [{ OR: [{ autorUserId: null }, { autorUserId: ctx.userId }] }] },
    select: { id: true, description: true, amount: true },
    take: 500,
  });
  const num = (e: { id: string; description: string | null; amount: unknown }) => ({ id: e.id, description: e.description, amount: Number(e.amount) });
  return parcelasDaMesmaCompra(escolhidos.map(num), candidatos.map(num));
}

/**
 * Move os lançamentos para `destinoId`. Cada um leva a categoria que faz sentido lá (ver
 * categoriaNoDestino) e deixa para trás o que é só deste perfil (meta, quem pagou, cliente).
 * Fica de fora: o guardado que já entrou num ativo da carteira (a carteira é deste perfil) e a
 * transação do banco que o destino já tem.
 */
export async function moverLancamentos(
  ctx: AuthContext,
  input: { ids: string[]; destinoId: string; lembrar: boolean },
): Promise<ResultadoDaMudanca> {
  const destino = await destinoValido(ctx, input.destinoId);
  if (!destino) return { ok: false, erro: "Esse perfil não é seu." };
  const ids = [...new Set(input.ids)].slice(0, 500);
  if (ids.length === 0) return { ok: false, erro: "Nada escolhido." };

  const linhas = await prisma.monthlyEntry.findMany({
    where: ondeDela(ctx, ids),
    select: {
      id: true, year: true, month: true, category: true, parentCategory: true, customCategoryId: true, subcategory: true,
      description: true, amount: true, goalId: true, externalId: true, pessoa: true, doCasal: true, soMeu: true,
      cliente: true, formaDeRecebimento: true, recebeEm: true, recebidoEm: true,
    },
  });
  const [naCarteira, jaNoDestino, personalizadasDaOrigem, personalizadasDoDestino, regrasDoDestino] = await Promise.all([
    prisma.contributionAllocation.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, entryId: { in: linhas.map((l) => l.id) } }, select: { entryId: true } }),
    prisma.monthlyEntry.findMany({ where: { userId: ctx.userId, profileId: destino.id, externalId: { in: linhas.flatMap((l) => (l.externalId ? [l.externalId] : [])) } }, select: { externalId: true } }),
    prisma.customCategory.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true, name: true } }),
    prisma.customCategory.findMany({ where: { userId: ctx.userId, profileId: destino.id }, select: { id: true, name: true } }),
    prisma.transactionCategoryRule.findMany({ where: { userId: ctx.userId, profileId: destino.id }, orderBy: { updatedAt: "desc" } }),
  ]);
  const bloqueados = new Set(naCarteira.map((a) => a.entryId));
  const externosNoDestino = new Set(jaNoDestino.map((e) => e.externalId));
  const vao = linhas.filter((l) => !bloqueados.has(l.id) && !(l.externalId && externosNoDestino.has(l.externalId)));
  if (vao.length === 0) return { ok: false, erro: "Esses lançamentos não podem sair deste perfil." };

  const nomes = new Map(personalizadasDaOrigem.map((c) => [c.id, c.name]));
  const regras = regrasDoDestino.map((r) => ({ pattern: r.pattern, parentCategory: r.parentCategory, subcategory: r.subcategory ?? undefined, customCategoryId: r.customCategoryId ?? undefined }));
  const saem = camposQueSaem(destino.kind);

  await prisma.$transaction(
    vao.map((l) => {
      const categoria = categoriaNoDestino({
        lancamento: { ...l, amount: Number(l.amount) },
        origemKind: ctx.profileKind,
        destinoKind: destino.kind,
        nomeDaPersonalizada: l.customCategoryId ? nomes.get(l.customCategoryId) : null,
        personalizadasDoDestino,
        regrasDoDestino: regras,
      });
      return prisma.monthlyEntry.updateMany({
        where: { id: l.id, userId: ctx.userId, profileId: ctx.profileId },
        data: { profileId: destino.id, ...categoria, ...saem },
      });
    }),
  );

  // "Sempre mandar para lá": uma regra por comerciante, no perfil de onde a compra sai. Volta só
  // o id das que nasceram agora, para o Desfazer não apagar uma regra que ela já tinha.
  const regrasNovas: string[] = [];
  if (input.lembrar) {
    for (const pattern of comerciantesParaLembrar(vao.filter((l) => l.category === "EXPENSE").map((l) => l.description))) {
      const antes = await prisma.regraDePerfil.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, pattern }, select: { id: true } });
      if (antes) {
        await prisma.regraDePerfil.updateMany({ where: { id: antes.id, userId: ctx.userId, profileId: ctx.profileId }, data: { destinoProfileId: destino.id } });
      } else {
        const nova = await prisma.regraDePerfil.create({ data: { userId: ctx.userId, profileId: ctx.profileId, destinoProfileId: destino.id, pattern } });
        regrasNovas.push(nova.id);
      }
    }
  }

  const meses = [...new Map(vao.map((l) => [`${l.year}/${l.month}`, { year: l.year, month: l.month }])).values()];
  return {
    ok: true,
    movidos: vao.length,
    ficaram: linhas.length - vao.length + (ids.length - linhas.length),
    destino: { id: destino.id, name: destino.name, kind: destino.kind, icon: destino.icon, theme: destino.theme },
    meses,
    desfazer: {
      destinoId: destino.id,
      regras: regrasNovas,
      linhas: vao.map((l) => ({
        id: l.id,
        parentCategory: l.parentCategory,
        customCategoryId: l.customCategoryId,
        subcategory: l.subcategory,
        goalId: l.goalId,
        pessoa: l.pessoa,
        doCasal: l.doCasal,
        soMeu: l.soMeu,
        cliente: l.cliente,
        formaDeRecebimento: l.formaDeRecebimento,
        recebeEm: iso(l.recebeEm),
        recebidoEm: iso(l.recebidoEm),
      })),
    },
  };
}

const PARENTS: ParentCategory[] = ["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "IMPOSTOS", "OUTROS"];
const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const dia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : null);

/**
 * O "Desfazer": os lançamentos voltam do destino para ESTE perfil (o da tela de onde saíram), com
 * a categoria e os campos de antes. O que veio do cliente é conferido: só volta o que está mesmo
 * no destino e é dela, e categoria ou meta que não são deste perfil viram vazio.
 */
export async function desfazerMudanca(
  ctx: AuthContext,
  dados: { destinoId: string; linhas: LinhaMovida[]; regras: string[] },
): Promise<{ ok: boolean; voltaram: number; meses: { year: number; month: number }[] }> {
  const destino = await destinoValido(ctx, dados.destinoId);
  if (!destino || !Array.isArray(dados.linhas)) return { ok: false, voltaram: 0, meses: [] };
  const linhas = dados.linhas.slice(0, 500);
  const ids = linhas.map((l) => String(l.id));
  const [personalizadas, metas, presentes] = await Promise.all([
    prisma.customCategory.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, id: { in: linhas.flatMap((l) => (l.customCategoryId ? [String(l.customCategoryId)] : [])) } }, select: { id: true } }),
    prisma.goal.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, id: { in: linhas.flatMap((l) => (l.goalId ? [String(l.goalId)] : [])) } }, select: { id: true } }),
    prisma.monthlyEntry.findMany({ where: { id: { in: ids }, userId: ctx.userId, profileId: destino.id }, select: { id: true, year: true, month: true } }),
  ]);
  const minhas = new Set(personalizadas.map((c) => c.id));
  const minhasMetas = new Set(metas.map((g) => g.id));
  const casal = ctx.profileKind === "CASAL";
  const empresa = ctx.profileKind === "EMPRESA";
  const results = await prisma.$transaction(
    linhas.map((l) =>
      prisma.monthlyEntry.updateMany({
        where: { id: String(l.id), userId: ctx.userId, profileId: destino.id },
        data: {
          profileId: ctx.profileId,
          parentCategory: PARENTS.includes(l.parentCategory as ParentCategory) ? (l.parentCategory as ParentCategory) : null,
          customCategoryId: l.customCategoryId && minhas.has(String(l.customCategoryId)) ? String(l.customCategoryId) : null,
          subcategory: texto(l.subcategory, 120),
          goalId: l.goalId && minhasMetas.has(String(l.goalId)) ? String(l.goalId) : null,
          pessoa: casal && ehPessoa(l.pessoa) ? l.pessoa : null,
          doCasal: casal && typeof l.doCasal === "boolean" ? l.doCasal : null,
          soMeu: casal && l.soMeu === true,
          cliente: empresa ? texto(l.cliente, 80) : null,
          formaDeRecebimento: empresa ? texto(l.formaDeRecebimento, 10) : null,
          recebeEm: empresa ? dia(l.recebeEm) : null,
          recebidoEm: empresa ? dia(l.recebidoEm) : null,
        },
      }),
    ),
  );
  const regras = (dados.regras ?? []).map(String).slice(0, 100);
  if (regras.length > 0) await prisma.regraDePerfil.deleteMany({ where: { id: { in: regras }, userId: ctx.userId, profileId: ctx.profileId } });
  const voltaram = results.reduce((s, r) => s + r.count, 0);
  const meses = [...new Map(presentes.map((l) => [`${l.year}/${l.month}`, { year: l.year, month: l.month }])).values()];
  return { ok: voltaram === presentes.length && voltaram > 0, voltaram, meses };
}

/** As regras "sempre mandar" deste perfil, para a importação marcar a linha já com o destino. */
export async function regrasDePerfil(ctx: AuthContext): Promise<{ pattern: string; destinoProfileId: string }[]> {
  if (ctx.par) return [];
  return prisma.regraDePerfil.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { pattern: true, destinoProfileId: true } });
}

/** Para a tela: os comerciantes que dá para lembrar nos lançamentos escolhidos. */
export async function comerciantesDosLancamentos(ctx: AuthContext, ids: string[]): Promise<string[]> {
  if (ctx.par || ids.length === 0) return [];
  const linhas = await prisma.monthlyEntry.findMany({ where: { ...ondeDela(ctx, ids), category: "EXPENSE" }, select: { description: true } });
  return comerciantesParaLembrar(linhas.map((l) => l.description)).filter(chaveUtil);
}
