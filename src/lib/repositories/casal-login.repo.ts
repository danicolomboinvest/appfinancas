import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { LIMITES_DO_CONVITE, LIMITE_DA_PAGINA, cabeMaisUmaTentativa } from "@/lib/casal-login/limite";
import { reservarEnvio } from "@/lib/auth/limite-de-envio";
import { gerarTokenDoConvite, hashDoToken, tokenTemFormato } from "@/lib/casal-login/token";
import {
  TERMOS_DO_PAR_VERSAO,
  VALIDADE_DO_CONVITE_MS,
  decidirTela,
  estadoDoConvite,
  letraDoPar,
  nomeDadoAoPar,
  outraLetra,
  primeiroNome,
  type CanalDoConvite,
  type EstadoDoConvite,
  type TelaDoConvite,
} from "@/lib/casal-login/regras";
import { decidirSituacaoDoPar, type SituacaoDoPar } from "@/lib/casal-login/acesso";
import { temAdicional } from "@/lib/casal-login/adicional";
import { lerConfigCasal, type ConfigCasal } from "@/lib/casal/acerto";
import { normalizeEmail, situacaoDoAcesso } from "@/lib/repositories/allowedEmail.repo";
import type { ProfileRow } from "@/lib/repositories/profile.repo";
import { garantirPessoalDoPar } from "@/lib/repositories/casa.repo";
import { levarDadosDoCasalParaOPessoal } from "@/lib/repositories/casal-dados";
import { MARCA_DO_TOUR_NA_CONTA_NOVA } from "@/lib/novidades/passos";

/**
 * Login do par no Nós dois (aprovado pela dona em 11/10/2026, casal-login-proposta.html).
 *
 * A titular paga o Casal e manda um link; o par cria o login (ou entra com o que já tem) e cai
 * direto no Nós dois dela. Ele nunca vê o Pessoal nem a Empresa da titular: o par só tem acesso
 * ao perfil Casal em que é membro, e as leituras passam pelo filtro de casal-login/privacidade.ts.
 */

const CAMPOS_DO_PERFIL = { id: true, name: true, kind: true, icon: true, theme: true, position: true, isDefault: true, categorias: true, casal: true } as const;

/** O que a sessão do par carrega além do perfil. */
export type ParNaSessao = {
  membroId: string;
  letra: "A" | "B";
  /** A titular, dona do perfil Casal. */
  donoId: string;
  nomeTitular: string;
  mostrarRenda: boolean;
  bloqueadoEm: Date | null;
};

function nomeDaTitular(config: ConfigCasal, letraDoPar: "A" | "B", nomeDaConta: string | null, email: string): string {
  const daConfig = letraDoPar === "A" ? config.nomeB : config.nomeA;
  if (daConfig && !/^Pessoa [12]$/.test(daConfig)) return primeiroNome(daConfig, daConfig);
  return primeiroNome(nomeDaConta, email.split("@")[0]);
}

/**
 * O perfil Casal em que a conta é o par, se ela estiver nele agora. É o perfil ativo do par: ele
 * não ganha um Pessoal sem comprar (proposta: "a entrada dele vale pelo vínculo, não pela compra").
 */
export async function perfilDoPar(userId: string): Promise<{ perfil: ProfileRow; par: ParNaSessao } | null> {
  const m = await prisma.membroCasal.findFirst({
    // Casal simples: a casa migrada não abre o Nós dois (o par está no Pessoal dele).
    where: { userId, saiuEm: null, emUso: true, modelo: "nos-dois" },
    select: { id: true, letra: true, bloqueadoEm: true, profile: { select: { ...CAMPOS_DO_PERFIL, userId: true, user: { select: { name: true, email: true } } } } },
  });
  if (!m || m.profile.kind !== "CASAL") return null;
  const letra = m.letra === "A" ? "A" : "B";
  const config = lerConfigCasal(m.profile.casal);
  const nomeTitular = nomeDaTitular(config, letra, m.profile.user.name, m.profile.user.email);
  const { user: _u, userId: donoId, ...perfil } = m.profile;
  void _u;
  return {
    perfil: { ...perfil, name: `Nós dois de ${nomeTitular}`, isDefault: true },
    par: { membroId: m.id, letra, donoId, nomeTitular, mostrarRenda: config.mostrarRenda === true, bloqueadoEm: m.bloqueadoEm },
  };
}

