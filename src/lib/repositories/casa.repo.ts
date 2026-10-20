import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { calcularAcerto, chaveDaConta as chaveDaContaDoAcerto, chaveDoMes, lerConfigCasal, type Acerto, type ConfigCasal } from "@/lib/casal/acerto";
import { primeiroNome } from "@/lib/casal-login/regras";
import { comVisto } from "@/lib/casa/tutorial";
import { ehDivisaoPropria, type DivisaoDaCasa } from "@/lib/casa/escolhas";
import type { ParNaSessao } from "@/lib/repositories/casal-login.repo";
import { casaAtiva, chaveDaConta, chaveDaRegraDaCasa, ehDaCasa, lancamentosDoAcertoDaCasa, letraDoDono, nomeDoArquivo, outraLetra, type CasaNaSessao, type LinhaDaCasa, type Letra } from "@/lib/casa/regras";

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
      migradoEm: true,
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
  return {
    membroId: m.id,
    casalProfileId: m.profileId,
    eu: souPar ? par : titular,
    outro: souPar ? titular : par,
    tutorialVisto: (config.tutorialVisto ?? []).includes(userId),
    migrada: m.migradoEm !== null,
    avisoMigracaoVisto: (config.avisoMigracaoVisto ?? []).includes(userId),
  };
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
  /**
   * O que entra no acerto do mês, com quem pagou (o que a tela do acerto lista): os gastos da
   * casa e, desde 15/10/2026, o gasto de um só que o outro pagou. `deQuem`: "casa", ou de quem é
   * (eu ou o outro). `pctEu`: a minha parte, em %, no gasto da casa.
   */
  gastosDaCasa: { id: string; descricao: string; valor: number; dia: string | null; quem: "eu" | "outro"; deQuem: "casa" | "eu" | "outro"; pctEu: number | null }[];
  /** A regra da casa vista por quem olha (proporções dele), a mesma que o Digitar mostra. */
  divisao: DivisaoDaCasa;
};

/** A regra da casa vista por uma pessoa, a partir do acerto calculado (a fração da A). */
function divisaoVistaPor(letra: Letra, config: ConfigCasal, acerto: Pick<Acerto, "rendas" | "caiuParaMeio">): DivisaoDaCasa {
  const { A, B } = acerto.rendas;
  const semRenda = !(A > 0 && B > 0);
  const fracaoRendaA = semRenda ? 0.5 : A / (A + B);
  const fracaoCombinadoA = typeof config.pctA === "number" ? config.pctA / 100 : 0.5;
  const minha = (fA: number) => Math.round((letra === "A" ? fA : 1 - fA) * 10000) / 100;
  return { modo: config.divisao, pctEuRenda: minha(fracaoRendaA), semRenda, pctEuCombinado: minha(fracaoCombinadoA) };
}

/**
 * O que os dois aprenderam sobre "da casa", por pessoa (cada gasto segue as regras de quem
 * gastou). Só os dois Pessoais da casa.
 */
export async function regrasDaCasaDosDois(casa: CasaNaSessao): Promise<Map<string, Map<string, boolean>>> {
  const regras = await prisma.regraDaCasa.findMany({
    where: { OR: [casa.eu, casa.outro].map((p) => ({ userId: p.userId, profileId: p.profileId })) },
    select: { userId: true, pattern: true, daCasa: true },
  });
  const porPessoa = new Map<string, Map<string, boolean>>([
    [casa.eu.userId, new Map()],
    [casa.outro.userId, new Map()],
  ]);
  for (const r of regras) porPessoa.get(r.userId)?.set(r.pattern, r.daCasa);
  return porPessoa;
}

