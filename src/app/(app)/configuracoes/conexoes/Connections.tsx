"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { createConnectTokenAction, disconnectAction, registerConnectionAction, syncConnectionAction } from "./actions";

type ConnectionRow = { id: string; connectorName: string; status: string; lastSyncAt: string | null; lastSyncCount: number; lastError: string | null };

/**
 * Conectar meu banco: os três passos (dois deles no site do Meu Pluggy), o widget de
 * autorização e a lista de conexões com buscar agora e desconectar. O arquivo continua
 * sendo o caminho principal; isto é o "beta" pra quem quiser.
 */
export function Connections({ configured, connections }: { configured: boolean; connections: ConnectionRow[] }) {
  const { showToast } = useToast();
  const { titulos: t } = useProfileTheme().voz;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ connectorName: string; created: number; uncategorized: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function connect() {
    setBusy(true);
    try {
      const tk = await createConnectTokenAction();
      if (!tk.ok) {
        showToast(tk.error);
        return;
      }
      const { PluggyConnect } = await import("pluggy-connect-sdk");
      const widget = new PluggyConnect({
        connectToken: tk.token,
        language: "pt",
        ...(tk.connectorId ? { connectorIds: [tk.connectorId] } : {}),
        onSuccess: (data: { item: { id: string } }) => {
          startTransition(async () => {
            const res = await registerConnectionAction(data.item.id);
            if (!res.ok) {
              showToast(res.error);
              return;
            }
            setResult({ connectorName: res.connectorName, created: res.result.created, uncategorized: res.result.uncategorized });
            showToast(t.cfgConexaoConectadoToast(res.connectorName));
          });
        },
        onError: (err: { message?: string }) => showToast(err?.message ? t.cfgConexaoNaoDeu(err.message) : t.cfgConexaoNaoConcluida),
      });
      widget.init();
    } catch (err) {
      console.error(err);
      showToast(t.cfgConexaoNaoAbriu);
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-muted">{t.cfgConexoesDesligada}</p>
      </Card>
    );
  }

  // Os três passos na voz do tema; a numeração é a posição na lista.
  const passos: [string, string][] = [
    [t.cfgConexoesPasso1, t.cfgConexoesPasso1Dica],
    [t.cfgConexoesPasso2, t.cfgConexoesPasso2Dica],
    [t.cfgConexoesPasso3, t.cfgConexoesPasso3Dica],
  ];

  return (
    <div className="flex flex-col gap-5">
      {result && (
        <Card className="flex flex-col gap-2 border-success/30 bg-success-soft/40 p-4">
          <p className="text-[17px] font-bold text-success">{t.cfgConexaoConectado(result.connectorName)}</p>
          <p className="text-sm text-ink-muted">
            {result.created === 0 ? t.cfgConexaoNadaNovo : t.cfgConexaoChegaram(result.created, result.uncategorized)}
          </p>
          <Link href="/mensal" className="w-fit text-sm font-medium text-accent-strong hover:underline">{t.cfgConexaoVerNoMes}</Link>
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-sm leading-relaxed text-ink-muted">{t.cfgConexoesIntro}</p>
        <ol className="flex flex-col gap-3">
          {passos.map(([titulo, dica], i) => (
            <li key={titulo} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-ink">{titulo}</p>
                <p className="text-caption text-ink-muted">{dica}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href="https://meu.pluggy.ai/" target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-bold text-on-accent">
            {t.cfgConexoesCriarConta}
          </a>
          <Button type="button" variant="ghost" onClick={connect} disabled={busy || isPending} className="flex-1">
            {busy || isPending ? t.cfgConexoesAbrindo : t.cfgConexoesAutorizar}
          </Button>
        </div>
        <p className="text-caption leading-relaxed text-ink-faint">{t.cfgConexoesRodape}</p>
      </Card>

      {connections.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink">{t.cfgBancosConectados}</p>
          {connections.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted"><Landmark size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{c.connectorName}</p>
                  <p className="text-caption text-ink-faint">
                    {c.lastSyncAt ? t.cfgConexaoAtualizado(c.lastSyncAt, c.lastSyncCount) : t.cfgConexaoAindaNaoBuscou}
                    {c.status !== "UPDATED" && c.status !== "UPDATING" ? ` · ${c.status === "LOGIN_ERROR" ? t.cfgConexaoReautorizar : c.status.toLowerCase()}` : ""}
                  </p>
                  {c.lastError && <p className="text-caption text-danger">{c.lastError}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await syncConnectionAction(c.id);
                      showToast(res.ok ? t.cfgConexaoNovos(res.result.created) : res.error);
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw size={13} /> {t.cfgBuscarAgora}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm(t.cfgDesconectarConfirma(c.connectorName))) return;
                    startTransition(async () => {
                      await disconnectAction(c.id);
                      showToast(t.cfgDesconectadoToast);
                    });
                  }}
                  className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                >
                  {t.cfgDesconectar}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
