/**
 * O endereço do app nos links dos e-mails. O cron da Vercel chama as rotas pelo endereço interno
 * do deploy (appfinancas-<hash>.vercel.app), que pede login da Vercel: link montado a partir do
 * request não abre para o cliente (o "Criar minha conta" do lembrete caía nessa tela). Por isso,
 * fora do computador (localhost), o link é sempre o domínio de produção.
 */
export const URL_DO_APP = (process.env.EMAIL_ASSETS_URL ?? "https://financas.danicolombo.com.br").replace(/\/+$/, "");

export function urlDoAppPara(host: string | null | undefined): string {
  const h = (host ?? "").trim();
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h)) return `http://${h}`;
  return URL_DO_APP;
}
