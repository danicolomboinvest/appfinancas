"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { conferirMesAction } from "@/app/(app)/divisao/nos-dois-actions";
import { marcarAcertoAction } from "@/app/(app)/divisao/casal-actions";
import type { FechamentoNaTela } from "@/lib/repositories/nos-dois.repo";
import { BOTAO_ESCURO, BOTAO_SUAVE, Bolinha, CARTAO } from "./visual";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Pessoas = { minha: "A" | "B"; titular: "A" | "B"; nomes: { A: string; B: string } };

function quandoConferiu(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora}`;
  if (new Date(hoje.getTime() - 86_400_000).toDateString() === d.toDateString()) return `ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}, ${hora}`;
}

function frase(f: FechamentoNaTela, p: Pessoas): string {
  const outra = p.minha === "A" ? "B" : "A";
  const e = f.estado;
  if (e.tipo === "fechado") return "Os dois conferiram.";
  if (e.tipo === "mudou") return "Um lançamento do mês mudou depois do confere. Confiram de novo.";
  if (e.tipo === "falta-um") return e.falta === p.minha ? `${p.nomes[outra]} conferiu. Falta você.` : `Você conferiu. Falta ${p.nomes[outra]}.`;
  return "Cada um confere. O mês fecha quando os dois disserem Confere.";
}

/** O cartão curto no Nós dois, que leva para a tela de fechar. */
export function CartaoFecharOMes({ fechamento, pessoas, mes, acertado }: { fechamento: FechamentoNaTela; pessoas: Pessoas; mes: number; acertado: boolean }) {
  const nome = MESES[mes - 1];
  const fechado = fechamento.estado.tipo === "fechado";
  if (fechado && acertado) return null;
  return (
    <Link href="/divisao/fechar" className={`${CARTAO} flex items-center gap-3 p-4`}>
      <span className="flex -space-x-2" aria-hidden>
        <Bolinha nome={pessoas.nomes[pessoas.titular]} cor="titular" size={32} className="ring-2 ring-surface" />
        <Bolinha nome={pessoas.nomes[pessoas.titular === "A" ? "B" : "A"]} cor="par" size={32} className="ring-2 ring-surface" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold text-ink">{fechado ? `${nome.charAt(0).toUpperCase()}${nome.slice(1)} fechado` : `Fechar ${nome}`}</span>
        <span className="block text-[14px] leading-snug text-ink-muted">{fechado ? "Falta registrar o acerto" : frase(fechamento, pessoas)}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}

/**
 * Fechar o mês a dois (protótipo aprovado, tela f): os dois com o seu "Confere" e a hora, o
 * acerto do mês, "Confere" e "Tem algo errado". Fechado, sobra o "Já mandei" do acerto.
 */
export function FecharOMes({
  ano,
  mes,
  fechamento,
  pessoas,
  acerto,
}: {
  ano: number;
  mes: number;
  fechamento: FechamentoNaTela;
  pessoas: Pessoas;
  acerto: { diferenca: number; devedor: "A" | "B"; totalDaCasa: number; pagou: { A: number; B: number }; acertado: boolean };
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [ocupado, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const nome = MESES[mes - 1];
  const outra = pessoas.minha === "A" ? "B" : "A";
  const fechado = fechamento.estado.tipo === "fechado";
  const conferiEu = Boolean(fechamento.conferiuEm[pessoas.minha]);
  const nomeDe = (l: "A" | "B") => (l === pessoas.minha ? "Você" : pessoas.nomes[l]);
  const frasesDoAcerto =
    acerto.diferenca < 1
      ? "Ninguém deve nada."
      : acerto.devedor === pessoas.minha
        ? `Você manda ${m(acerto.diferenca)} pra ${pessoas.nomes[outra]}`
        : `${pessoas.nomes[outra]} manda ${m(acerto.diferenca)} pra você`;

  function agir(fn: () => Promise<{ ok: boolean; mensagem?: string }>) {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.mensagem ?? "Não consegui agora.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col pt-2">
      <Link href="/divisao" className="-ml-1 flex min-h-11 w-fit items-center gap-1 text-[17px] text-ink-muted">
        <ChevronLeft size={20} strokeWidth={1.6} aria-hidden />
        Nós dois
      </Link>
      <span className="mt-2 flex -space-x-3" aria-hidden>
        <Bolinha nome={pessoas.nomes[pessoas.titular]} cor="titular" size={56} className="ring-4 ring-canvas" />
        <Bolinha nome={pessoas.nomes[pessoas.titular === "A" ? "B" : "A"]} cor="par" size={56} />
      </span>
      <h1 className="titulo-tema mt-5 text-[34px] font-medium leading-tight tracking-tight text-ink">{fechado ? `${nome.charAt(0).toUpperCase()}${nome.slice(1)} fechado` : `Fechar ${nome}`}</h1>
      <p className="mt-2 text-[17px] text-ink-muted">{frase(fechamento, pessoas)}</p>

      <ul className={`${CARTAO} mt-6 divide-y divide-border px-5`}>
        {([pessoas.titular, pessoas.titular === "A" ? "B" : "A"] as const).map((l) => {
          const em = fechamento.conferiuEm[l];
          return (
            <li key={l} className="flex items-center gap-3 py-4">
              <Bolinha nome={pessoas.nomes[l]} cor={l === pessoas.titular ? "titular" : "par"} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-ink">{nomeDe(l)}</span>
                <span className="block truncate text-[15px] text-ink-muted">{em ? `conferiu ${quandoConferiu(em)}` : "falta conferir"}</span>
              </span>
              {em ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold text-success">
                  <Check size={15} strokeWidth={2} aria-hidden />
                  Confere
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-semibold text-accent-strong">
                  <Clock size={15} strokeWidth={1.8} aria-hidden />
                  Falta
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className={`${CARTAO} mt-4 p-5`}>
        <p className="text-[15px] text-ink-muted">Acerto de {nome}</p>
        <p className="mt-1 text-[22px] font-semibold leading-snug text-ink">{frasesDoAcerto}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-ink-muted">
          <span>
            Da casa <span className="font-medium text-ink">{m(acerto.totalDaCasa)}</span>
          </span>
          <span>
            {nomeDe(pessoas.titular)} pagou <span className="font-medium text-ink">{m(acerto.pagou[pessoas.titular])}</span>
          </span>
          <span>
            {nomeDe(pessoas.titular === "A" ? "B" : "A")} pagou <span className="font-medium text-ink">{m(acerto.pagou[pessoas.titular === "A" ? "B" : "A"])}</span>
          </span>
        </p>
      </div>

      {erro && <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">{erro}</p>}
      <div className="mt-6 flex flex-col gap-3">
        {!fechado && !conferiEu && (
          <button type="button" disabled={ocupado} onClick={() => agir(() => conferirMesAction(ano, mes))} className={BOTAO_ESCURO}>
            <Check size={20} strokeWidth={1.8} aria-hidden />
            Confere
          </button>
        )}
        {fechado && acerto.diferenca >= 1 && (
          <button type="button" disabled={ocupado} onClick={() => agir(() => marcarAcertoAction(ano, mes, !acerto.acertado))} className={acerto.acertado ? BOTAO_SUAVE : BOTAO_ESCURO}>
            {acerto.acertado ? "Desfazer o Já mandei" : "Já mandei"}
          </button>
        )}
        {!fechado && (
          <Link href="/divisao/lancamentos" className={`${BOTAO_SUAVE} min-h-14 w-full flex-none text-[17px]`}>
            Tem algo errado
          </Link>
        )}
      </div>
    </div>
  );
}
