"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { useToast } from "@/components/ui/toast-context";
import type { ConfigEmpresa } from "@/lib/empresa/config";
import { ajustarEmpresaAction } from "../actions";
import { Interruptor } from "../Assistente";
import { Cartao, Chip, Titulo, Voltar } from "../partes";

/**
 * Configurações da empresa (menu ☰ da Empresa). Cada mudança grava na hora. As taxas da maquininha são
 * as dela: sem elas, o Quanto cobrar sai sem taxa (o app não inventa número).
 */
export function ConfigDaEmpresa({ nome, config, seguro, temGuia }: { nome: string; config: ConfigEmpresa; seguro: number | null; temGuia: boolean }) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m0 = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [, iniciar] = useTransition();
  const [salario, setSalario] = useState(config.salario !== null ? String(config.salario) : "");
  const [credito, setCredito] = useState(config.taxas.credito !== null ? String(config.taxas.credito).replace(".", ",") : "");
  const [debito, setDebito] = useState(config.taxas.debito !== null ? String(config.taxas.debito).replace(".", ",") : "");
  const [horas, setHoras] = useState(config.horasPorMes);
  const [lembrete, setLembrete] = useState(config.lembreteDas);

  function salvar(m: Parameters<typeof ajustarEmpresaAction>[0], msg = "Salvo") {
    iniciar(async () => {
      const r = await ajustarEmpresaAction(m);
      if (!r.ok) return showError(r.erro);
      showToast(msg);
      router.refresh();
    });
  }
  const pct = (t: string) => (t.trim() === "" ? null : Number(t.replace(",", ".")));
  const linha = "flex min-h-16 items-center justify-between gap-3 border-b border-border py-2 last:border-b-0";

  return (
    <>
      <Voltar>{nome}</Voltar>
      <Titulo>Configurações da empresa</Titulo>

      <Cartao className="px-4">
        <div className={`${linha} flex-wrap`}>
          <span>
            <b className="block text-[15px] font-medium text-ink">Seu salário</b>
            <small className="text-xs text-ink-muted">
              todo dia {config.diaDoSalario}
              {config.salario === null && seguro !== null ? ", o seguro" : ""}
            </small>
          </span>
          <span className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
            <span className="text-sm text-ink-muted">{simbolo}</span>
            <input
              inputMode="numeric"
              value={salario}
              placeholder={seguro !== null ? String(seguro) : "0"}
              onChange={(e) => setSalario(e.target.value.replace(/\D/g, "").slice(0, 7))}
              onBlur={() => salvar({ salario: salario === "" ? null : Number(salario) })}
              aria-label="Seu salário por mês, em reais"
              className="w-24 bg-transparent text-right text-[17px] font-medium tabular-nums text-ink outline-none"
            />
          </span>
          {seguro !== null && (
            <div className="w-full pb-2">
              <Chip on={config.salario === null} onClick={() => { setSalario(""); salvar({ salario: null }); }}>
                Usar o seguro, {m0(seguro)}
              </Chip>
            </div>
          )}
        </div>
        {config.tipo === "MEI" && temGuia && (
          <div className={linha}>
            <span>
              <b className="block text-[15px] font-medium text-ink">Lembrete da guia</b>
              <small className="text-xs text-ink-muted">na véspera e no dia do vencimento</small>
            </span>
            <Interruptor ligado={lembrete} rotulo="Lembrete da guia" onTrocar={() => { const v = !lembrete; setLembrete(v); salvar({ lembreteDas: v }, v ? "Lembrete ligado" : "Lembrete desligado"); }} />
          </div>
        )}
      </Cartao>

      <h2 className="mt-2 px-1 text-lg font-medium text-ink">Maquininha</h2>
      <Cartao className="px-4">
        {(
          [
            ["Crédito", credito, setCredito, "credito"],
            ["Débito", debito, setDebito, "debito"],
          ] as const
        ).map(([t, v, set, k]) => (
          <div key={k} className={linha}>
            <b className="text-[15px] font-medium text-ink">{t}</b>
            <span className="flex items-center gap-1 rounded-2xl bg-surface-2 px-3 py-2">
              <input
                inputMode="decimal"
                value={v}
                placeholder="0,0"
                onChange={(e) => set(e.target.value.replace(/[^\d,]/g, "").slice(0, 5))}
                onBlur={() => salvar({ taxas: { credito: k === "credito" ? pct(v) : pct(credito), debito: k === "debito" ? pct(v) : pct(debito) } })}
                aria-label={`Taxa do ${t.toLowerCase()}, em porcentagem`}
                className="w-14 bg-transparent text-right text-[17px] font-medium tabular-nums text-ink outline-none"
              />
              <span className="text-sm text-ink-muted">%</span>
            </span>
          </div>
        ))}
      </Cartao>
      <p className="-mt-2 px-1 text-xs text-ink-muted">A taxa da sua maquininha entra no Quanto cobrar.</p>

      <Cartao className="px-4">
        <div className={linha}>
          <span>
            <b className="block text-[15px] font-medium text-ink">Horas de trabalho</b>
            <small className="text-xs text-ink-muted">por mês, para o valor da sua hora</small>
          </span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="Menos horas" onClick={() => { const h = Math.max(10, horas - 10); setHoras(h); salvar({ horasPorMes: h }); }} className="flex size-10 items-center justify-center rounded-full border border-border text-ink">
              <Minus size={16} aria-hidden />
            </button>
            <b className="w-12 text-center text-[15px] font-medium tabular-nums text-ink">{horas} h</b>
            <button type="button" aria-label="Mais horas" onClick={() => { const h = Math.min(400, horas + 10); setHoras(h); salvar({ horasPorMes: h }); }} className="flex size-10 items-center justify-center rounded-full border border-border text-ink">
              <Plus size={16} aria-hidden />
            </button>
          </span>
        </div>
        <div className={linha}>
          <b className="text-[15px] font-medium text-ink">Tipo</b>
          <span className="text-[15px] text-ink">{config.tipo === "MEI" ? "MEI" : config.tipo === "ME" ? "ME, em breve" : "Autônoma, em breve"}</span>
        </div>
        <Link href="/empresa?assistente=1" className={`${linha} text-[15px] text-ink`}>
          Refazer as perguntas do começo
          <ChevronRight size={18} className="text-ink-muted" aria-hidden />
        </Link>
      </Cartao>
    </>
  );
}