/**
 * Os perfis que aparecem na troca de perfil de quem é par: o Nós dois da titular e, se ele
 * comprou o SPI, os perfis dele. Para quem não é par, o de sempre.
 */
export async function perfilDoParNaLista(userId: string): Promise<ProfileRow | null> {
  const m = await prisma.membroCasal.findFirst({
    where: { userId, saiuEm: null, modelo: "nos-dois" },
    select: { letra: true, profile: { select: { ...CAMPOS_DO_PERFIL, user: { select: { name: true, email: true } } } } },
  });
  if (!m || m.profile.kind !== "CASAL") return null;
  const config = lerConfigCasal(m.profile.casal);
  const { user, ...perfil } = m.profile;
  return { ...perfil, name: `Nós dois de ${nomeDaTitular(config, m.letra === "A" ? "A" : "B", user.name, user.email)}`, isDefault: false };
}

/** O Casal da titular vale agora: o app dela ativo e a conta do parceiro (adicional) liberada. */
export async function casalDaTitularValendo(titularId: string, agora: Date = new Date()): Promise<boolean> {
  const t = await prisma.user.findUnique({ where: { id: titularId }, select: { email: true, role: true } });
  if (!t) return false;
  const ativa = t.role === "ADMIN" || (await situacaoDoAcesso(t.email)) === "ativo";
  if (!ativa) return false;
  return temAdicional(titularId, "conta_parceiro", agora);
}

/** Se o par pode usar o Nós dois agora. Grava a primeira vez que viu o Casal parado (os 90 dias contam dali). */
export async function situacaoDoParAgora(par: ParNaSessao, agora: Date = new Date()): Promise<SituacaoDoPar> {
  const valendo = await casalDaTitularValendo(par.donoId, agora);
  const s = decidirSituacaoDoPar({ titularAtiva: valendo, temAdicional: valendo, bloqueadoEm: par.bloqueadoEm, agora });
  if (s.tipo === "liberado" && par.bloqueadoEm) {
    await prisma.membroCasal.update({ where: { id: par.membroId }, data: { bloqueadoEm: null } });
  } else if (s.tipo !== "liberado" && !par.bloqueadoEm) {
    await prisma.membroCasal.updateMany({ where: { id: par.membroId, bloqueadoEm: null }, data: { bloqueadoEm: agora } });
  }
  return s;
}

// ---------------------------------------------------------------------------------------------
// Lado da titular: convidar, mandar de novo, cancelar, remover.
// ---------------------------------------------------------------------------------------------

export type ConviteParaTitular = {
  id: string;
  nomePar: string;
  estado: EstadoDoConvite;
  canal: CanalDoConvite | null;
  enviadoEm: Date | null;
  criadoEm: Date;
  expiraEm: Date;
};

export type ParParaTitular = { nome: string; letra: "A" | "B"; entrouEm: Date; email: string };

export type NosDoisDaTitular = {
  par: ParParaTitular | null;
  convite: ConviteParaTitular | null;
  casalValendo: boolean;
  config: ConfigCasal;
};

function exigirTitularDoCasal(ctx: AuthContext): void {
  if (ctx.par) throw new ErroDoConvite("Só quem paga o Casal pode fazer isso.");
  if (ctx.profileKind !== "CASAL") throw new ErroDoConvite("Isso é só do perfil Casal.");
}

export class ErroDoConvite extends Error {}

