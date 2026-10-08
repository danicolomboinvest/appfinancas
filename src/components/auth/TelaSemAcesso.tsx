"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/actions";
import { EMAIL_DO_SUPORTE } from "@/lib/support/contato";
import type { SituacaoDoAcesso } from "@/lib/repositories/allowedEmail.repo";
import { confirmarCodigoDaCompraAction, pedirCodigoDaCompraAction } from "@/lib/auth/juntar-compra-actions";

const CAMPO = "min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-base text-ink focus:border-accent focus:outline-none sm:text-sm";

/**
 * "Comprou com outro e-mail?" resolvido aqui mesmo (07/10/2026): o e-mail da compra, o código que
 * chega nele, e a conta passa a usar esse e-mail. Antes era escrever para o suporte e esperar.
 */
function JuntarCompra() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, start] = useTransition();

  if (pronto) {
    return (
      <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
        Pronto! Agora você entra com <span className="break-all font-semibold">{pronto}</span>.
      </p>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        start(async () => {
          if (!enviadoPara) {
            const r = await pedirCodigoDaCompraAction(email);
            if (r.ok) setEnviadoPara(r.email);
            else setErro(r.erro);
            return;
          }
          const r = await confirmarCodigoDaCompraAction(enviadoPara, codigo);
          if (!r.ok) return setErro(r.erro);
          setPronto(r.email);
          router.refresh();
        });
      }}
    >
      {enviadoPara ? (
        <>
          <label htmlFor="codigo-compra" className="text-sm text-ink-muted">
            Código enviado para <span className="break-all font-medium text-ink">{enviadoPara}</span>
          </label>
          <input id="codigo-compra" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} className={`${CAMPO} tracking-[0.3em]`} placeholder="000000" />
        </>
      ) : (
        <>
          <label htmlFor="email-compra" className="text-sm text-ink-muted">E-mail da compra</label>
          <input id="email-compra" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} placeholder="voce@email.com" />
        </>
      )}
      {erro && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
      <Button type="submit" disabled={ocupado || (enviadoPara ? codigo.length !== 6 : !email.includes("@"))} className="w-full">
        {ocupado ? "Um instante..." : enviadoPara ? "Confirmar" : "Receber código"}
      </Button>
      {enviadoPara && (
        <button type="button" onClick={() => { setEnviadoPara(null); setCodigo(""); setErro(null); }} className="text-sm font-medium text-ink-muted hover:text-ink">
          Usar outro e-mail
        </button>
      )}
    </form>
  );
}

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
            {!semCompra && <p className="mt-1 text-sm text-ink-muted">Fale com a gente que a gente confere a sua compra.</p>}
            {semCompra && <JuntarCompra />}
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
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface"
              >
                <Mail size={18} strokeWidth={1.75} />
                Falar com a gente
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