/** Um classificador "é da casa?" para as linhas da lista (só montado quando há casa). */
export async function classificadorDaCasa(ctx: AuthContext): Promise<((l: LinhaDaCasa & { userId: string }) => boolean) | null> {
  const casa = casaAtiva(ctx);
  if (!casa) return null;
  const regras = await regrasDaCasaDosDois(casa);
  return (l) => ehDaCasa(l, regras.get(l.userId));
}

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
      select: {
        id: true,
        userId: true,
        category: true,
        amount: true,
        doCasal: true,
        soMeu: true,
        doPar: true,
        pagouOPar: true,
        divisaoPropria: true,
        parteDeQuemLancou: true,
        description: true,
        subcategory: true,
        parentCategory: true,
        entryDate: true,
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.fechamentoCasal.findUnique({ where: { profileId_ano_mes: { profileId: casa.casalProfileId, ano, mes } }, select: { fechadoEm: true } }),
  ]);
  // Só o que é DA CASA entra no acerto (decisão de 13/10/2026): a roupa que ele deixou visível
  // aparece para ela, mas não é dividida. A renda continua entrando (é ela que dá a proporção).
  // Desde 15/10/2026 (versão A): quem pagou é a escolha do lançamento (pagouOPar), o gasto de um
  // só entra quando o outro pagou, e a divisão própria do gasto manda sobre a da casa.
  const aprendidas = await regrasDaCasaDosDois(casa);
  const daCasa = (l: (typeof linhas)[number]) => ehDaCasa(l, aprendidas.get(l.userId));
  const config = lerConfigCasal(perfilCasal?.casal ?? null);
  const regras = config.regras ?? {};
  const doAcerto = linhas.map((l) => {
    const dono = letraDoDono(casa, l.userId);
    const pagador = dono && l.pagouOPar ? outraLetra(dono) : dono;
    const ehCasa = l.category === "EXPENSE" && daCasa(l);
    const propria = ehCasa && ehDivisaoPropria(l.divisaoPropria) ? l.divisaoPropria : null;
    const parte = l.parteDeQuemLancou === null ? null : Number(l.parteDeQuemLancou);
    return {
      linha: l,
      dono,
      ehCasa,
      lanc: {
        category: l.category,
        amount: Number(l.amount),
        pessoa: pagador,
        doCasal: l.category === "EXPENSE" ? ehCasa : null,
        modo: propria === "renda" || propria === "meio" ? propria : regras[chaveDaContaDoAcerto(l.description || l.subcategory, l.parentCategory)],
        ...(propria === "outra" && parte !== null && dono ? { fracaoA: dono === "A" ? parte / 100 : 1 - parte / 100 } : {}),
        ...(l.category === "EXPENSE" && !ehCasa && dono ? { deQuem: l.doPar ? outraLetra(dono) : dono } : {}),
      },
    };
  });
  const acerto = calcularAcerto(
    doAcerto.map((x) => x.lanc),
    config.divisao,
    { pctA: config.pctA },
  );
  const divisao = divisaoVistaPor(casa.eu.letra, config, acerto);
  const fracaoRendaA = acerto.caiuParaMeio || !(acerto.rendas.A > 0 && acerto.rendas.B > 0) ? 0.5 : acerto.rendas.A / (acerto.rendas.A + acerto.rendas.B);
  const fracaoDoGasto = (x: (typeof doAcerto)[number]): number => {
    if (typeof x.lanc.fracaoA === "number") return x.lanc.fracaoA;
    if (x.lanc.modo === "renda") return fracaoRendaA;
    if (x.lanc.modo === "meio") return 0.5;
    return acerto.fracaoA;
  };
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
    gastosDaCasa: doAcerto
      .filter((x) => {
        if (x.linha.category !== "EXPENSE" || !x.dono) return false;
        if (x.ehCasa) return true;
        // De um só: entra quando quem pagou não é de quem é o gasto.
        return x.lanc.deQuem !== undefined && x.lanc.pessoa !== x.lanc.deQuem;
      })
      .map((x) => {
        const l = x.linha;
        const fA = x.ehCasa ? fracaoDoGasto(x) : null;
        return {
          id: l.id,
          descricao: l.description || l.subcategory || "Sem nome",
          valor: Math.abs(Number(l.amount)),
          dia: l.entryDate ? l.entryDate.toISOString().slice(0, 10) : null,
          quem: x.lanc.pessoa === casa.eu.letra ? ("eu" as const) : ("outro" as const),
          deQuem: x.ehCasa ? ("casa" as const) : x.lanc.deQuem === casa.eu.letra ? ("eu" as const) : ("outro" as const),
          pctEu: fA === null ? null : Math.round((casa.eu.letra === "A" ? fA : 1 - fA) * 10000) / 100,
        };
      }),
    divisao,
  };
}

