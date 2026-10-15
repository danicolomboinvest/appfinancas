"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Repeat } from "lucide-react";
import { Explica } from "@/components/ui/Explica";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { decidirRaioXAction } from "@/app/(app)/mensal/foco/actions";
import { desfazerRaioXAction } from "@/app/(app)/decidir/actions";
import { economiaAnual, resumoDasEscolhas, valorFuturo, type EscolhaDoRaioX, type RaioXItem } from "@/lib/decisoes/raio-x";

/**
 * Raio-X do que se repete (rodada 38 C), todo botão faz alguma coisa:
 * - "Cancelar": o item fica "Vou cancelar" (riscado leve, com selo) e aparece no topo "Você
 *   economiza R$ X por ano", somando os cancelados. Desfazer em cada um.
 * - "Manter": o item desce para "Você decidiu manter", recolhido.
 * - Hábito (o iFood de toda semana) não se cancela: corta pela metade.
 * - Terminou todos: "Pronto. R$ X por ano a menos".
 * A escolha é salva na hora e vale em todo lugar (lib/assinaturas, 15/10/2026): "Cancelar" aqui é
 * "Não uso" no Dinheiro perdido e o selo "Para cancelar" em Recorrentes; o Desfazer volta à
 * resposta de antes, de qualquer tela.
 */
