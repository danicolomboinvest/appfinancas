import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { COURSE_CHECKOUT_URL } from "@/lib/config";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";

/**
 * Tela de "isso é do curso" — mostrada no lugar do conteúdo real pra quem não tem acesso
 * premium (área de investimentos). Modelo freemium: qualquer um cadastra e usa a parte de
 * finanças pessoais de graça; isso aqui é o convite pra área paga, não um erro/bloqueio seco.
 *
 * Lê a sessão por conta própria pra falar na voz do tema: quem renderiza este cartão são
 * layouts e páginas de servidor que só decidem "mostra ou não", e é mais simples o cartão se
 * virar do que cada um deles passar a voz adiante.
 */
export async function PaywallCard({ feature }: { feature: string }) {
  const ctx = await getRequiredSession();
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <Lock size={22} strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{t.uiPaywallTitulo(feature)}</h2>
        <p className="mt-1.5 text-sm text-ink-muted">{t.uiPaywallTexto}</p>
      </div>
      {/* Link estilizado igual Button primary — Button não é polimórfico (só renderiza <button>). */}
      <a
        href={COURSE_CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm transition-all duration-150 ease-out hover:opacity-95"
      >
        {t.uiPaywallBotao}
      </a>
    </Card>
  );
}
