import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { Titulos } from "@/lib/profiles/voice";

/**
 * Templates de e-mail (HTML inline, clientes de e-mail não entendem CSS externo).
 * Visual sóbrio, com o dourado da marca SPI Finance.
 */

const GOLD = "#c8a86a";
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";

/** Moldura padrão: cabeçalho com a marca + corpo + rodapé. */
function shell(bodyHtml: string): string {
  return `
  <div style="margin:0;padding:24px;background:#f4f2ec;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
      <div style="padding:24px 28px;border-bottom:1px solid #f0f0f0;">
        <span style="font-size:18px;font-weight:700;color:${INK};letter-spacing:-0.3px;">SPI</span><span style="font-size:18px;font-weight:400;color:${GOLD};"> Finance</span>
      </div>
      <div style="padding:28px;color:${INK};font-size:15px;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 28px;border-top:1px solid #f0f0f0;color:${MUTED};font-size:12px;line-height:1.5;">
        SPI Finance, sua vida financeira em um só lugar.<br/>
        Se você não reconhece este e-mail, pode ignorá-lo com segurança.
      </div>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">${label}</a>`;
}


/** O e-mail sai na moeda que a pessoa escolheu em Configurações, igual à tela. */
function money(value: number, currency: CurrencyCode): string {
  return formatMoney(value, currency, { round: true });
}

/** Linha "rótulo … valor" do quadro de números do resumo. */
function statRow(label: string, value: string, color = INK): string {
  return `<tr>
    <td style="padding:7px 0;color:${MUTED};font-size:14px;">${label}</td>
    <td style="padding:7px 0;text-align:right;color:${color};font-size:15px;font-weight:600;">${value}</td>
  </tr>`;
}

/**
 * Resumo do mês — o único e-mail recorrente do app, enviado no começo de cada mês pra quem
 * teve movimento no mês anterior.
 *
 * O objetivo é dar um motivo pra voltar: mostra o número que interessa (quanto sobrou), a
 * comparação com o mês anterior e a categoria que mais pesou, e só. Quem quiser detalhe clica
 * — o e-mail não tenta ser a tela, senão vira relatório que ninguém lê.
 */
