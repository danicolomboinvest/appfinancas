import type { ProfileThemeKey } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";
import { sobrouDoMes } from "@/lib/consolidation/sobrou";
import { buildBudgetAlerts, buildGoalAlerts, metasQueChegaramLa } from "@/lib/insights/alerts";
import { ajustarResumoPorEmail } from "@/lib/recap/email-do-resumo";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import {
  accessGrantedEmail,
  alertEmail,
  codigoDaCompraEmail,
  confirmEmailEmail,
  contasEmail,
  metaAtingidaEmail,
  monthlyNudgeEmail,
  monthlyRecapEmail,
  passwordResetEmail,
  welcomeEmail,
  type EmailPronto,
} from "@/lib/email/templates";
import { boasVindasEmail, lembreteContaDia1Email, lembreteContaDia4Email, vazioDia2Email, vazioDia5Email } from "@/lib/email/boas-vindas";

/**
 * Todos os e-mails do app montados com os números da Ana canônica (seção 8 de
 * versao-nova-implementacao.md: quarta, 7 de outubro de 2026, 25 dias até o fim do mês). Serve
 * aos testes e à prévia (scripts/previa-emails.ts), que só escreve HTML em disco: nada aqui envia.
 *
 * Os números passam pelas mesmas funções do app (sobrouDoMes, buildBudgetAlerts com o
 * planoDeCobrir, metasQueChegaramLa): se a regra mudar, a prévia e o teste mudam junto.
 */

const APP = "https://financas.danicolombo.com.br";
const PREFS = `${APP}/configuracoes/notificacoes`;
const reais = (v: number) => formatMoney(v, DEFAULT_CURRENCY, { round: true });

/** Os números da Ana (ana-canonica.md, seções 1 a 3). */
export const ANA = {
  hoje: new Date(2026, 9, 7),
  entrou: 7700,
  gastou: 4059,
  guardou: 900,
  livre: 3241,
  meses: [
    { rotulo: "mai", entrou: 7700, gastou: 6900 },
    { rotulo: "jun", entrou: 7700, gastou: 7400 },
    { rotulo: "jul", entrou: 7900, gastou: 8100 },
    { rotulo: "ago", entrou: 7700, gastou: 7000 },
    { rotulo: "set", entrou: 7700, gastou: 6600 },
    { rotulo: "out", entrou: 7700, gastou: 4059 },
  ],
  plano: [
    { parentCategory: "MORADIA" as const, planned: 2700, spent: 2666 },
    { parentCategory: "ALIMENTACAO" as const, planned: 1500, spent: 360 },
    { parentCategory: "TRANSPORTE" as const, planned: 800, spent: 181 },
    { parentCategory: "LAZER" as const, planned: 600, spent: 186 },
    { parentCategory: "EDUCACAO" as const, planned: 400, spent: 249 },
    { parentCategory: "SAUDE" as const, planned: 350, spent: 417 },
  ],
  /** Compras é uma categoria criada por ela (não é categoria-mãe). */
  compras: { key: "compras-da-ana", label: "Compras", planejado: 950, gasto: 0 },
  metas: [
    { nome: "Viagem Europa 2027", guardado: 1429, alvo: 20000 },
    { nome: "Reserva de emergência", guardado: 4200, alvo: 21000 },
  ],
};

export type Exemplo = { nome: string; email: EmailPronto };

/** Os avisos de orçamento da Ana, pelo construtor de verdade. O primeiro é "Saúde passou R$ 67". */
export function avisosDaAna() {
  return buildBudgetAlerts({
    year: 2026,
    month: 10,
    today: ANA.hoje,
    planned: ANA.plano.map((p) => ({ parentCategory: p.parentCategory, planned: p.planned })),
    spent: ANA.plano.map((p) => ({ parentCategory: p.parentCategory, spent: p.spent })),
    // O aluguel foi lançado antes do mês ("Repetir todo mês"): é conta marcada, não ritmo.
    preCriado: [{ parentCategory: "MORADIA", spent: 2666 }],
    money: reais,
    outras: [ANA.compras],
    livre: ANA.livre,
  });
}

