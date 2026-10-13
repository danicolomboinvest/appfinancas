import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { calcularAcerto, chaveDaConta as chaveDaContaDoAcerto, chaveDoMes, lerConfigCasal, type Acerto, type ConfigCasal } from "@/lib/casal/acerto";
import { primeiroNome } from "@/lib/casal-login/regras";
import type { ParNaSessao } from "@/lib/repositories/casal-login.repo";
import { casaAtiva, chaveDaConta, lancamentosDoAcertoDaCasa, letraDoDono, nomeDoArquivo, outraLetra, type CasaNaSessao, type Letra } from "@/lib/casa/regras";

/**
 * Casal simples (13/10/2026): a casa de quem está logado e o acerto do mês dela. A leitura que
 * junta os dois mora em src/lib/casa/regras.ts; aqui só o que precisa do banco.
 */

const NOME_DE_FABRICA = /^Pessoa [12]$/;

function nomeDaPessoa(config: ConfigCasal, letra: Letra, nomeDaConta: string | null, email: string): string {
  const daConfig = letra === "A" ? config.nomeA : config.nomeB;
  if (daConfig && !NOME_DE_FABRICA.test(daConfig)) return primeiroNome(daConfig, daConfig);
  return primeiroNome(nomeDaConta, email.split("@")[0]);
}

/**
 * A casa do modelo simples em que a conta está (como par ou como titular), vista por ela. Nula
 * quando não está em casa nenhuma, quando a casa ainda é do Nós dois, quando falta um dos dois
 * Pessoais ou quando o Casal da titular está parado (bloqueadoEm: não renovou).
 */
export async function casaDoUsuario(userId: string): Promise<CasaNaSessao | null> {
  const m = await prisma.membroCasal.findFirst({
    where: { saiuEm: null, modelo: "simples", OR: [{ userId }, { profile: { userId } }] },
    select: {
      id: true,
      letra: true,
      userId: true,
      profileId: true,
      perfilTitularId: true,
      perfilParId: true,
      bloqueadoEm: true,
      user: { select: { name: true, email: true } },
      profile: { select: { userId: true, casal: true, user: { select: { name: true, email: true } } } },
    },
  });
  if (!m || !m.perfilTitularId || !m.perfilParId || m.bloqueadoEm) return null;
  const config = lerConfigCasal(m.profile.casal);
  const letraPar: Letra = m.letra === "A" ? "A" : "B";
  const titular = {
    userId: m.profile.userId,
    profileId: m.perfilTitularId,
    letra: outraLetra(letraPar),
    nome: nomeDaPessoa(config, outraLetra(letraPar), m.profile.user.name, m.profile.user.email),
    papel: "titular" as const,
  };
  const par = { userId: m.userId, profileId: m.perfilParId, letra: letraPar, nome: nomeDaPessoa(config, letraPar, m.user.name, m.user.email), papel: "par" as const };
  if (titular.userId === par.userId) return null;
  const souPar = m.userId === userId;
  return { membroId: m.id, casalProfileId: m.profileId, eu: souPar ? par : titular, outro: souPar ? titular : par };
}

export type AcertoDaCasa = Acerto & {
  ano: number;
  mes: number;
  config: ConfigCasal;
  /** O mês já foi marcado como acertado (os "acertos" do Nós dois continuam valendo). */
  acertado: boolean;
  /** O mês foi fechado a dois no Nós dois (os dois disseram "Confere"). */
  fechado: boolean;
  eu: { letra: Letra; nome: string; papel: "titular" | "par" };
  outro: { letra: Letra; nome: string; papel: "titular" | "par" };
  /** Positivo: eu mando isso para o outro. Negativo: eu recebo. Zero: quites. */
  euMando: number;
};

/**
 * O acerto do mês da casa: os gastos que os dois enxergam (nada de "Só meu" nem de conta
 * escondida de ninguém), quem pagou pelo dono do registro, e o jeito de dividir de sempre
 * (renda, meio a meio ou combinado, e o conta por conta). É o mesmo calcularAcerto do Nós dois.
 */
