"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/components/money/MoneyProvider";
import { marcarAcertoAction } from "@/app/(app)/divisao/casal-actions";
import type { AcertoDoMes } from "@/lib/repositories/casal.repo";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Acerto do mês do perfil Casal: uma frase ("Pedro deve R$ 224 pra Dani"), a parte de cada um e
 * quanto cada um pagou dos gastos da casa. Os pessoais ficam de fora. Ver lib/casal/acerto.ts.
 */
export function AcertoDoMesCard({ acerto, comLinkParaDivisao = false }: { acerto: AcertoDoMes; comLinkParaDivisao?: boolean }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [salvando, startSalvar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const { config } = acerto;
  const nome = { A: config.nomeA, B: config.nomeB };
  const diferenca = Math.round(Math.abs(acerto.saldoA));
  const quites = acerto.acertado || diferenca < 1;
  const devedor = acerto.saldoA > 0 ? "B" : "A";
  const credor = devedor === "A" ? "B" : "A";
  const pctA = Math.round(acerto.fracaoA * 100);
  const nomeDoMes = MESES[acerto.mes - 1];

  function alternar() {
    setErro(null);
    startSalvar(async () => {
      const r = await marcarAcertoAction(acerto.ano, acerto.mes, !acerto.acertado);
      if (r.ok) router.refresh();
      else setErro(r.mensagem);
    });
  }

  if (acerto.totalDaCasa === 0 && acerto.semDono.quantidade === 0) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <p className="text-sm font-semibold text-ink">Acerto de {nomeDoMes}</p>
        <p className="text-sm text-ink-muted">
          Ainda não há gastos da casa com &quot;quem pagou&quot; neste mês. Ao lançar um gasto, escolha quem pagou e se ele é da casa: o app faz a conta de quem deve pra quem.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className={`flex flex-col gap-1 rounded-2xl p-4 ${quites ? "bg-success-soft" : "bg-accent-soft"}`}>
        <p className="text-xs font-medium text-ink-muted">Acerto de {nomeDoMes}</p>
        <p className="text-xl font-semibold tracking-tight text-ink [text-wrap:balance]">
          {acerto.acertado
            ? `${nomeDoMes.charAt(0).toUpperCase() + nomeDoMes.slice(1)} acertado.`
            : quites
              ? "Ninguém deve nada este mês."
              : `${nome[devedor]} deve ${m(diferenca)} pra ${nome[credor]}.`}
        </p>
        {!quites && (
          <p className="text-sm text-ink-muted">
            {nome[credor]} pagou {m(acerto.pagou[credor])} dos gastos da casa, e a parte que cabia a {nome[credor]} era {m(acerto.parte[credor])}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className="h-full bg-accent-strong" style={{ width: `${pctA}%` }} />
          <span className="h-full bg-[#3F6E8C]" style={{ width: `${100 - pctA}%` }} />
        </div>
        <p className="text-xs text-ink-faint">
          {config.divisao === "meio" || acerto.caiuParaMeio ? "Meio a meio" : `Pela renda: ${pctA}% e ${100 - pctA}%`}
          {acerto.caiuParaMeio && " (lance a renda de cada um pra dividir pela renda)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((p) => (
          <div key={p} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
            <span className="truncate text-sm font-semibold text-ink">{nome[p]}</span>
            <span className="text-xs text-ink-muted">
              Parte: <span className="font-semibold tabular-nums text-ink">{m(acerto.parte[p])}</span>
            </span>
            <span className="text-xs text-ink-muted">
              Pagou: <span className="font-semibold tabular-nums text-ink">{m(acerto.pagou[p])}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-faint">
        Gastos da casa em {nomeDoMes}: {m(acerto.totalDaCasa)}. Os pessoais ficam de fora.
        {acerto.semDono.quantidade > 0 &&
          ` ${acerto.semDono.quantidade} ${acerto.semDono.quantidade === 1 ? "gasto" : "gastos"} sem "quem pagou" (${m(acerto.semDono.valor)}) ${acerto.semDono.quantidade === 1 ? "ficou" : "ficaram"} fora: abra e escolha quem pagou.`}
      </p>

      {erro && <p className="text-sm text-danger">{erro}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          disabled={salvando}
          className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-opacity disabled:opacity-50 ${
            acerto.acertado ? "border border-border-strong text-ink" : "bg-ink text-canvas hover:opacity-90"
          }`}
        >
          {salvando ? "Salvando..." : acerto.acertado ? "Desfazer acerto" : "Marcar como acertado"}
        </button>
        {comLinkParaDivisao && (
          <Link href="/divisao" className="text-sm font-medium text-accent-strong hover:underline">
            Nomes e forma de dividir
          </Link>
        )}
      </div>
    </Card>
  );
}