export async function nosDoisDaTitular(ctx: AuthContext, agora: Date = new Date()): Promise<NosDoisDaTitular> {
  const [perfil, membro, convite, casalValendo] = await Promise.all([
    prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { casal: true } }),
    prisma.membroCasal.findFirst({ where: { profileId: ctx.profileId, saiuEm: null }, select: { letra: true, entrouEm: true, user: { select: { name: true, email: true } } } }),
    prisma.conviteCasal.findFirst({
      where: { profileId: ctx.profileId, userId: ctx.userId, status: "aberto" },
      orderBy: { createdAt: "desc" },
      select: { id: true, nomePar: true, status: true, canal: true, enviadoEm: true, createdAt: true, expiraEm: true },
    }),
    casalDaTitularValendo(ctx.userId, agora),
  ]);
  const config = lerConfigCasal(perfil?.casal ?? null);
  return {
    config,
    casalValendo,
    par: membro
      ? {
          nome: (membro.letra === "A" ? config.nomeA : config.nomeB) || primeiroNome(membro.user.name, membro.user.email.split("@")[0]),
          letra: membro.letra === "A" ? "A" : "B",
          entrouEm: membro.entrouEm,
          email: membro.user.email,
        }
      : null,
    convite: convite
      ? {
          id: convite.id,
          nomePar: convite.nomePar,
          estado: estadoDoConvite(convite, agora),
          canal: (convite.canal as CanalDoConvite | null) ?? null,
          enviadoEm: convite.enviadoEm,
          criadoEm: convite.createdAt,
          expiraEm: convite.expiraEm,
        }
      : null,
  };
}

/**
 * Cria o convite (ou "Mandar de novo": o anterior para de valer na mesma transação). Devolve o
 * código UMA vez: o banco só guarda o hash, então o link não pode ser remontado depois.
 */
export async function criarConvite(ctx: AuthContext, nomePar: string, agora: Date = new Date()): Promise<{ token: string; expiraEm: Date; nomePar: string }> {
  exigirTitularDoCasal(ctx);
  if (!nomePar) throw new ErroDoConvite("Escreva o nome do seu par.");
  if (!(await casalDaTitularValendo(ctx.userId, agora))) throw new ErroDoConvite("Libere o Casal para convidar o seu par.");
  const jaTem = await prisma.membroCasal.findFirst({ where: { profileId: ctx.profileId, saiuEm: null }, select: { id: true } });
  if (jaTem) throw new ErroDoConvite("Este Nós dois já tem um par. Um par por vez.");
  if (!(await reservarEnvio(ctx.userId, "convite-casal", LIMITES_DO_CONVITE))) {
    throw new ErroDoConvite("Muitos convites seguidos. Espere um pouco e tente de novo.");
  }
  const perfil = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { casal: true } });
  if (!perfil) throw new ErroDoConvite("Perfil não encontrado.");
  const letra = letraDoPar(lerConfigCasal(perfil.casal), nomePar);
  const { token, hash } = gerarTokenDoConvite();
  const expiraEm = new Date(agora.getTime() + VALIDADE_DO_CONVITE_MS);
  try {
    await prisma.$transaction([
      prisma.conviteCasal.updateMany({ where: { profileId: ctx.profileId, status: "aberto" }, data: { status: "substituido", encerradoEm: agora } }),
      prisma.conviteCasal.create({ data: { profileId: ctx.profileId, userId: ctx.userId, nomePar, letra, tokenHash: hash, expiraEm, createdAt: agora } }),
    ]);
  } catch (e) {
    // Dois toques ao mesmo tempo: o índice de "um aberto por perfil" barra o segundo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroDoConvite("Já estou criando um convite. Tente de novo em instantes.");
    throw e;
  }
  return { token, expiraEm, nomePar };
}

/** Por onde ela mandou (e o nome, se mudou na folha). Só no convite aberto do perfil dela. */
export async function registrarEnvio(ctx: AuthContext, canal: CanalDoConvite, nomePar: string | null, agora: Date = new Date()): Promise<void> {
  exigirTitularDoCasal(ctx);
  await prisma.conviteCasal.updateMany({
    where: { profileId: ctx.profileId, userId: ctx.userId, status: "aberto" },
    data: { canal, enviadoEm: agora, ...(nomePar ? { nomePar } : {}) },
  });
}

export async function cancelarConvite(ctx: AuthContext, agora: Date = new Date()): Promise<number> {
  exigirTitularDoCasal(ctx);
  const r = await prisma.conviteCasal.updateMany({ where: { profileId: ctx.profileId, userId: ctx.userId, status: "aberto" }, data: { status: "cancelado", encerradoEm: agora } });
  return r.count;
}

