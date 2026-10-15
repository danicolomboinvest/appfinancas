import { prisma } from "@/lib/db/prisma";
import { CONFIRMACAO_DESDE } from "@/lib/auth/confirmacao-email";
import { casaDoUsuario } from "@/lib/repositories/casa.repo";
import { contasQueUsamOApp, normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { contasEmail } from "@/lib/email/templates";
import { makeMoneyFormatter, toCurrencyCode } from "@/lib/money";
import { carregarRespostasDeAssinatura } from "./respostas";
import { chaveDaIdentidade, estadoDaAssinatura } from "./regra";
import { TIPO_DO_LEMBRETE, avisoDeHoje, lembreteQueVale, textoDoAviso, type AvisoDoLembrete } from "./lembrete";
import { carregarLembretes, historicoDasCobrancas, respondidasAindaNao } from "./lembretes";

/**
 * Manda os lembretes de cancelar (lembrete.ts), dentro do cron das contas (8h de Brasília, o mesmo
 * dos lembretes de conta): na véspera da cobrança, ou no dia se a véspera não saiu, e a pergunta
 * "Cancelou?" quando o dia passou e a cobrança não veio. Push para quem tem; quem não tem ganha
 * e-mail. Cada aviso tem uma trava no NotificationLog (uma por ciclo) e só vira "já avisado" o
 * que chegou de fato, como nas contas.
 */

const URL_DO_RAIOX = "/decidir/raio-x";

export type ResultadoDosLembretes = { pessoas: number; pushed: number; mailed: number; preview: { email: string; avisos: string[] }[] };

type Mensagem = { chave: string; titulo: string; corpo: string; nome: string; valor: number | null; aviso: AvisoDoLembrete };

export async function enviarLembretesDeAssinatura(opcoes: { hoje: Date; dryRun?: boolean; onlyEmail?: string; baseUrl: string }): Promise<ResultadoDosLembretes> {
  const { hoje, dryRun = false, onlyEmail, baseUrl } = opcoes;
  // Quem pediu algum lembrete (cada um no seu perfil): só essas pessoas são olhadas.
  const donos = await prisma.decisao.findMany({
    where: {
      tipo: TIPO_DO_LEMBRETE,
      descricao: "ligar",
      profileId: { not: null },
      user: { OR: [{ emailVerifiedAt: { not: null } }, { createdAt: { lt: CONFIRMACAO_DESDE } }], ...(onlyEmail ? { email: onlyEmail } : {}) },
    },
    distinct: ["userId", "profileId"],
    select: { userId: true, profileId: true, user: { select: { id: true, email: true, name: true, role: true, currency: true, createdAt: true } }, profile: { select: { theme: true } } },
  });
  const res: ResultadoDosLembretes = { pessoas: 0, pushed: 0, mailed: 0, preview: [] };
  if (donos.length === 0) return res;
  // Reembolso ou cancelamento: o app nem abre para ela.
  const comAcesso = await contasQueUsamOApp(donos.map((d) => d.user));

  for (const d of donos) {
    const user = d.user;
    if (user.role !== "ADMIN" && !comAcesso.has(normalizeEmail(user.email))) continue;
    const dono = { userId: d.userId, profileId: d.profileId as string };
    const lembretes = await carregarLembretes(dono);
    if (lembretes.length === 0) continue;
    // O estado único da assinatura (com o do outro da casa, que pode ter dito "Cancelei mesmo").
    const respostas = await carregarRespostasDeAssinatura({ ...dono, casa: await casaDoUsuario(d.userId) });

    // A linha mais recente de cada assinatura (pela chave da identidade).
    const porAssinatura = new Map<string, (typeof lembretes)[number]>();
    for (const l of lembretes) porAssinatura.set(chaveDaIdentidade(l.marcas), l);
    const valem = [...porAssinatura.values()].filter((l) => {
      if (!l.ligado || !l.dia) return false;
      const estado = estadoDaAssinatura(l.marcas, respostas.eventos, l.marcas.some((m) => respostas.daCasa.has(m)));
      return lembreteQueVale(l.marcas, lembretes, estado)?.id === l.id;
    });
    if (valem.length === 0) continue;

    const chavesDoRaioX = valem.map((l) => l.raiox).filter((k): k is string => Boolean(k));
    const [h, aindaNao] = await Promise.all([historicoDasCobrancas(dono, chavesDoRaioX, hoje), respondidasAindaNao(dono, hoje)]);
    const money = makeMoneyFormatter(toCurrencyCode(user.currency));
    const candidatas: Mensagem[] = [];
    for (const l of valem) {
      const nome = l.nome ?? "Assinatura";
      const aviso = avisoDeHoje(chaveDaIdentidade(l.marcas), l, hoje, l.raiox ? { cobrancas: h.reais.get(l.raiox) ?? [], dadosAte: h.dadosAte, respondeuAindaNao: aindaNao.has(l.raiox) } : null);
      if (!aviso) continue;
      const t = textoDoAviso(aviso.quando, nome, l.valor ? money(l.valor) : null);
      candidatas.push({ chave: aviso.chave, ...t, nome, valor: aviso.quando === "pergunta" ? null : l.valor, aviso });
    }
    if (candidatas.length === 0) continue;
    const ja = await prisma.notificationLog.findMany({ where: { userId: d.userId, key: { in: candidatas.map((c) => c.chave) } }, select: { key: true } });
    const vistos = new Set(ja.map((j) => j.key));
    const novas = candidatas.filter((c) => !vistos.has(c.chave));
    if (novas.length === 0) continue;
    res.pessoas += 1;
    res.preview.push({ email: user.email, avisos: novas.map((n) => `${n.titulo}. ${n.corpo}`) });
    if (dryRun) continue;

    const entregues: string[] = [];
    if (isPushConfigured()) {
      for (const n of novas) {
        if ((await sendPushToUser(d.userId, { title: n.titulo, body: n.corpo, url: URL_DO_RAIOX, tag: n.chave })) > 0) entregues.push(n.chave);
      }
    }
    if (entregues.length > 0) res.pushed += 1;
    else if (isEmailConfigured()) {
      const { subject, html } = contasEmail({
        name: user.name,
        t: {
          contasEmailAssunto: (nome: string) => nome,
          contasEmailIntro: novas[0].corpo,
          contasEmailBotao: "Abrir o Raio-X",
          contasEmailRodape: "Você recebe este lembrete porque pediu no Raio-X. Para desligar, toque de novo no botão do lembrete.",
        },
        contas: novas.map((n) => ({ nome: n.nome, titulo: n.titulo, corpo: n.corpo, valor: n.valor, vencimento: n.aviso.quando === "pergunta" ? undefined : n.aviso.cobranca })),
        url: `${baseUrl}${URL_DO_RAIOX}`,
        tema: d.profile?.theme,
        moeda: toCurrencyCode(user.currency),
      });
      const r = await sendEmail({ to: user.email, subject, html });
      if (r.ok) {
        res.mailed += 1;
        entregues.push(...novas.map((n) => n.chave));
      }
    }
    if (entregues.length > 0) await prisma.notificationLog.createMany({ data: entregues.map((key) => ({ userId: d.userId, key })), skipDuplicates: true });
  }
  return res;
}
