"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Banknote, CalendarDays, CreditCard, Landmark } from "lucide-react";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { ErroNoBotao, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { currencySymbol } from "@/lib/money";
import { contaVaria, DIAS_PARA_TRAS, diaAntes, diaValido, mesCurto, rotuloDoDia, type OrigemDoPaguei } from "@/lib/contas/paguei";
import { pagarContaAction } from "./actions";

/** O que a página manda para a linha do "Paguei" (ver carregarDadosDoPaguei). */
export type DadosDoPagueiNaTela = {
  origens: OrigemDoPaguei[];
  origem: string;
  antes: Record<string, { mes: string; valor: number }[]>;
};

export type ContaDoPaguei = { id: string; nome: string; valor: number | null; aproximado?: boolean; vencimento: string };

/** O que o "Pronto" devolve para quem abriu a linha (o Desfazer e o "Entrou nos gastos"). */
export type PagueiFeito = {
  contaId: string;
  nome: string;
  lancamentoId: string;
  antes: string;
  antesParcela: number | null;
  proxima: string | null;
  valor: number;
  dia: string;
  origem: OrigemDoPaguei | null;
};

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function IconeDaOrigem({ tipo, size = 16 }: { tipo: OrigemDoPaguei["tipo"]; size?: number }) {
  const I = tipo === "cartao" ? CreditCard : tipo === "dinheiro" ? Banknote : Landmark;
  return <I size={size} strokeWidth={1.8} className="shrink-0" aria-hidden />;
}

/** O chip do palpite: marcado (escuro) é o que vai valer; tocar muda. */
const CHIP = "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full px-3.5 text-[14px] transition-transform active:scale-95";
const CHIP_MARCADO = `${CHIP} bg-ink font-semibold text-canvas`;
const CHIP_SOLTO = `${CHIP} bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border)]`;

/**
 * "Paguei" na própria linha (versão B, decisão da Dani em 15/10/2026). A linha da conta se abre
 * com o palpite pronto em chips: o valor (na conta que varia, o campo já abre vazio com os
 * valores de antes para escolher com um toque), o dia (Hoje; tocando, Ontem ou Outro dia) e de
 * onde saiu (a última conta ou cartão usado; tocando, escolhe outro). "Pronto" cria o gasto,
 * marca a conta como paga e passa o vencimento. "Agora não" fecha a linha.
 *
 * O mesmo componente nas Recorrentes e no Paguei da Empresa: um jeito só.
 */