export function RaioX({ itens, decididos, canceladas = [] }: { itens: RaioXItem[]; decididos: Record<string, EscolhaDoRaioX>; canceladas?: string[] }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaDoRaioX | undefined>>(decididos);
  const [lembrar, setLembrar] = useState(false);
  // "Cancelada" é o "Cancelei mesmo"; qualquer resposta nova aqui troca o selo.
  const [canceladasAqui, setCanceladas] = useState(() => new Set(canceladas));
  const tirarCancelada = (chave: string) => setCanceladas((c) => (c.has(chave) ? new Set([...c].filter((x) => x !== chave)) : c));
  const [, iniciar] = useTransition();
  const r = resumoDasEscolhas(itens, escolhas);
  const totalMensal = itens.reduce((s, i) => s + i.mensal, 0);

  const decidir = (item: RaioXItem, decisao: EscolhaDoRaioX) => {
    setEscolhas((e) => ({ ...e, [item.chave]: decisao }));
    tirarCancelada(item.chave);
    iniciar(async () => {
      try {
        await decidirRaioXAction({ chave: item.chave, nome: item.nome, decisao, economiaAnual: economiaAnual(item, decisao), descricao: item.descricao });
      } catch {
        setEscolhas((e) => ({ ...e, [item.chave]: undefined }));
        showError("Não salvou. Tente de novo.");
      }
    });
  };
  const desfazer = (item: RaioXItem) => {
    const antes = escolhas[item.chave];
    setEscolhas((e) => ({ ...e, [item.chave]: undefined }));
    tirarCancelada(item.chave);
    iniciar(async () => {
      try {
        // Volta à resposta de antes (pode ser a de outra tela, como o "Uso" do Dinheiro perdido).
        const { escolha } = await desfazerRaioXAction(item.chave, item.nome);
        setEscolhas((e) => ({ ...e, [item.chave]: escolha ?? undefined }));
      } catch {
        setEscolhas((e) => ({ ...e, [item.chave]: antes }));
        showError("Não salvou. Tente de novo.");
      }
    });
  };

  const linha = (item: RaioXItem, estado?: "cortado" | "mantido") => {
    const e = escolhas[item.chave];
    const metade = item.tipo === "habito";
    return (
      <div key={item.chave} className="flex items-start gap-3 py-3.5" data-guia="raiox-item">
        <LogoDoLancamento descricao={item.nome} icon={Repeat} size={36} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold ${estado === "cortado" ? "text-ink-muted line-through decoration-1" : "text-ink"}`}>{item.nome}</p>
          {estado ? (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${estado === "cortado" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
              {estado === "mantido" ? "Mantido" : e === "raiox_metade" ? "Vou cortar pela metade" : canceladasAqui.has(item.chave) ? "Cancelada" : "Vou cancelar"}
            </span>
          ) : (
            <p className="text-caption tabular-nums text-ink-muted">
              {money(item.mensal)} por mês · {m(item.anual)} por ano
              {metade ? ` · ${t.raioxVezesPorMes(Math.round(item.vezesPorMes)).toLowerCase()}` : ""}
            </p>
          )}
          {estado ? (
            <button type="button" onClick={() => desfazer(item)} className="mt-1.5 block min-h-9 text-sm text-ink-muted underline underline-offset-4">
              Desfazer
            </button>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => decidir(item, metade ? "raiox_metade" : "raiox_cancelar")} className="min-h-10 rounded-full bg-surface-2 px-4 text-sm font-medium text-ink">
                {metade ? "Cortar pela metade" : "Cancelar"}
              </button>
              <button type="button" onClick={() => decidir(item, "raiox_manter")} className="min-h-10 rounded-full bg-surface-2 px-4 text-sm font-medium text-ink">
                Manter
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {r.pronto ? (
        <HeroiDoTema>
          <p className="text-[2.5rem] font-light leading-none tracking-[-0.03em]">Pronto.</p>
          <p className="text-[15px] text-heroi-suave">{r.economiaAnual >= 1 ? <><span className="whitespace-nowrap">{m(r.economiaAnual)}</span> por ano a menos</> : "Você decidiu manter tudo"}</p>
        </HeroiDoTema>
      ) : (
        <HeroiDoTema>
          <p className="flex items-center gap-1.5 text-[15px] text-heroi-suave">
            {t.raioxJuntosAno}
            <Explica>{t.raioxComoAchei}</Explica>
          </p>
          <ValorDestaque texto={m(r.totalAnual)} />
          <p className="text-sm text-heroi-suave">Em 5 anos, rendendo, {m(valorFuturo(totalMensal, 60))}</p>
        </HeroiDoTema>
      )}

      {r.economiaAnual >= 1 && (
        <div className="rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]" aria-live="polite">
          <p className="text-caption text-ink-muted">Você economiza por ano</p>
          <ValorDestaque texto={m(r.economiaAnual)} className="mt-1 text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums" />
          <p className="mt-1 text-caption text-ink-muted">em 5 anos, {m(r.economiaEmCincoAnos)}</p>
        </div>
      )}

      {(r.abertos.length > 0 || r.cortados.length > 0) && (
        <div className="flex flex-col divide-y divide-border rounded-3xl bg-surface px-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
          {r.abertos.map((i) => linha(i))}
          {r.cortados.map((i) => linha(i, "cortado"))}
        </div>
      )}

      {r.cortados.length > 0 && (
        <button
          type="button"
          aria-pressed={lembrar}
          onClick={() => setLembrar((l) => !l)}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ${lembrar ? "bg-ink text-canvas" : "bg-surface-2 text-ink"}`}
        >
          <Bell size={16} aria-hidden />
          {lembrar ? "Vou te lembrar no dia de cada uma" : "Lembrar de cancelar no dia da cobrança"}
        </button>
      )}

      {r.mantidos.length > 0 && (
        <details className="rounded-3xl bg-surface px-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-medium text-ink">Você decidiu manter ({r.mantidos.length})</summary>
          <div className="flex flex-col divide-y divide-border border-t border-border">{r.mantidos.map((i) => linha(i, "mantido"))}</div>
        </details>
      )}

      <button
        type="button"
        onClick={() => {
          // Sai desta tela: pílula curta. O lembrete que importa é que o cancelamento é lá fora.
          showToast(r.cortados.length > 0 ? "Cancele em cada app" : "Combinado");
          router.push("/decidir");
        }}
        className="min-h-14 rounded-full bg-ink px-5 text-base font-semibold text-canvas"
      >
        {r.pronto ? "Pronto" : "Combinado"}
      </button>
    </div>
  );
}
