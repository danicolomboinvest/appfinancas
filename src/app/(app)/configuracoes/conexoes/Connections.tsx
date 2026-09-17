"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast-context";
import { createConnectTokenAction, disconnectAction, registerConnectionAction, syncConnectionAction } from "./actions";

type ConnectionRow = { id: string; connectorName: string; status: string; lastSyncAt: string | null; lastSyncCount: number; lastError: string | null };

/**
 * Conectar meu banco: os três passos (dois deles no site do Meu Pluggy), o widget de
 * autorização e a lista de conexões com buscar agora e desconectar. O arquivo continua
 * sendo o caminho principal; isto é o "beta" pra quem quiser.
 */
export function Connections({ configured, connections }: { configured: boolean; connections: ConnectionRow[] }) {
  const { showToast } = useToast();
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
            showToast(`${res.connectorName} conectado.`);
          });
        },
        onError: (err: { message?: string }) => showToast(err?.message ? `Não deu: ${err.message}` : "A conexão não foi concluída."),
      });
      widget.init();
    } catch (err) {
      console.error(err);
      showToast("Não consegui abrir a conexão agora.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-muted">A conexão com bancos ainda não está ligada neste app. Enquanto isso, o caminho é Registrar › Importar extrato ou fatura.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {result && (
        <Card className="flex flex-col gap-2 border-success/30 bg-success-soft/40 p-4">
          <p className="text-[17px] font-bold text-success">{result.connectorName} conectado</p>
          <p className="text-sm text-ink-muted">
            {result.created === 0
              ? "Nenhum lançamento novo por enquanto. O SPI busca de novo toda noite."
              : `Chegaram ${result.created} lançamentos dos últimos 90 dias${result.uncategorized > 0 ? `, ${result.uncategorized} sem categoria` : ""}.`}
          </p>
          <Link href="/mensal" className="w-fit text-sm font-medium text-accent-strong hover:underline">Ver no mês →</Link>
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-sm leading-relaxed text-ink-muted">
          Pelo Open Finance oficial, através do Meu Pluggy, um site parceiro gratuito. Depois de conectado, o SPI busca seus lançamentos toda noite. Nada de arquivo.
        </p>
        <ol className="flex flex-col gap-3">
          {[
            ["Crie sua conta no Meu Pluggy", "É um site parceiro, gratuito. Abre em outra aba e volta aqui."],
            ["Conecte seu banco lá", "Nubank, Itaú, Inter, C6… O banco pede sua autorização pelo app dele. Cartão entra junto."],
            ["Autorize o SPI a ler", "Volte pra cá e toque em autorizar. Só leitura: o SPI não move dinheiro."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-ink">{t}</p>
                <p className="text-caption text-ink-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href="https://meu.pluggy.ai/" target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-bold text-on-accent">
            Criar conta no Meu Pluggy ↗
          </a>
          <Button type="button" variant="ghost" onClick={connect} disabled={busy || isPending} className="flex-1">
            {busy || isPending ? "Abrindo…" : "Já conectei lá → autorizar o SPI"}
          </Button>
        </div>
        <p className="text-caption leading-relaxed text-ink-faint">
          Seus dados bancários passam pela Pluggy, empresa regulada pelo Banco Central, e chegam ao SPI só como lançamentos. Você desconecta quando quiser aqui. Se preferir, continue subindo o extrato.
        </p>
      </Card>

      {connections.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink">Bancos conectados</p>
          {connections.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted"><Landmark size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{c.connectorName}</p>
                  <p className="text-caption text-ink-faint">
                    {c.lastSyncAt ? `atualizado ${c.lastSyncAt} · ${c.lastSyncCount} novo${c.lastSyncCount === 1 ? "" : "s"}` : "ainda não buscou"}
                    {c.status !== "UPDATED" && c.status !== "UPDATING" ? ` · ${c.status === "LOGIN_ERROR" ? "precisa reautorizar" : c.status.toLowerCase()}` : ""}
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
                      showToast(res.ok ? `${res.result.created} lançamento${res.result.created === 1 ? "" : "s"} novo${res.result.created === 1 ? "" : "s"}.` : res.error);
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Buscar agora
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm(`Desconectar ${c.connectorName}? Os lançamentos que já entraram ficam.`)) return;
                    startTransition(async () => {
                      await disconnectAction(c.id);
                      showToast("Desconectado.");
                    });
                  }}
                  className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                >
                  Desconectar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