export function PagueiDaConta({
  conta,
  dados,
  hoje,
  onPago,
  onFechar,
  className = "",
}: {
  conta: ContaDoPaguei;
  dados: DadosDoPagueiNaTela;
  hoje: string;
  onPago: (r: PagueiFeito) => void;
  onFechar: () => void;
  className?: string;
}) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const varia = contaVaria(conta);
  const [valor, setValor] = useState<number | null>(varia ? null : conta.valor);
  const [editaValor, setEditaValor] = useState(varia);
  const [dia, setDia] = useState(hoje);
  const [escolheDia, setEscolheDia] = useState(false);
  const [outroDia, setOutroDia] = useState(false);
  const campoDoDia = useRef<HTMLInputElement>(null);
  const [origem, setOrigem] = useState(dados.origem);
  const [escolheOrigem, setEscolheOrigem] = useState(false);
  const [salvando, iniciar] = useTransition();
  const pronto = useErroNoBotao();
  const antes = dados.antes[conta.id] ?? [];
  const daOrigem = dados.origens.find((o) => o.chave === origem) ?? null;
  const ontem = diaAntes(hoje, 1);
  const outro = dia !== hoje && dia !== ontem;

  // "Outro dia" no computador (29/10/2026, relato de cliente): o campo de data aparece de verdade e
  // já abre o calendário quando o navegador deixa; no celular o toque abre o seletor nativo.
  useEffect(() => {
    if (!outroDia) return;
    const el = campoDoDia.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // Alguns navegadores só abrem o calendário com um toque da pessoa: o campo fica visível do mesmo jeito.
    }
  }, [outroDia]);

  function confirmar() {
    pronto.limpar();
    if (!valor || valor <= 0) {
      setEditaValor(true);
      return pronto.falhou("Falta o valor");
    }
    iniciar(async () => {
      const r = await pagarContaAction(conta.id, { valor, dia, origem });
      if (!r.ok) return pronto.falhou(r.erro);
      onPago({ contaId: conta.id, nome: conta.nome, lancamentoId: r.lancamentoId, antes: r.antes, antesParcela: r.antesParcela, proxima: r.proxima, valor, dia, origem: daOrigem });
    });
  }

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent)_7%,var(--color-surface))] p-3 shadow-[inset_0_0_0_1.5px_var(--color-accent)] aviso-sobe ${className}`}
      data-paguei-aberto={conta.id}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 leading-none text-ink" aria-hidden>
          <span className="text-lg font-bold tabular-nums">{Number(conta.vencimento.slice(8, 10))}</span>
          <span className="mt-0.5 text-xs font-semibold uppercase">{MES_CURTO[Number(conta.vencimento.slice(5, 7)) - 1]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[16px] font-semibold leading-snug text-ink">{conta.nome}</span>
          <span className="block text-[13px] text-ink-muted">Toque para mudar</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {editaValor ? (
          <label className="flex min-h-11 w-full items-center gap-2 rounded-2xl bg-surface-2 px-3">
            <span className="shrink-0 text-[14px] text-ink-muted">{simbolo}</span>
            <CampoDeDinheiro
              autoFocus={!varia || antes.length === 0}
              valor={valor}
              onValor={(v) => {
                setValor(v);
                pronto.limpar();
              }}
              max={100_000_000}
              placeholder="Quanto deu?"
              aria-label={`Valor pago de ${conta.nome}`}
              className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-ink-muted"
              data-paguei-valor
            />
          </label>
        ) : (
          <button type="button" aria-pressed="true" onClick={() => setEditaValor(true)} className={CHIP_MARCADO} aria-label={`Valor ${money(valor ?? 0)}, tocar para mudar`}>
            {money(valor ?? 0)}
          </button>
        )}
        <button
          type="button"
          aria-pressed="true"
          aria-expanded={escolheDia}
          onClick={() => {
            setEscolheDia((v) => !v);
            setEscolheOrigem(false);
          }}
          className={CHIP_MARCADO}
          data-paguei-dia
        >
          <CalendarDays size={16} strokeWidth={1.8} className="shrink-0" aria-hidden />
          {rotuloDoDia(dia, hoje)}
        </button>
        <button
          type="button"
          aria-pressed="true"
          aria-expanded={escolheOrigem}
          onClick={() => {
            setEscolheOrigem((v) => !v);
            setEscolheDia(false);
          }}
          className={`${CHIP_MARCADO} min-w-0`}
          data-paguei-origem
        >
          <IconeDaOrigem tipo={daOrigem?.tipo ?? "conta"} />
          <span className="min-w-0 break-words text-left leading-tight">{daOrigem?.rotulo ?? "De onde saiu"}</span>
        </button>
      </div>

      {escolheDia && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Que dia">
          {[
            [hoje, "Hoje"],
            [ontem, "Ontem"],
          ].map(([d, rotulo]) => (
            <button
              key={d}
              type="button"
              aria-pressed={dia === d}
              onClick={() => {
                setDia(d);
                setOutroDia(false);
                setEscolheDia(false);
              }}
              className={dia === d ? CHIP_MARCADO : CHIP_SOLTO}
            >
              {rotulo}
            </button>
          ))}
          {outroDia ? (
            <input
              ref={campoDoDia}
              type="date"
              min={diaAntes(hoje, DIAS_PARA_TRAS)}
              max={hoje}
              value={outro ? dia : ""}
              onChange={(e) => {
                // Só de hoje para trás: "Paguei" é algo que já aconteceu.
                if (!diaValido(e.target.value, hoje)) return;
                setDia(e.target.value);
                setOutroDia(false);
                setEscolheDia(false);
              }}
              aria-label="Outro dia"
              className="min-h-10 rounded-full bg-surface px-3.5 text-[14px] text-ink shadow-[inset_0_0_0_1px_var(--color-border)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-accent)]"
              data-paguei-outro-dia
            />
          ) : (
            <button type="button" aria-pressed={outro} onClick={() => setOutroDia(true)} className={outro ? CHIP_MARCADO : CHIP_SOLTO}>
              Outro dia
            </button>
          )}
        </div>
      )}

      {escolheOrigem && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="De onde saiu">
          {dados.origens
            .filter((o) => o.chave !== origem)
            .map((o) => (
              <button
                key={o.chave}
                type="button"
                onClick={() => {
                  setOrigem(o.chave);
                  setEscolheOrigem(false);
                }}
                className={`${CHIP_SOLTO} min-w-0`}
              >
                <IconeDaOrigem tipo={o.tipo} />
                <span className="min-w-0 break-words text-left leading-tight">{o.rotulo}</span>
              </button>
            ))}
        </div>
      )}

      {varia && !valor && antes.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Valores de antes">
          {antes.map((a) => (
            <button
              key={a.mes}
              type="button"
              onClick={() => {
                setValor(a.valor);
                pronto.limpar();
              }}
              className={CHIP_SOLTO}
            >
              <span className="text-ink-muted">{mesCurto(a.mes)}</span> {money(a.valor)}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className={`flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-full px-4 text-[16px] font-semibold [background:var(--botao-fundo,var(--color-ink))] [color:var(--botao-tinta,var(--color-canvas))] [box-shadow:var(--botao-fio,none)] disabled:opacity-60 ${pronto.classe}`}
          data-paguei-pronto
        >
          {salvando ? "Anotando..." : "Pronto"}
        </button>
        <button type="button" onClick={onFechar} disabled={salvando} className="min-h-12 shrink-0 rounded-full bg-surface-2 px-4 text-[15px] font-medium text-ink">
          Agora não
        </button>
      </div>
      <ErroNoBotao erro={pronto.erro} lado="esquerda" />
    </div>
  );
}