/** A titular tira o par. O histórico fica com ela; o par perde o acesso na requisição seguinte. */
export async function removerPar(ctx: AuthContext, agora: Date = new Date()): Promise<number> {
  exigirTitularDoCasal(ctx);
  const dono = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { id: true } });
  if (!dono) return 0;
  const r = await prisma.membroCasal.updateMany({ where: { profileId: ctx.profileId, saiuEm: null }, data: { saiuEm: agora, motivoSaida: "removido" } });
  return r.count;
}

export async function definirMostrarRenda(ctx: AuthContext, mostrar: boolean): Promise<void> {
  exigirTitularDoCasal(ctx);
  const perfil = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { casal: true } });
  if (!perfil) throw new ErroDoConvite("Perfil não encontrado.");
  const config = lerConfigCasal(perfil.casal);
  const { mostrarRenda: _antes, ...resto } = config;
  void _antes;
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId }, data: { casal: mostrar ? { ...resto, mostrarRenda: true } : resto } });
}

// ---------------------------------------------------------------------------------------------
// Lado do par: abrir o link, aceitar, sair.
// ---------------------------------------------------------------------------------------------

export type ConviteNaTela = {
  tela: TelaDoConvite;
  nomeTitular: string;
  nomePar: string;
  letraPar: "A" | "B";
  expiraEm: Date | null;
  tema: string;
  /** Quem está logada (para "Você está como ..."). */
  emailDoVisitante: string | null;
};

/** O que a página /par/<código> mostra, para quem abriu (logada ou não). */
export async function lerConviteParaTela(token: string, visitanteId: string | null, agora: Date = new Date()): Promise<ConviteNaTela> {
  const vazio: ConviteNaTela = { tela: "invalido", nomeTitular: "", nomePar: "", letraPar: "B", expiraEm: null, tema: "padrao", emailDoVisitante: null };
  const visitante = visitanteId
    ? await prisma.user.findUnique({
        where: { id: visitanteId },
        select: { id: true, email: true, membrosCasal: { where: { saiuEm: null }, select: { profileId: true }, take: 1 } },
      })
    : null;
  const emailDoVisitante = visitante?.email ?? null;
  if (!tokenTemFormato(token)) return { ...vazio, emailDoVisitante };
  const c = await prisma.conviteCasal.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: {
      status: true,
      expiraEm: true,
      userId: true,
      profileId: true,
      aceitoPorId: true,
      nomePar: true,
      letra: true,
      profile: { select: { kind: true, theme: true, casal: true, user: { select: { name: true, email: true } } } },
    },
  });
  if (!c || c.profile.kind !== "CASAL") return { ...vazio, emailDoVisitante };
  const [parAtivo, casalValendo] = await Promise.all([
    prisma.membroCasal.findFirst({ where: { profileId: c.profileId, saiuEm: null }, select: { userId: true } }),
    casalDaTitularValendo(c.userId, agora),
  ]);
  const letra = c.letra === "A" ? "A" : "B";
  const config = lerConfigCasal(c.profile.casal);
  const tela = decidirTela({
    convite: c,
    agora,
    casalValendo,
    parAtivoDoPerfil: parAtivo?.userId ?? null,
    visitante: visitante ? { userId: visitante.id, casalAtivoProfileId: visitante.membrosCasal[0]?.profileId ?? null } : null,
  });
  return {
    tela,
    nomeTitular: nomeDaTitular(config, letra, c.profile.user.name, c.profile.user.email),
    nomePar: c.nomePar,
    letraPar: letra,
    expiraEm: c.expiraEm,
    tema: c.profile.theme,
    emailDoVisitante,
  };
}

export type NovaContaDoPar = { nome: string; email: string; senha: string };

/**
 * Aceita o convite: com uma conta que já existe (`userId`) ou criando a do par (`novaConta`), tudo
 * numa transação. O convite só passa de "aberto" para "aceito" se ainda estiver aberto e no
 * prazo naquele instante (updateMany condicional): dois aceites ao mesmo tempo, um só vence. Se
 * qualquer passo falhar, a conta nova também não fica criada.
 */
