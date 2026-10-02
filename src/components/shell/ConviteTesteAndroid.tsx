"use client";

import { useEffect, useState, useTransition } from "react";
import { FlaskConical, X } from "lucide-react";
import { useInstallPlatform } from "@/lib/pwa/install";
import { queroTestarAndroidAction } from "@/lib/beta/teste-android";

/** Fechou ou já se ofereceu: não aparece mais. O convite de instalar o site também lê isto. */
export const CONVITE_ANDROID_KEY = "convite-teste-android";

export function conviteAndroidAtivo(): boolean {
  try {
    return window.localStorage.getItem(CONVITE_ANDROID_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * Convite pro teste fechado do app Android (out/2026). Só aparece pra quem usa o site no
 * navegador de um Android (não no iPhone, no computador nem dentro dos apps da loja): é quem pode
 * testar. A pessoa confirma o Gmail do celular e ele chega por e-mail pra Dani.
 */
export function ConviteTesteAndroid({ userEmail }: { userEmail?: string }) {
  const platform = useInstallPlatform();
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [gmail, setGmail] = useState(userEmail && /@(gmail|googlemail)\.com$/i.test(userEmail) ? userEmail : "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, startEnvio] = useTransition();

  useEffect(() => {
    // localStorage e user-agent só existem no cliente: o efeito lê o estado salvo, não sincroniza
    // estado do React.
    function refresh() {
      const dentroDoApp = /SPIFinanceApp-(iOS|Android)/.test(window.navigator.userAgent);
      setVisivel(platform === "android" && !dentroDoApp && conviteAndroidAtivo());
    }
    refresh();
  }, [platform]);

  if (!visivel) return null;

  function fechar(marca: "fechado" | "enviado") {
    try {
      window.localStorage.setItem(CONVITE_ANDROID_KEY, marca);
    } catch {}
    if (marca === "fechado") setVisivel(false);
  }

  function enviar() {
    setErro(null);
    startEnvio(async () => {
      const r = await queroTestarAndroidAction(gmail);
      if (r.ok) {
        setEnviado(true);
        fechar("enviado");
      } else setErro(r.mensagem);
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface-2 p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <FlaskConical className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {enviado ? (
            <>
              <p className="text-sm font-medium text-ink">Pronto, você está na lista!</p>
              <p className="text-xs text-ink-faint">Quando o teste abrir, chega um convite no seu Gmail pra instalar o app.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">Quer testar o app Android antes de todo mundo?</p>
              <p className="text-xs text-ink-faint">Estamos chamando quem usa Android pra testar o app da Play Store.</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => (enviado ? setVisivel(false) : fechar("fechado"))}
          aria-label="Fechar convite"
          className="shrink-0 rounded-full p-1.5 text-ink-faint hover:bg-surface"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {!enviado && !aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-3 w-full rounded-full bg-ink px-3 py-2 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Quero testar
        </button>
      )}

      {!enviado && aberto && (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="gmail-teste" className="text-xs text-ink-muted">
            Gmail usado no seu celular Android
          </label>
          <input
            id="gmail-teste"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            placeholder="seunome@gmail.com"
            className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-ink"
          />
          {erro && <p className="text-xs text-danger">{erro}</p>}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !gmail.trim()}
            className="rounded-full bg-ink px-3 py-2 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Entrar na lista de teste"}
          </button>
        </div>
      )}
    </div>
  );
}
