"use client";

import { useTransition } from "react";
import { Lock, MessageCircle } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/actions";
import { EMAIL_DO_SUPORTE } from "@/lib/support/contato";
import type { SituacaoDoAcesso } from "@/lib/repositories/allowedEmail.repo";

/**
 * O que a conta sem compra valendo vê no lugar do app (ver o layout de (app)).
 *
 * Quem mais cai aqui é quem comprou com um e-mail e criou a conta com outro. Por isso o e-mail da
 * conta aparece por extenso (pra ela comparar com o da compra), a dica do celular aponta a compra
 * quando acha, e a frase de que os lançamentos continuam guardados vem antes de tudo: sem ela,
 * "acesso não está ativo" soa como "perdi tudo".
 */
export function TelaSemAcesso({
  email,
  situacao,
  compraDoCelular,
  whatsapp,
}: {
  email: string;
  situacao: Exclude<SituacaoDoAcesso, "ativo">;
  compraDoCelular: string | null;
  whatsapp: string | null;
}) {
  const [saindo, startSair] = useTransition();
  const semCompra = situacao === "sem-compra";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-premium-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <Lock size={24} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Seu acesso não está ativo</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {semCompra
                ? "Não achamos uma compra do SPI Finance com o e-mail desta conta."
                : situacao === "vencido"
                  ? "O prazo do seu acesso terminou."
                  : "A compra deste e-mail foi encerrada (reembolso ou cancelamento)."}
            </p>
            <p className="mt-2 text-sm text-ink-muted">Tudo o que você lançou continua guardado.</p>
          </div>

          <div className="w-full rounded-xl border border-border bg-surface-2 p-4 text-left">
            <p className="text-sm font-semibold text-ink">{semCompra ? "Comprou com outro e-mail?" : "Acha que é engano?"}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {semCompra
                ? "Mande pra gente o e-mail da compra: a gente junta na sua conta e você não perde nada."
                : "Fale com a gente que a gente confere a sua compra."}
            </p>
            {compraDoCelular && (
              <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
                Achamos uma compra com o seu celular no e-mail:
                <span className="mt-0.5 block break-all font-semibold">{compraDoCelular}</span>
              </p>
            )}
            <dl className="mt-3 flex flex-col gap-2.5">
              <div>
                <dt className="text-xs text-ink-faint">E-mail desta conta</dt>
                {/* break-all: e-mail comprido empurraria o cartão pra fora da tela no celular. */}
                <dd className="select-all break-all text-sm font-medium text-ink">{email}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Fale com a gente</dt>
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
                Chamar no WhatsApp
              </a>
            )}
          </div>

          <div className="w-full border-t border-border pt-3">
            {semCompra && <p className="text-xs text-ink-faint">Já tem outra conta com o e-mail da compra? Saia e entre com ela.</p>}
            <Button type="button" variant="ghost" size="sm" disabled={saindo} onClick={() => startSair(() => logoutAction())} className="mt-2">
              {saindo ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