export async function aceitarConvite(
  entrada: { token: string; termosVersao?: string } & ({ userId: string } | { novaConta: NovaContaDoPar }),
  agora: Date = new Date(),
): Promise<{ ok: true; userId: string } | { ok: false; tela: TelaDoConvite | "email-em-uso" }> {
  if (!tokenTemFormato(entrada.token)) return { ok: false, tela: "invalido" };
  const c = await prisma.conviteCasal.findUnique({
    where: { tokenHash: hashDoToken(entrada.token) },
    select: { id: true, status: true, expiraEm: true, userId: true, profileId: true, letra: true, nomePar: true, aceitoPorId: true, profile: { select: { kind: true } } },
  });
  if (!c || c.profile.kind !== "CASAL") return { ok: false, tela: "invalido" };
  const visitanteId = "userId" in entrada ? entrada.userId : null;
  const [casalValendo, parAtivo, casalDoVisitante] = await Promise.all([
    casalDaTitularValendo(c.userId, agora),
    prisma.membroCasal.findFirst({ where: { profileId: c.profileId, saiuEm: null }, select: { userId: true } }),
    visitanteId ? prisma.membroCasal.findFirst({ where: { userId: visitanteId, saiuEm: null }, select: { profileId: true } }) : null,
  ]);
  const tela = decidirTela({
    convite: c,
    agora,
    casalValendo,
    parAtivoDoPerfil: parAtivo?.userId ?? null,
    visitante: visitanteId ? { userId: visitanteId, casalAtivoProfileId: casalDoVisitante?.profileId ?? null } : null,
  });
  if (tela !== "entrar" && tela !== "aceitar-logado") return { ok: false, tela };

  const senhaHash = "novaConta" in entrada ? await bcrypt.hash(entrada.novaConta.senha, 10) : null;
  try {
    const userId = await prisma.$transaction(async (tx) => {
      let id = visitanteId;
      if ("novaConta" in entrada) {
        const email = normalizeEmail(entrada.novaConta.email);
        const existe = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
        if (existe) throw new ErroDeAceite("email-em-uso");
        // Sem perfil próprio: o par entra pelo vínculo. Sem /comecar: ele cai direto no Nós dois.
        // Conta nova da versão nova: o "Tivemos uma mudança" (que é para quem já usava) não abre.
        const u = await tx.user.create({
          data: { email, name: entrada.novaConta.nome, passwordHash: senhaHash!, onboardedAt: agora, theme: "light", novidadesVersaoNova: MARCA_DO_TOUR_NA_CONTA_NOVA, novidadesVistasEm: agora },
        });
        id = u.id;
      }
      const virou = await tx.conviteCasal.updateMany({
        where: { id: c.id, status: "aberto", expiraEm: { gt: agora } },
        data: { status: "aceito", aceitoEm: agora, aceitoPorId: id },
      });
      if (virou.count !== 1) throw new ErroDeAceite("usado");
      // Casal simples (decisão de 13/10/2026): o convite novo já nasce no modelo simples. Cada um
      // no próprio Pessoal: o do par (o que ele já tem, ou um novo) e o da titular.
      const perfilPar = await garantirPessoalDoPar(id!, tx);
      const perfilTitular = await garantirPessoalDaTitular(tx, c.userId, c.profileId);
      // O que ela já lançou no perfil Casal antes do convite vai junto para o Pessoal dela.
      await levarDadosDoCasalParaOPessoal(tx, c.userId, c.profileId, perfilTitular);
      await tx.membroCasal.create({
        data: {
          profileId: c.profileId,
          userId: id!,
          letra: c.letra === "A" ? "A" : "B",
          entrouEm: agora,
          termosVersao: entrada.termosVersao ?? TERMOS_DO_PAR_VERSAO,
          termosAceitosEm: agora,
          conviteId: c.id,
          modelo: "simples",
          perfilTitularId: perfilTitular,
          perfilParId: perfilPar.id,
        },
      });
      // Quem já tinha conta e nunca passou pelo começo não é mandado pra lá: cai no Nós dois.
      // Quem nunca passou pelo começo também nunca usou a versão antiga: sem "Tivemos uma mudança".
      await tx.user.updateMany({ where: { id: id!, onboardedAt: null, novidadesVersaoNova: null }, data: { novidadesVersaoNova: MARCA_DO_TOUR_NA_CONTA_NOVA, novidadesVistasEm: agora } });
      await tx.user.updateMany({ where: { id: id!, onboardedAt: null }, data: { onboardedAt: agora } });
      // Os nomes do casal ainda de fábrica ("Pessoa 1/2") ganham os nomes de verdade: o do
      // convite para o par e o da conta para a titular. Nome que ela já escreveu não muda.
      const perfil = await tx.financialProfile.findUnique({ where: { id: c.profileId }, select: { casal: true, user: { select: { name: true } } } });
      if (perfil) {
        const config = lerConfigCasal(perfil.casal);
        const letraPar = c.letra === "A" ? "A" : "B";
        const chavePar = letraPar === "A" ? "nomeA" : "nomeB";
        const chaveTitular = letraPar === "A" ? "nomeB" : "nomeA";
        const novo = { ...config };
        const nomeDoConvite = nomeDadoAoPar(c.nomePar) || primeiroNome("novaConta" in entrada ? entrada.novaConta.nome : null, "");
        // Par novo depois de outro que saiu (ou foi tirado): o nome guardado é do par de antes. Sem
        // isso a pessoa nova entrava e via o acerto entre "Lucas" e a titular, com a inicial dele.
        const teveOutroPar = await tx.membroCasal.findFirst({ where: { profileId: c.profileId, saiuEm: { not: null }, NOT: { userId: id! } }, select: { id: true } });
        if (teveOutroPar) novo[chavePar] = (nomeDoConvite || `Pessoa ${letraPar === "A" ? 1 : 2}`).slice(0, 30);
        else if (/^Pessoa [12]$/.test(config[chavePar]) && nomeDoConvite) novo[chavePar] = nomeDoConvite.slice(0, 30);
        if (/^Pessoa [12]$/.test(config[chaveTitular]) && perfil.user.name) novo[chaveTitular] = primeiroNome(perfil.user.name).slice(0, 30);
        if (novo.nomeA !== config.nomeA || novo.nomeB !== config.nomeB) await tx.financialProfile.update({ where: { id: c.profileId }, data: { casal: novo } });
      }
      return id!;
    });
    return { ok: true, userId };
  } catch (e) {
    if (e instanceof ErroDeAceite) return { ok: false, tela: e.tela };
    // Índices parciais: o par já entrou (outro aceite ganhou) ou a pessoa já está em outro casal.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const alvo = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
      return { ok: false, tela: alvo.includes("userId") || alvo.includes("por_pessoa") ? "em-outro-casal" : "ja-tem-par" };
    }
    throw e;
  }
}

