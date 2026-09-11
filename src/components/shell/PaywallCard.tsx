import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { COURSE_CHECKOUT_URL } from "@/lib/config";

/**
 * Tela de "isso é do curso" — mostrada no lugar do conteúdo real pra quem não tem acesso
 * premium (área de investimentos). Modelo freemium: qualquer um cadastra e usa a parte de
 * finanças pessoais de graça; isso aqui é o convite pra área paga, não um erro/bloqueio seco.
 */
export function PaywallCard({ feature }: { feature: string }) {
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <Lock size={22} strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{feature} é conteúdo do curso</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Essa área faz parte do curso de investimentos. Quem já é aluna(o) e está vendo essa mensagem por engano, fale
          com o suporte — pode ser só o e-mail de cadastro diferente do e-mail da compra.
        </p>
      </div>
      {/* Link estilizado igual Button primary — Button não é polimórfico (só renderiza <button>). */}
      <a
        href={COURSE_CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm transition-all duration-150 ease-out hover:opacity-95"
      >
        Conhecer o curso
      </a>
    </Card>
  );
}
