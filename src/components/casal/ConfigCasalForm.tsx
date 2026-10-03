"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { salvarConfigCasalAction } from "@/app/(app)/divisao/casal-actions";
import type { ConfigCasal } from "@/lib/casal/acerto";

/** Os nomes das duas pessoas e como os gastos da casa se dividem (perfil Casal). */
export function ConfigCasalForm({ config }: { config: ConfigCasal }) {
  const router = useRouter();
  const [nomeA, setNomeA] = useState(config.nomeA);
  const [nomeB, setNomeB] = useState(config.nomeB);
  const [divisao, setDivisao] = useState(config.divisao);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, startSalvar] = useTransition();

  function salvar() {
    setMsg(null);
    startSalvar(async () => {
      const r = await salvarConfigCasalAction({ nomeA, nomeB, divisao });
      if (r.ok) {
        setMsg({ ok: true, texto: "Salvo." });
        router.refresh();
      } else setMsg({ ok: false, texto: r.mensagem });
    });
  }

  const opcao = (ativo: boolean) =>
    `flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${ativo ? "bg-ink text-canvas" : "text-ink hover:bg-surface"}`;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-sm font-semibold text-ink">Vocês dois</p>
        <p className="text-sm text-ink-muted">Esses nomes aparecem em &quot;Quem pagou?&quot; ao lançar um gasto.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-ink-muted" htmlFor="casal-nome-a">
          Pessoa 1
          <input id="casal-nome-a" value={nomeA} maxLength={30} onChange={(e) => setNomeA(e.target.value)} className="min-h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-ink" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-muted" htmlFor="casal-nome-b">
          Pessoa 2
          <input id="casal-nome-b" value={nomeB} maxLength={30} onChange={(e) => setNomeB(e.target.value)} className="min-h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-ink" />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-muted">Dividir os gastos da casa</span>
        <div role="group" aria-label="Dividir os gastos da casa" className="flex gap-1 rounded-full border border-border bg-surface-2 p-1">
          <button type="button" aria-pressed={divisao === "renda"} onClick={() => setDivisao("renda")} className={opcao(divisao === "renda")}>
            Pela renda
          </button>
          <button type="button" aria-pressed={divisao === "meio"} onClick={() => setDivisao("meio")} className={opcao(divisao === "meio")}>
            Meio a meio
          </button>
        </div>
        <p className="text-xs text-ink-faint">
          {divisao === "renda"
            ? "Quem ganha mais paga uma parte maior. A renda de cada um vem das entradas lançadas no mês, marcadas com o nome de quem recebeu."
            : "Cada um paga metade dos gastos da casa."}
        </p>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.texto}</p>}
      <button type="button" onClick={salvar} disabled={salvando} className="min-h-11 self-start rounded-full bg-ink px-5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </Card>
  );
}