/**
 * O Pessoal da titular na casa nova. O perfil Casal de onde saiu o convite some do menu (fase 6):
 * se era ele o aberto, o Pessoal passa a ser.
 */
async function garantirPessoalDaTitular(tx: Prisma.TransactionClient, titularId: string, casalId: string): Promise<string> {
  const { id } = await garantirPessoalDoPar(titularId, tx);
  const casal = await tx.financialProfile.findUnique({ where: { id: casalId }, select: { isDefault: true } });
  if (casal?.isDefault) {
    await tx.financialProfile.updateMany({ where: { userId: titularId, isDefault: true }, data: { isDefault: false } });
    await tx.financialProfile.update({ where: { id }, data: { isDefault: true } });
  }
  return id;
}

class ErroDeAceite extends Error {
  constructor(public tela: TelaDoConvite | "email-em-uso") {
    super(tela);
  }
}

/** O par sai do Nós dois. O histórico fica com a titular; ele ainda baixa o que lançou por 90 dias. */
export async function sairDoCasal(ctx: AuthContext, agora: Date = new Date()): Promise<number> {
  if (!ctx.par) throw new ErroDoConvite("Só o par sai do Nós dois. Para tirar o par, use Remover.");
  const r = await prisma.membroCasal.updateMany({ where: { id: ctx.par.membroId, userId: ctx.userId, profileId: ctx.profileId, saiuEm: null }, data: { saiuEm: agora, motivoSaida: "saiu" } });
  return r.count;
}