export function exemplosDeEmail(tema: ProfileThemeKey): Exemplo[] {
  const t = vozDoTema(tema).titulos;
  const resumo = (estado: "sobrou" | "faltou") => {
    const gastou = estado === "sobrou" ? ANA.gastou : 7300;
    const ajuste = ajustarResumoPorEmail(t, { income: ANA.entrou, expense: gastou, investment: ANA.guardou }, "outubro");
    return monthlyRecapEmail({
      name: "Ana Souza",
      monthLabel: "outubro de 2026",
      mesNome: "outubro",
      income: ANA.entrou,
      expense: gastou,
      investment: ANA.guardou,
      balance: ajuste.balance,
      expenseDelta: gastou / 6600 - 1,
      topCategory: { label: "Moradia", value: 2666 },
      meses: estado === "sobrou" ? ANA.meses : ANA.meses.map((m, i, a) => (i === a.length - 1 ? { ...m, gastou } : m)),
      categorias: [
        { chave: "MORADIA", nome: "Moradia", gasto: 2666, plano: 2700 },
        { chave: "SAUDE", nome: "Saúde", gasto: 417, plano: 350 },
        { chave: "ALIMENTACAO", nome: "Alimentação", gasto: estado === "sobrou" ? 360 : 1900, plano: 1500 },
      ],
      metas: ANA.metas,
      currency: DEFAULT_CURRENCY,
      appUrl: `${APP}/mensal/foco/fechamento`,
      preferencesUrl: PREFS,
      t: ajuste.t,
      tema,
    });
  };

  const [passou] = avisosDaAna();
  const perto = buildBudgetAlerts({
    year: 2026,
    month: 10,
    today: new Date(2026, 9, 19),
    planned: [{ parentCategory: "ALIMENTACAO", planned: 1200 }],
    spent: [{ parentCategory: "ALIMENTACAO", spent: 1010 }],
    money: reais,
  })[0];
  const metaAtras = buildGoalAlerts({
    year: 2026,
    month: 10,
    goals: [{ id: "europa", name: "Viagem Europa 2027", behind: true, monthly: 1340, guardado: 1429, alvo: 20000 }],
    money: reais,
  })[0];
  const [chile] = metasQueChegaramLa({
    hoje: ANA.hoje,
    goals: [{ id: "chile", name: "Viagem para o Chile", alvo: 8000, guardado: 8000, criadaEm: new Date(2026, 0, 7), temAporteNoMes: true }],
  });
  const cartao = {
    title: t.limAvisoTitulo(90, reais(300)),
    body: t.limAvisoCorpo(90, reais(2700), reais(3000), "outubro"),
    url: `${APP}/orcamento/cartao`,
    dados: { tipo: "cartao" as const, gasto: 2700, limite: 3000, mesNome: "outubro" },
  };
  const absoluto = <T extends { url: string }>(a: T): T => ({ ...a, url: `${APP}${a.url}` });

  return [
    { nome: "resumo", email: resumo("sobrou") },
    { nome: "resumo-faltou", email: resumo("faltou") },
    { nome: "convite", email: monthlyNudgeEmail({ name: "Ana", newMonthLabel: "outubro", appUrl: `${APP}/mensal`, preferencesUrl: PREFS, t, tema }) },
    { nome: "passou", email: alertEmail({ name: "Ana", alerts: [absoluto(passou)], preferencesUrl: PREFS, tema }) },
    { nome: "passou-e-mais", email: alertEmail({ name: "Ana", alerts: [absoluto(metaAtras), absoluto(passou)], preferencesUrl: PREFS, tema }) },
    { nome: "perto", email: alertEmail({ name: "Ana", alerts: [absoluto(perto)], preferencesUrl: PREFS, tema }) },
    { nome: "cartao", email: alertEmail({ name: "Ana", alerts: [cartao], preferencesUrl: PREFS, tema }) },
    {
      nome: "contas",
      email: contasEmail({
        name: "Ana",
        t,
        contas: [
          { nome: "Aluguel", titulo: t.contasLembreteTitulo("Aluguel", "vespera"), corpo: t.contasLembreteCorpo(reais(1800)), valor: 1800, vencimento: new Date(Date.UTC(2026, 9, 8)), quando: "vespera" },
          { nome: "Internet", titulo: t.contasLembreteTitulo("Internet", "dia"), corpo: t.contasLembreteCorpo(reais(120)), valor: 120, vencimento: new Date(Date.UTC(2026, 9, 7)), quando: "dia" },
        ],
        url: `${APP}/orcamento/contas`,
        tema,
      }),
    },
    { nome: "meta", email: metaAtingidaEmail({ name: "Ana", meta: chile.nome, alvo: chile.alvo, meses: chile.meses, mediaPorMes: chile.mediaPorMes, url: `${APP}/planejamento/metas/chile`, preferencesUrl: PREFS, tema }) },
    { nome: "boasvindas", email: boasVindasEmail({ name: "Ana Souza", appUrl: `${APP}/mensal`, guiaUrl: `${APP}/guia`, tema }) },
    { nome: "vazio-dia2", email: vazioDia2Email({ name: "Ana", appUrl: `${APP}/mensal`, tema }) },
    { nome: "vazio-dia5", email: vazioDia5Email({ name: "Ana", appUrl: `${APP}/mensal`, tema }) },
    { nome: "conta-dia1", email: lembreteContaDia1Email({ email: "ana@exemplo.com", registerUrl: `${APP}/register` }) },
    { nome: "conta-dia4", email: lembreteContaDia4Email({ email: "ana@exemplo.com", registerUrl: `${APP}/register` }) },
    { nome: "acesso-liberado", email: accessGrantedEmail({ email: "ana@exemplo.com", registerUrl: `${APP}/register`, tema }) },
    { nome: "confirmar-email", email: confirmEmailEmail({ name: "Ana", confirmUrl: `${APP}/confirmar-email?t=abc`, tema }) },
    { nome: "recuperar-senha", email: passwordResetEmail({ name: "Ana", resetUrl: `${APP}/redefinir-senha?token=abc`, tema }) },
    { nome: "codigo-da-compra", email: codigoDaCompraEmail({ codigo: "482913", emailDaConta: "ana@exemplo.com", tema }) },
    { nome: "conta-criada", email: welcomeEmail({ name: "Ana", appUrl: `${APP}/login`, tema }) },
  ];
}

/** Conferência rápida da regra única com os números da Ana: 7.700 − 4.059 − 900 = 2.741. */
export const SOBROU_DA_ANA = sobrouDoMes({ entrou: ANA.entrou, gastou: ANA.gastou, guardou: ANA.guardou });