/**
 * A regra da casa no mês, vista por quem está logado (o Digitar mostra "Pela renda 55/45"): o
 * jeito de dividir e as proporções. A renda é a mesma do acerto (o que os dois enxergam).
 */
export async function divisaoDaCasaNoMes(ctx: AuthContext, ano: number, mes: number): Promise<DivisaoDaCasa | null> {
  const casa = casaAtiva(ctx);
  if (!casa) return null;
  const [perfilCasal, rendas] = await Promise.all([
    prisma.financialProfile.findUnique({ where: { id: casa.casalProfileId }, select: { casal: true } }),
    prisma.monthlyEntry.findMany({
      where: { AND: [lancamentosDoAcertoDaCasa(casa), { year: ano, month: mes, category: "INCOME" }] },
      select: { userId: true, amount: true },
    }),
  ]);
  const config = lerConfigCasal(perfilCasal?.casal ?? null);
  const acerto = calcularAcerto(
    rendas.map((r) => ({ category: "INCOME", amount: Number(r.amount), pessoa: letraDoDono(casa, r.userId), doCasal: null })),
    config.divisao,
    { pctA: config.pctA },
  );
  return divisaoVistaPor(casa.eu.letra, config, acerto);
}

/** As regras de "Da casa" que quem está logado ensinou (para o Digitar marcar o padrão pela loja). */
export async function regrasDaCasaDeQuemLanca(ctx: AuthContext): Promise<[string, boolean][]> {
  if (!casaAtiva(ctx)) return [];
  const regras = await prisma.regraDaCasa.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { pattern: true, daCasa: true }, take: 2000 });
  return regras.map((r) => [r.pattern, r.daCasa]);
}

/**
 * As três escolhas num gasto MEU já salvo (o lançamento aberto): de quem é, quem pagou e como
 * divide. "Do par" e o gasto que o par pagou entram no acerto, então nunca ficam no "Só meu".
 * Trocar entre Da casa e Meu ensina o app pela loja, como o toque de antes.
 */
export async function marcarEscolhasDoCasal(
  ctx: AuthContext,
  id: string,
  e: { doCasal: boolean; doPar: boolean; pagouOPar: boolean; divisaoPropria: string | null; parteDeQuemLancou: number | null },
): Promise<{ year: number; month: number } | null> {
  if (!casaAtiva(ctx)) return null;
  const meu = await prisma.monthlyEntry.findFirst({
    where: { id, userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE" },
    select: { year: true, month: true, description: true, doCasal: true, doPar: true },
  });
  if (!meu) return null;
  const entraNoAcerto = e.doPar || e.pagouOPar;
  const trocouCasaOuMeu = !e.doPar && meu.doCasal !== e.doCasal;
  await prisma.monthlyEntry.updateMany({
    where: { id, userId: ctx.userId, profileId: ctx.profileId },
    data: {
      doCasal: e.doCasal,
      doPar: e.doPar,
      pagouOPar: e.pagouOPar,
      divisaoPropria: e.doCasal ? e.divisaoPropria : null,
      parteDeQuemLancou: e.doCasal && e.divisaoPropria === "outra" ? e.parteDeQuemLancou : null,
      ...(entraNoAcerto ? { soMeu: false } : {}),
    },
  });
  const pattern = chaveDaRegraDaCasa(meu.description);
  if (trocouCasaOuMeu && pattern) {
    await prisma.regraDaCasa.upsert({
      where: { userId_profileId_pattern: { userId: ctx.userId, profileId: ctx.profileId, pattern } },
      create: { userId: ctx.userId, profileId: ctx.profileId, pattern, daCasa: e.doCasal },
      update: { daCasa: e.doCasal },
    });
  }
  return { year: meu.year, month: meu.month };
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
  const meu = await prisma.monthlyEntry.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, select: { year: true, month: true, doPar: true, pagouOPar: true } });
  if (!meu) return null;
  // O que entra no acerto ("Do par", ou o que o par pagou) os dois precisam ver: não esconde.
  if (soMeu && (meu.doPar || meu.pagouOPar)) return null;
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