/** O vínculo mais recente da conta como par (ativo ou que saiu), para a cópia dos 90 dias. */
export async function ultimoVinculoComoPar(userId: string) {
  return prisma.membroCasal.findFirst({
    where: { userId },
    orderBy: { entrouEm: "desc" },
    select: { id: true, profileId: true, letra: true, saiuEm: true, bloqueadoEm: true, modelo: true, perfilParId: true, profile: { select: { userId: true, casal: true, user: { select: { name: true, email: true } } } } },
  });
}

// ---------------------------------------------------------------------------------------------
// Página pública: limite por origem.
// ---------------------------------------------------------------------------------------------

/** Conta uma tentativa da origem e diz se cabe. Faxina do que já saiu da janela, na mesma ida. */
export async function tentativaNaPaginaDoConvite(chave: string, agora: Date = new Date()): Promise<boolean> {
  const desde = new Date(agora.getTime() - LIMITE_DA_PAGINA.janelaMs);
  await prisma.tentativaDoConvite.deleteMany({ where: { chave, em: { lt: desde } } });
  const anteriores = await prisma.tentativaDoConvite.findMany({ where: { chave, em: { gte: desde } }, select: { em: true } });
  if (!cabeMaisUmaTentativa(anteriores.map((a) => a.em), agora)) return false;
  await prisma.tentativaDoConvite.create({ data: { chave, em: agora } });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Rotina diária: Casal sem renovar.
// ---------------------------------------------------------------------------------------------

/**
 * Para cada par ativo: marca o dia em que o Casal da titular parou de valer (ou desmarca, se ela
 * renovou) e tira de vez quem passou 90 dias assim. Depois, o "só meu" de quem saiu há mais de
 * 90 dias é apagado (o resto do histórico é da titular e fica com ela).
 */
export async function limparParesVencidos(agora: Date = new Date()): Promise<{ pausados: number; retomados: number; encerrados: number; soMeuApagados: number }> {
  const ativos = await prisma.membroCasal.findMany({ where: { saiuEm: null }, select: { id: true, bloqueadoEm: true, profile: { select: { userId: true } } } });
  let pausados = 0;
  let retomados = 0;
  let encerrados = 0;
  for (const m of ativos) {
    const valendo = await casalDaTitularValendo(m.profile.userId, agora);
    const s = decidirSituacaoDoPar({ titularAtiva: valendo, temAdicional: valendo, bloqueadoEm: m.bloqueadoEm, agora });
    if (s.tipo === "liberado") {
      if (m.bloqueadoEm) {
        await prisma.membroCasal.update({ where: { id: m.id }, data: { bloqueadoEm: null } });
        retomados++;
      }
    } else if (s.tipo === "encerrado") {
      await prisma.membroCasal.update({ where: { id: m.id }, data: { saiuEm: agora, motivoSaida: "casal_vencido" } });
      encerrados++;
    } else if (!m.bloqueadoEm) {
      await prisma.membroCasal.update({ where: { id: m.id }, data: { bloqueadoEm: agora } });
      pausados++;
    }
  }
  const limite = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);
  const sairam = await prisma.membroCasal.findMany({ where: { saiuEm: { lt: limite } }, select: { userId: true, profileId: true } });
  let soMeuApagados = 0;
  for (const s of sairam) {
    // Ainda é par deste perfil de novo (voltou por outro convite)? Então o só meu é dele e fica.
    const voltou = await prisma.membroCasal.findFirst({ where: { userId: s.userId, profileId: s.profileId, saiuEm: null }, select: { id: true } });
    if (voltou) continue;
    const r = await prisma.monthlyEntry.deleteMany({ where: { userId: s.userId, profileId: s.profileId } });
    soMeuApagados += r.count;
  }
  return { pausados, retomados, encerrados, soMeuApagados };
}

/** Dono do registro + o outro nome, para o par e a titular aparecerem com cor e inicial. */
export function letrasDoCasal(par: { letra: "A" | "B" } | null): { minha: "A" | "B"; outra: "A" | "B" } {
  const minha = par ? par.letra : "A";
  return { minha, outra: outraLetra(minha) };
}