export async function acertoDaCasa(ctx: AuthContext, ano: number, mes: number): Promise<AcertoDaCasa | null> {
  const casa = casaAtiva(ctx);
  if (!casa) return null;
  const [perfilCasal, linhas, fechamento] = await Promise.all([
    prisma.financialProfile.findUnique({ where: { id: casa.casalProfileId }, select: { casal: true } }),
    prisma.monthlyEntry.findMany({
      where: { AND: [lancamentosDoAcertoDaCasa(casa), { year: ano, month: mes, category: { in: ["EXPENSE", "INCOME"] } }] },
      select: { userId: true, category: true, amount: true, doCasal: true, description: true, subcategory: true, parentCategory: true },
    }),
    prisma.fechamentoCasal.findUnique({ where: { profileId_ano_mes: { profileId: casa.casalProfileId, ano, mes } }, select: { fechadoEm: true } }),
  ]);
  const config = lerConfigCasal(perfilCasal?.casal ?? null);
  const regras = config.regras ?? {};
  const acerto = calcularAcerto(
    linhas.map((l) => ({
      category: l.category,
      amount: Number(l.amount),
      pessoa: letraDoDono(casa, l.userId),
      doCasal: l.doCasal,
      modo: regras[chaveDaContaDoAcerto(l.description || l.subcategory, l.parentCategory)],
    })),
    config.divisao,
    { pctA: config.pctA },
  );
  const saldoDoEu = casa.eu.letra === "A" ? acerto.saldoA : -acerto.saldoA;
  const pessoa = (p: CasaNaSessao["eu"]) => ({ letra: p.letra, nome: p.nome, papel: p.papel });
  return {
    ...acerto,
    ano,
    mes,
    config,
    acertado: config.acertos.includes(chaveDoMes(ano, mes)),
    fechado: Boolean(fechamento?.fechadoEm),
    eu: pessoa(casa.eu),
    outro: pessoa(casa.outro),
    euMando: Math.round(-saldoDoEu * 100) / 100,
  };
}

// ---------------------------------------------------------------------------------------------
// Esconder: um gasto ("Só meu") ou uma conta inteira ("Mostrar para <par>").
// ---------------------------------------------------------------------------------------------

/**
 * "Só meu" num lançamento: só no que é MEU (userId + profileId de quem está logado). O do par
 * nunca casa com este filtro, então ninguém esconde nem mostra o gasto do outro.
 */
export async function marcarSoMeu(ctx: AuthContext, id: string, soMeu: boolean): Promise<{ year: number; month: number } | null> {
  if (!casaAtiva(ctx)) return null;
  const meu = await prisma.monthlyEntry.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, select: { year: true, month: true } });
  if (!meu) return null;
  await prisma.monthlyEntry.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { soMeu } });
  return meu;
}

export type ContaDaCasa = {
  chave: string;
  nome: string;
  tipo: "conta" | "cartao";
  ultimoEm: Date;
  lancamentos: number;
  /** Só nas minhas: está ligada para o par ver. */
  visivel: boolean;
};

async function contasDe(userId: string, profileId: string, soVisiveis: boolean): Promise<ContaDaCasa[]> {
  const lotes = await prisma.importBatch.findMany({
    where: { userId, profileId, ...(soVisiveis ? { ocultoDoPar: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { docType: true, fileName: true, createdAt: true, ocultoDoPar: true, _count: { select: { entries: true } } },
  });
  const contas = new Map<string, ContaDaCasa>();
  for (const l of lotes) {
    const chave = chaveDaConta(l.docType, l.fileName);
    const tipo = l.docType === "fatura" ? "cartao" : "conta";
    const atual = contas.get(chave);
    if (atual) {
      atual.lancamentos += l._count.entries;
      continue;
    }
    // A mais recente manda no nome e no "mostrar" (todas as da conta andam juntas).
    contas.set(chave, { chave, nome: nomeDoArquivo(l.fileName, tipo === "cartao" ? "Fatura" : "Extrato").split(/\s+/)[0], tipo, ultimoEm: l.createdAt, lancamentos: l._count.entries, visivel: !l.ocultoDoPar });
  }
  return [...contas.values()];
}

/** As minhas contas (com o "Mostrar para <par>") e as que o par deixou visíveis para mim. */
export async function contasDaCasa(ctx: AuthContext): Promise<{ minhas: ContaDaCasa[]; doOutro: ContaDaCasa[] } | null> {
  const casa = casaAtiva(ctx);
  if (!casa) return null;
  const [minhas, doOutro] = await Promise.all([contasDe(ctx.userId, ctx.profileId, false), contasDe(casa.outro.userId, casa.outro.profileId, true)]);
  return { minhas, doOutro };
}

/** Liga ou desliga "Mostrar para <par>" numa conta minha: todos os lotes dela andam juntos. */
export async function mostrarContaParaOPar(ctx: AuthContext, chave: string, mostrar: boolean): Promise<number> {
  if (!casaAtiva(ctx)) return 0;
  const lotes = await prisma.importBatch.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true, docType: true, fileName: true } });
  const ids = lotes.filter((l) => chaveDaConta(l.docType, l.fileName) === chave).map((l) => l.id);
  if (ids.length === 0) return 0;
  const r = await prisma.importBatch.updateMany({ where: { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId }, data: { ocultoDoPar: !mostrar } });
  return r.count;
}