/**
 * O jeito de dividir da casa. "Combinado" (liberado para todos em 15/10/2026) leva a parte de quem
 * está logado, em %, de 20 a 80 (a mesma régua do Nós dois); guardada como a parte da pessoa A.
 * Sem a parte, vale a que já estava guardada.
 */
export async function definirDivisaoDaCasa(ctx: AuthContext, divisao: "renda" | "meio" | "combinado", pctEu?: number): Promise<boolean> {
  const casa = casaAtiva(ctx);
  if (!casa) return false;
  const config = await lerConfig(casa.casalProfileId);
  if (divisao !== "combinado") {
    await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: { ...config, divisao } } });
    return true;
  }
  const pctA = typeof pctEu === "number" && Number.isFinite(pctEu) ? Math.round(casa.eu.letra === "A" ? pctEu : 100 - pctEu) : config.pctA;
  if (typeof pctA !== "number" || pctA < 20 || pctA > 80) return false;
  await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: { ...config, divisao, pctA } } });
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

/**
 * As metas a dois do Nós dois de antes (ficam no perfil Casal antigo, com os aportes delas). Os
 * dois veem em Metas, só para acompanhar. Só as do perfil Casal da casa: nada do Pessoal de ninguém.
 */
export async function metasADois(ctx: AuthContext, hoje: Date): Promise<{ id: string; nome: string; foto: string; alvo: number; guardado: number; pct: number }[]> {
  const casa = casaAtiva(ctx);
  if (!casa) return [];
  const titular = casa.eu.papel === "titular" ? casa.eu : casa.outro;
  const { listarMetasDaTela } = await import("@/lib/repositories/metas.repo");
  const doCasal = { ...ctx, userId: titular.userId, profileId: casa.casalProfileId, casa: null };
  const metas = await listarMetasDaTela(doCasal, hoje);
  return metas.map((m) => ({ id: m.id, nome: m.nome, foto: m.foto, alvo: m.alvo, guardado: m.guardado, pct: m.plano.pct }));
}

// ---------------------------------------------------------------------------------------------
// Sair da casa e os nomes (Configurações › Casa).
// ---------------------------------------------------------------------------------------------

/**
 * A titular tira o par ("removido") ou o par sai ("saiu"). Nada é movido: cada um já está com os
 * próprios lançamentos no próprio Pessoal. O acerto, os meses fechados e as metas a dois ficam no
 * perfil Casal da titular, que volta para a lista de perfis dela. O par segue a regra de pausa de
 * hoje: sem compra própria, o acesso dele para e o que é dele fica guardado.
 */
export async function sairDaCasa(ctx: AuthContext, quem: "titular" | "par", agora: Date = new Date()): Promise<number> {
  const casa = casaAtiva(ctx);
  if (!casa || casa.eu.papel !== quem) return 0;
  const r = await prisma.membroCasal.updateMany({
    where: { id: casa.membroId, saiuEm: null, modelo: "simples" },
    data: { saiuEm: agora, motivoSaida: quem === "titular" ? "removido" : "saiu" },
  });
  return r.count;
}

/**
 * "Como funciona o casal" visto por quem está logado (terminou ou pulou): guardado no perfil
 * Casal da titular, pelo id da conta, para valer em qualquer aparelho e não abrir de novo.
 */
