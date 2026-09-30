import { Lock, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { COURSE_CHECKOUT_URL } from "@/lib/config";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { vozDoTema } from "@/lib/profiles/voice";
import { EMAIL_DO_SUPORTE, mensagemDeAcessoTrancado } from "@/lib/support/contato";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";

/**
 * Tela de "isso é do curso" — mostrada no lugar do conteúdo real pra quem não tem acesso
 * premium (área de investimentos). Modelo freemium: qualquer um cadastra e usa a parte de
 * finanças pessoais de graça; isso aqui é o convite pra área paga, não um erro/bloqueio seco.
 *
 * Mas quem mais cai aqui não é quem nunca comprou: é quem comprou o SPI Finance e criou a conta
 * com outro e-mail (a liberação é pelo e-mail da compra). Pra essa pessoa, "é do curso" + botão de
 * compra parecia cobrança escondida, e teve pedido de reembolso minutos depois de comprar. Por
 * isso o quadro "Comprou e está vendo isso?" vem ANTES do botão do curso, com o e-mail da conta
 * (pra ela comparar com o da compra) e o contato do suporte escrito por extenso.
 *
 * Lê a sessão por conta própria pra falar na voz do tema: quem renderiza este cartão são
 * layouts e páginas de servidor que só decidem "mostra ou não", e é mais simples o cartão se
 * virar do que cada um deles passar a voz adiante.
 */
export async function PaywallCard({ feature }: { feature: string }) {
  const ctx = await getRequiredSession();
  // getOwnUser e não o e-mail do token da sessão: o do token é o do dia do login, e quem trocou o
  // e-mail no Perfil veria o antigo — justo na tela que pede pra conferir o e-mail. A consulta é
  // a mesma que o layout já fez nesta requisição (cache), então não custa uma ida a mais ao banco.
  const user = await getOwnUser(ctx).catch(() => null);
  const email = user?.email ?? null;
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const whatsapp = linkDoSuporte(mensagemDeAcessoTrancado(feature, email));

  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <Lock size={22} strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{t.uiPaywallTitulo(feature)}</h2>
        <p className="mt-1.5 text-sm text-ink-muted">{t.uiPaywallCursoTexto}</p>
      </div>

      <div className="w-full rounded-xl border border-border bg-surface-2 p-4 text-left">
        <p className="text-sm font-semibold text-ink">{t.uiPaywallComprouTitulo}</p>
        <p className="mt-1 text-sm text-ink-muted">{t.uiPaywallComprouTexto}</p>
        <dl className="mt-3 flex flex-col gap-2.5">
          {email && (
            <div>
              <dt className="text-xs text-ink-faint">{t.uiPaywallEmailDaConta}</dt>
              {/* break-all: e-mail comprido não tem onde quebrar e empurraria o cartão pra fora
                  da tela no celular. select-all: um toque seleciona o endereço inteiro. */}
              <dd className="select-all break-all text-sm font-medium text-ink">{email}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-ink-faint">{t.uiPaywallContato}</dt>
            <dd className="select-all break-all text-sm font-medium text-ink">{EMAIL_DO_SUPORTE}</dd>
          </div>
        </dl>
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface"
          >
            <MessageCircle size={18} strokeWidth={1.75} />
            {t.uiPaywallWhatsapp}
          </a>
        )}
      </div>

      {/* Link estilizado igual Button primary — Button não é polimórfico (só renderiza <button>). */}
      <a
        href={COURSE_CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm transition-all duration-150 ease-out hover:opacity-95"
      >
        {t.uiPaywallBotao}
      </a>
    </Card>
  );
}