export function monthlyRecapEmail(params: {
  name: string | null;
  /** "Setembro de 2026" */
  monthLabel: string;
  income: number;
  expense: number;
  /** Aportes do mês — tiram dinheiro do bolso igual aos gastos, e entram na conta do saldo. */
  investment: number;
  balance: number;
  /** Variação do gasto vs. mês anterior (0,17 = 17% a mais); null quando não há base. */
  expenseDelta: number | null;
  topCategory: { label: string; value: number } | null;
  currency: CurrencyCode;
  appUrl: string;
  preferencesUrl: string;
  /** A voz do tema do perfil ativo da pessoa — cada frase sai no jeito de falar do tema dela. */
  t: Titulos;
}): { subject: string; html: string } {
  const { t } = params;
  const firstName = params.name?.split(" ")[0];
  const hi = t.emailSaudacao(firstName);
  const positive = params.balance >= 0;

  // A manchete do e-mail é a comparação, não o valor solto: "sobrou R$ 2.378" não diz se foi
  // um bom mês; "e você gastou 12% menos que no mês passado" diz.
  const deltaLine =
    params.expenseDelta === null
      ? t.emailRecapPrimeiroMes
      : Math.abs(params.expenseDelta) < 0.08
        ? t.emailRecapGastosIguais
        : params.expenseDelta < 0
          ? t.emailRecapGastosMenos(`<strong style="color:#2e7d5b;">${Math.round(Math.abs(params.expenseDelta) * 100)}% menos</strong>`)
          : t.emailRecapGastosMais(`<strong style="color:#c0523c;">${Math.round(params.expenseDelta * 100)}% acima</strong>`);

  return {
    subject: t.emailRecapAssunto(params.monthLabel),
    html: shell(`
      <p style="margin:0 0 6px;">${hi}</p>
      <p style="margin:0 0 20px;color:${MUTED};">${t.emailRecapIntro(params.monthLabel)}</p>

      <div style="background:#faf8f3;border:1px solid #f0ece2;border-radius:12px;padding:18px 20px;margin:0 0 20px;">
        <p style="margin:0 0 2px;color:${MUTED};font-size:13px;">${positive ? t.emailRecapSobrou : t.emailRecapFaltou}</p>
        <p style="margin:0;font-size:30px;font-weight:700;color:${positive ? INK : "#c0523c"};letter-spacing:-0.5px;">
          ${money(Math.abs(params.balance), params.currency)}
        </p>
      </div>

      <p style="margin:0 0 18px;">${deltaLine}</p>

      <!-- As DUAS saídas aparecem. Sem a linha de aportes, quem lia "entrou 12, saiu 8" e via
           um saldo de -7 não tinha como fechar a conta — o número que faltava estava fora do
           e-mail. -->
      <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
        ${statRow(t.entrou, money(params.income, params.currency), "#2e7d5b")}
        ${statRow(t.gastou, money(params.expense, params.currency), "#c0523c")}
        ${params.investment > 0 ? statRow(t.aportou, money(params.investment, params.currency), "#8a6414") : ""}
        ${params.topCategory ? statRow(`${t.emailMaiorGasto}: ${params.topCategory.label}`, money(params.topCategory.value, params.currency)) : ""}
      </table>

      <p style="margin:24px 0 0;">${button(params.appUrl, t.emailRecapBotao)}</p>

      <p style="margin:22px 0 0;color:${MUTED};font-size:12px;line-height:1.5;">
        ${t.emailRecapRodape}
        <a href="${params.preferencesUrl}" style="color:${MUTED};">Desativar</a> quando quiser.
      </p>
    `),
  };
}

/**
 * Convite pra começar — vai no mesmo dia 1º, pra quem NÃO teve movimento no mês. É o e-mail
 * que fala com a maior parte da base: gente que criou conta e nunca voltou.
 *
 * Tom é o que decide se isso ajuda ou irrita. Nada de "você não fez", "você está atrasada",
 * contador de dias perdidos ou culpa — o pedido é de UM gasto, porque a barreira real não é
 * preguiça, é a tarefa parecer grande. Uma ação, um clique, sem cobrança.
 */
export function monthlyNudgeEmail(params: {
  name: string | null;
  /** Mês que está começando, ex.: "outubro". */
  newMonthLabel: string;
  appUrl: string;
  preferencesUrl: string;
  /** A voz do tema do perfil ativo da pessoa — cada frase sai no jeito de falar do tema dela. */
  t: Titulos;
}): { subject: string; html: string } {
  const { t } = params;
  const firstName = params.name?.split(" ")[0];
  const hi = t.emailSaudacao(firstName);

  return {
    subject: t.emailConviteAssunto(params.newMonthLabel),
    html: shell(`
      <p style="margin:0 0 12px;">${hi}</p>
      <p style="margin:0 0 16px;">
        ${t.emailConviteIntro1(params.newMonthLabel)}
      </p>
      <p style="margin:0 0 20px;">
        ${t.emailConviteIntro2}
      </p>

      <p style="margin:0 0 4px;">${button(params.appUrl, t.emailConviteBotao)}</p>

      <p style="margin:22px 0 0;color:${MUTED};font-size:12px;line-height:1.5;">
        Se preferir não receber esses lembretes,
        <a href="${params.preferencesUrl}" style="color:${MUTED};">desative aqui</a>.
      </p>
    `),
  };
}

