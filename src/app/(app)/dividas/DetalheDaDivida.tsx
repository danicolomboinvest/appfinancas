"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Explica } from "@/components/ui/Explica";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { ehImpossivel, type Plano, type PlanoImpossivel } from "@/lib/dividas/plano";
import { taxaDe } from "@/lib/dividas/tipos";
import { FRASE_DA_SAUDE, saudeDe, taxaAnual, type DividaDoSpi } from "@/lib/dividas/saude";
import { desfazerAction, pagarParcelaAction, quitarDividaAction } from "./actions";
import { MaisDaDivida } from "./MenuDaDivida";
import { SeloDaSaude, mesAdiante, mesPorExtenso, pct, valorDigitado, type Hoje } from "./partes";

/**
 * O detalhe de uma dívida: o selo e a frase, quanto falta (com o que já foi pago), os fatos e as
 * três ações: "Paguei uma parcela", "Editar" e "Quitei", as duas que mudam o saldo com Desfazer.
 */
export function DetalheDaDivida({
  divida,
  selic,
  selicDeExemplo,
  plano,
  hoje,
  onFechar,
  onEditar,
}: {
  divida: DividaDoSpi | null;
  selic: number;
  selicDeExemplo: boolean;
  plano: Plano | PlanoImpossivel | null;
  hoje: Hoje;
  onFechar: () => void;
  onEditar: (d: DividaDoSpi) => void;
}) {
  const money = useMoney();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [ocupado, startTransition] = useTransition();

  if (!divida) return <Modal open={false} onClose={onFechar} title="Dívida">{null}</Modal>;
  const d = divida;
  const saude = saudeDe(d, selic);
  const tx = taxaDe(d);
  const anual = taxaAnual(tx.taxa);
  const q = saude !== "saudavel" && plano && !ehImpossivel(plano) ? plano.quitacoes.find((x) => x.id === d.id) : null;
  const pagas = d.parcelasTotal && d.parcelasAbertas != null ? d.parcelasTotal - d.parcelasAbertas : null;
  const fracaoPaga = pagas != null && d.parcelasTotal ? pagas / d.parcelasTotal : null;

  const desfazer = (antes: { saldo: number; parcelasAbertas: number | null; quitada: boolean }) => () =>
    startTransition(async () => {
      await desfazerAction(d.id, antes);
      router.refresh();
    });

  const paguei = () =>
    startTransition(async () => {
      const r = await pagarParcelaAction(d.id);
      if (!r) return showError("Não deu para registrar. Tente de novo.");
      if (r.quitada) onFechar();
      showToast(r.quitada ? `${d.nome} quitada` : "Parcela registrada", { label: "Desfazer", onClick: desfazer(r.antes) });
      router.refresh();
    });

  const quitei = () =>
    startTransition(async () => {
      await quitarDividaAction(d.id);
      onFechar();
      showToast(`${d.nome} quitada`, { label: "Desfazer", onClick: desfazer({ saldo: d.saldo, parcelasAbertas: d.parcelasAbertas, quitada: false }) });
      router.refresh();
    });

  const fato = (rotulo: string, valor: React.ReactNode, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-3 text-[15px]">
      <dt className="shrink-0 text-ink-muted">{rotulo}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-1 text-right font-medium text-ink">
        {valor}
        {extra}
      </dd>
    </div>
  );

  return (
    <Modal open onClose={onFechar} title={d.nome} acoes={<MaisDaDivida divida={d} onEditar={() => onEditar(d)} onApagou={onFechar} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-1.5">
          <SeloDaSaude saude={saude} comIcone />
          <p className="text-[15px] leading-snug text-ink">{FRASE_DA_SAUDE[saude].frase}</p>
        </div>
        <div className="flex flex-col gap-1">
          <small className="text-sm text-ink-muted">Falta pagar</small>
          <ValorDestaque texto={money(d.saldo)} className="text-[2.25rem] font-light leading-tight tracking-[-0.03em] tabular-nums text-ink" />
          {fracaoPaga !== null && (
            <>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <i className="block h-full rounded-full bg-success" style={{ width: `${(fracaoPaga * 100).toFixed(1)}%` }} />
              </div>
              <span className="text-[13px] text-ink-muted">
                {pagas} de {d.parcelasTotal} parcelas pagas
              </span>
            </>
          )}
        </div>
        <dl className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface px-3.5">
          {q && fato("Cai em", mesPorExtenso(mesAdiante(hoje, q.mes)))}
          {fato("Por mês", d.semParcela ? (d.porMes ? `${valorDigitado(money, d.porMes)} (sem parcela fixa)` : "Sem parcela fixa") : valorDigitado(money, d.porMes))}
          {d.parcelasAbertas != null && !d.semParcela && fato("Parcelas", `faltam ${d.parcelasAbertas} de ${d.parcelasTotal}`)}
          {d.diaVencimento && fato("Vencimento", <>todo dia {d.diaVencimento}{d.atrasada && <span className="text-danger"> · atrasada</span>}</>)}
          {fato("Juros", `${pct(tx.taxa)}% ao mês${tx.estimada ? " (estimada)" : ""}`)}
          {fato(
            "Ao ano",
            <>
              {pct(anual, 0)}% ·{" "}
              <span className={anual < selic ? "text-success" : "text-danger"}>{anual < selic ? "abaixo" : "acima"} da Selic</span>
            </>,
            <Explica rotulo="O que é a Selic aqui?">
              A Selic aqui é {selicDeExemplo ? "um valor de exemplo, até você cadastrar a sua em Taxas de referência" : "a das Taxas de referência"}: {pct(selic, 2)}% ao ano. Juros da
              dívida acima da Selic: foco em quitar. Abaixo: dá para investir e ir quitando. A taxa ao mês vira ao ano por juros compostos.
            </Explica>,
          )}
          {d.paraQue && fato("Para que foi", `${d.paraQue}${d.planejada ? " · planejada" : ""}`)}
        </dl>
        <div className="flex flex-col gap-2">
          {/* Sem nada por mês, "Paguei uma parcela" só somava os juros e ainda dizia "Parcela registrada". */}
          {d.porMes > 0 && (
            <button type="button" disabled={ocupado} onClick={paguei} className="min-h-12 rounded-full border border-border bg-surface-2 px-4 text-[15px] text-ink disabled:opacity-60">
              Paguei uma parcela
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onEditar(d)} className="min-h-12 rounded-full border border-border bg-surface-2 px-4 text-[15px] text-ink">
              Editar
            </button>
            <button type="button" disabled={ocupado} onClick={quitei} className="min-h-12 rounded-full border border-border bg-surface-2 px-4 text-[15px] text-ink disabled:opacity-60">
              Quitei
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
