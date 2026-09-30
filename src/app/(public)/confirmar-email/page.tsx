import Link from "next/link";
import { CheckCircle2, MailWarning } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { lerTokenDeConfirmacao } from "@/lib/auth/confirmacao-email";
import { marcarEmailConfirmado } from "@/lib/repositories/user.repo";

/**
 * Destino do link "Confirmar meu e-mail". Pública (está em PUBLIC_PATHS): o link costuma abrir
 * no navegador do celular, sem sessão nenhuma. Quem vale é o código assinado do link, não a
 * sessão — então abrir logada em outra conta não confirma a conta errada.
 */
export default async function ConfirmarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  const lido = lerTokenDeConfirmacao(typeof t === "string" ? t : null);
  const confirmado = lido ? await marcarEmailConfirmado(lido.userId, lido.email) : false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={48} className="rounded-2xl" />
        </div>

        {confirmado ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-premium-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 size={28} strokeWidth={2} />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink">E-mail confirmado!</h1>
              <p className="mt-1 text-sm text-ink-muted">Sua conta está liberada. Pode entrar.</p>
            </div>
            {/* /login manda quem já está logada direto pro app. */}
            <Link
              href="/login"
              className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas hover:opacity-90"
            >
              Entrar no SPI Finance
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-premium-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <MailWarning size={26} strokeWidth={2} />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink">Este link não vale mais</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Ele pode ter vencido (vale 7 dias) ou ter chegado cortado. Entre na sua conta e toque em
                &ldquo;Reenviar e-mail&rdquo; pra receber um link novo.
              </p>
            </div>
            <Link
              href="/login"
              className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas hover:opacity-90"
            >
              Entrar e pedir outro link
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