export async function marcarTutorialDoCasalVisto(ctx: AuthContext): Promise<boolean> {
  const casa = ctx.casa;
  if (!casa || casa.eu.userId !== ctx.userId) return false;
  const config = await lerConfig(casa.casalProfileId);
  if (config.tutorialVisto?.includes(ctx.userId)) return true;
  await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: { ...config, tutorialVisto: comVisto(config.tutorialVisto, ctx.userId) } } });
  return true;
}

/**
 * "O casal ficou mais simples" visto por quem está logado, guardado no mesmo lugar do tutorial
 * (o perfil Casal da titular, pelo id da conta). No "Agora não" o tutorial também fica como
 * visto, para não abrir sozinho logo depois; no "Ver como funciona" quem marca é o tutorial.
 */
export async function marcarAvisoDaMigracaoVisto(ctx: AuthContext, tambemOTutorial: boolean): Promise<boolean> {
  const casa = ctx.casa;
  if (!casa || casa.eu.userId !== ctx.userId) return false;
  const config = await lerConfig(casa.casalProfileId);
  const jaViuOAviso = config.avisoMigracaoVisto?.includes(ctx.userId);
  const jaViuOTutorial = !tambemOTutorial || config.tutorialVisto?.includes(ctx.userId);
  if (jaViuOAviso && jaViuOTutorial) return true;
  const novo: ConfigCasal = { ...config, avisoMigracaoVisto: comVisto(config.avisoMigracaoVisto, ctx.userId) };
  if (tambemOTutorial) novo.tutorialVisto = comVisto(config.tutorialVisto, ctx.userId);
  await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: novo } });
  return true;
}

/** Os dois nomes da casa (o meu e o do outro), guardados no perfil Casal pelas letras. */
export async function salvarNomesDaCasa(ctx: AuthContext, nomeEu: string, nomeOutro: string): Promise<boolean> {
  const casa = casaAtiva(ctx);
  if (!casa) return false;
  const config = await lerConfig(casa.casalProfileId);
  const nomes = { [casa.eu.letra === "A" ? "nomeA" : "nomeB"]: nomeEu, [casa.outro.letra === "A" ? "nomeA" : "nomeB"]: nomeOutro };
  await prisma.financialProfile.update({ where: { id: casa.casalProfileId }, data: { casal: { ...config, ...nomes } } });
  return true;
}

/** Quem saiu (ou foi tirado) de uma casa simples há menos de 90 dias, para a tela de pausa. */
export async function saidaRecenteDaCasa(userId: string, agora: Date = new Date()): Promise<{ nomeTitular: string; ate: Date; motivo: string | null } | null> {
  const m = await prisma.membroCasal.findFirst({
    where: { userId, modelo: "simples", saiuEm: { not: null, gt: new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000) } },
    orderBy: { saiuEm: "desc" },
    select: { letra: true, saiuEm: true, motivoSaida: true, profile: { select: { casal: true, user: { select: { name: true, email: true } } } } },
  });
  if (!m?.saiuEm) return null;
  const letra: Letra = m.letra === "A" ? "A" : "B";
  return {
    nomeTitular: nomeDaPessoa(lerConfigCasal(m.profile.casal), outraLetra(letra), m.profile.user.name, m.profile.user.email),
    ate: new Date(m.saiuEm.getTime() + 90 * 24 * 60 * 60 * 1000),
    motivo: m.motivoSaida,
  };
}

/**
 * O nome e o ícone das categorias que o PAR criou e que aparecem nos lançamentos dele que eu vejo
 * (Casal simples). A categoria é de quem criou: só leitura, para escrever o nome onde aparecer
 * (nunca para escolher). Sem casa ou com ids que não são do par, volta vazio.
 */
export async function categoriasDoParPorId(ctx: AuthContext, ids: string[]): Promise<{ id: string; name: string; icon: string }[]> {
  const casa = casaAtiva(ctx);
  if (!casa || ids.length === 0) return [];
  return prisma.customCategory.findMany({
    where: { id: { in: ids }, userId: casa.outro.userId, profileId: casa.outro.profileId },
    select: { id: true, name: true, icon: true },
  });
}
