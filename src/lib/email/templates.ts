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