/**
 * O lote novo de uma conta que ela já escondeu nasce escondido: desligar o "Mostrar" vale para
 * os extratos que ainda vão chegar, não só para os que já estavam lá.
 */
export async function contaEstaEscondida(userId: string, profileId: string, docType: string, fileName: string | null): Promise<boolean> {
  const chave = chaveDaConta(docType, fileName);
  const escondidos = await prisma.importBatch.findMany({ where: { userId, profileId, ocultoDoPar: true }, select: { docType: true, fileName: true }, take: 200 });
  return escondidos.some((l) => chaveDaConta(l.docType, l.fileName) === chave);
}

// ---------------------------------------------------------------------------------------------
// O jeito de dividir e o "acertado" do mês: os dois mexem (guardados no perfil Casal antigo).
// ---------------------------------------------------------------------------------------------

async function lerConfig(casalProfileId: string): Promise<ConfigCasal> {
  const p = await prisma.financialProfile.findUnique({ where: { id: casalProfileId }, select: { casal: true } });
  return lerConfigCasal(p?.casal ?? null);
}

export async function definirDivisaoDaCasa(ctx: AuthContext, divisao: "renda" | "meio"): Promise<boolean> {
  const casa = casaAtiva(ctx);
  if (!casa) return false;
  const config = await lerConfig(casa.casalProfileId);
  await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: { ...config, divisao } } });
  return true;
}

export async function marcarMesAcertado(ctx: AuthContext, ano: number, mes: number, acertado: boolean): Promise<boolean> {
  const casa = casaAtiva(ctx);
  if (!casa) return false;
  const config = await lerConfig(casa.casalProfileId);
  const chave = chaveDoMes(ano, mes);
  const acertos = acertado ? [...new Set([...config.acertos, chave])].sort() : config.acertos.filter((m) => m !== chave);
  await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: { ...config, acertos } } });
  return true;
}

// ---------------------------------------------------------------------------------------------
// O par com o app completo (fase 4): o Pessoal dele e a entrada sem compra.
// ---------------------------------------------------------------------------------------------

/**
 * O vínculo de quem é PAR numa casa simples, no formato do login do par (para a mesma régua de
 * pausa: o Casal da titular parou de valer, o acesso dele para e tudo fica guardado 90 dias).
 * Nulo para a titular e para quem não está numa casa simples.
 */
export async function parDeCasaSimples(userId: string): Promise<ParNaSessao | null> {
  const m = await prisma.membroCasal.findFirst({
    where: { userId, saiuEm: null, modelo: "simples" },
    select: { id: true, letra: true, bloqueadoEm: true, profile: { select: { userId: true, casal: true, user: { select: { name: true, email: true } } } } },
  });
  if (!m) return null;
  const letra: Letra = m.letra === "A" ? "A" : "B";
  const config = lerConfigCasal(m.profile.casal);
  return {
    membroId: m.id,
    letra,
    donoId: m.profile.userId,
    nomeTitular: nomeDaPessoa(config, outraLetra(letra), m.profile.user.name, m.profile.user.email),
    mostrarRenda: false,
    bloqueadoEm: m.bloqueadoEm,
  };
}

/**
 * O Pessoal do par: o que ele já tem (se comprou o SPI um dia) ou um novo. "Pode liberar tudo
 * para o par": ele usa o app inteiro no Pessoal dele, sem compra própria.
 */
export async function garantirPessoalDoPar(userId: string, tx: Pick<typeof prisma, "financialProfile"> = prisma): Promise<{ id: string; criado: boolean }> {
  const pessoal = await tx.financialProfile.findFirst({ where: { userId, kind: "PESSOAL" }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true } });
  if (pessoal) return { id: pessoal.id, criado: false };
  const temAlgum = await tx.financialProfile.findFirst({ where: { userId, isDefault: true }, select: { id: true } });
  const novo = await tx.financialProfile.create({ data: { userId, name: "Pessoal", kind: "PESSOAL", icon: "wallet", theme: "padrao", isDefault: !temAlgum }, select: { id: true } });
  return { id: novo.id, criado: true };
}