/** E-mail de recuperação de senha. */
export function passwordResetEmail(params: { name: string | null; resetUrl: string }): { subject: string; html: string } {
  const hi = params.name ? `Oi, ${params.name}!` : "Oi!";
  return {
    subject: "Redefinir sua senha · SPI Finance",
    html: shell(`
      <p style="margin:0 0 12px;">${hi}</p>
      <p style="margin:0 0 20px;">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma senha nova:</p>
      <p style="margin:0 0 24px;">${button(params.resetUrl, "Criar nova senha")}</p>
      <p style="margin:0 0 8px;color:${MUTED};font-size:13px;">Este link vale por 1 hora e só pode ser usado uma vez.</p>
      <p style="margin:0;color:${MUTED};font-size:13px;">Se você não pediu isso, ignore este e-mail, sua senha continua a mesma.</p>
    `),
  };
}

/**
 * E-mail de "acesso liberado": a pessoa comprou (ou a Dani liberou na mão) mas ainda não tem
 * conta — o convite é pra ela se cadastrar usando ESTE e-mail (é ele que está na allowlist;
 * com outro e-mail o cadastro é bloqueado).
 */
export function accessGrantedEmail(params: { email: string; registerUrl: string }): { subject: string; html: string } {
  return {
    subject: "Seu acesso ao SPI Finance está liberado 🎉",
    html: shell(`
      <p style="margin:0 0 12px;">Oi!</p>
      <p style="margin:0 0 20px;">Seu acesso ao <strong>SPI Finance</strong> foi liberado. Falta só criar sua conta para começar a organizar suas finanças:</p>
      <p style="margin:0 0 24px;">${button(params.registerUrl, "Criar minha conta")}</p>
      <p style="margin:0;color:${MUTED};font-size:13px;">Importante: cadastre-se usando exatamente este e-mail (<strong>${params.email}</strong>) — é ele que está autorizado.</p>
    `),
  };
}

/** E-mail de boas-vindas ao criar a conta. */
export function welcomeEmail(params: { name: string | null; appUrl: string }): { subject: string; html: string } {
  const hi = params.name ? `Bem-vinda, ${params.name}!` : "Bem-vinda!";
  return {
    subject: "Sua conta no SPI Finance está pronta 🎉",
    html: shell(`
      <p style="margin:0 0 12px;">${hi}</p>
      <p style="margin:0 0 20px;">Que bom ter você aqui. O SPI Finance junta seus gastos, orçamento, metas e investimentos num lugar só, pra você decidir com clareza.</p>
      <p style="margin:0 0 24px;">${button(params.appUrl, "Abrir o SPI Finance")}</p>
      <p style="margin:0;color:${MUTED};font-size:13px;">Primeiro passo: registre um gasto ou renda do dia. O resto flui a partir daí.</p>
    `),
  };
}

/** Avisos do meio do mês pra quem não ligou os avisos no celular: um e-mail, todos os avisos do dia. */
export function alertEmail(params: {
  name: string | null;
  alerts: { title: string; body: string; url: string }[];
  preferencesUrl: string;
}): { subject: string; html: string } {
  const firstName = params.name?.split(" ")[0];
  const hi = firstName ? `Oi, ${firstName}.` : "Oi.";
  const first = params.alerts[0];
  const subject = params.alerts.length === 1 ? first.title : `${first.title} e mais ${params.alerts.length - 1}`;
  return {
    subject,
    html: shell(`
      <p style="margin:0 0 16px;">${hi}</p>
      ${params.alerts
        .map(
          (a) => `
      <p style="margin:0 0 4px;"><strong>${a.title}</strong></p>
      <p style="margin:0 0 6px;">${a.body}</p>
      <p style="margin:0 0 18px;"><a href="${a.url}" style="color:${MUTED};">Ver no app</a></p>`,
        )
        .join("")}
      <p style="margin:22px 0 0;color:${MUTED};font-size:12px;line-height:1.5;">
        Prefere receber isso no celular, como mensagem? Ligue os avisos em
        <a href="${params.preferencesUrl}" style="color:${MUTED};">Notificações</a>. Ou desative por lá.
      </p>
    `),
  };
}
