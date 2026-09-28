"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { avaliarCompra, pct as pctDaRenda, type CompraBase, type Veredito } from "@/lib/decisoes/posso-comprar";
import { registrarCompraAction } from "@/app/(app)/mensal/foco/actions";
import { ReportarErro } from "@/components/decisoes/ReportarErro";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function numero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function PossoComprar({ base, hoje }: { base: CompraBase; hoje: { ano: number; mes: number } }) {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [modo, setModo] = useState<"vista" | "parcelado">("parcelado");
  const [parcelas, setParcelas] = useState("10");
  const [juros, setJuros] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [decisao, setDecisao] = useState<string | null>(null);
  const [erroAoSalvar, setErroAoSalvar] = useState(false);
  const [salvando, startTransition] = useTransition();
  // Os mesmos limites do motor: desconto de 0 a 90%, parcelas de 1 a 48, e "parcelado em 1x" é à vista.
  const descontoPct = Math.min(90, Math.max(0, numero(desconto)));
  const nParcelas = Math.max(1, Math.min(48, Math.round(numero(parcelas))));
  const modoEfetivo = modo === "parcelado" && nParcelas <= 1 ? "vista" : modo;
  const custoDecidido = modoEfetivo === "vista" ? (valor ?? 0) * (1 - (modo === "vista" ? descontoPct : 0) / 100) : valor ?? 0;
  const registrar = (tipo: "compra_desisti" | "compra_amanha" | "compra_comprei", mensagem: string) =>
    startTransition(async () => {
      try {
        await registrarCompraAction({ tipo, valor: custoDecidido, descricao: descricao.trim().slice(0, 120) || undefined, modo: modoEfetivo, parcelas: modoEfetivo === "vista" ? 1 : nParcelas });
        setErroAoSalvar(false);
        setDecisao(mensagem);
      } catch {
        setErroAoSalvar(true);
      }
    });

  // Centavos só somem de valor grande: "R$ 0" pra uma compra de R$ 0,40 não serve.
  const m = (v: number) => money(v, { round: Math.abs(v) >= 100 });
  const pctRenda = (v: number) => pctDaRenda(v);
  const mesDaqui = (meses: number | null) => {
    if (meses === null) return "sem previsão";
    const d = new Date(hoje.ano, hoje.mes - 1 + meses, 1);
    return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const r = useMemo(
    () =>
      avaliarCompra(
        base,
        // O desconto vai sempre: no parcelado ele entra na comparação "à vista × parcelado".
        { valor: valor ?? 0, modo, parcelas: numero(parcelas), juros: numero(juros) / 100, desconto: descontoPct / 100, descricao },
        { money: m, mesDaqui },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- m e mesDaqui só dependem de money e hoje
    [base, valor, modo, parcelas, juros, descontoPct, descricao, money],
  );

  const selo: Record<Veredito, { texto: string; classe: string }> = {
    ok: { texto: t.compraOk, classe: "bg-success/12 text-success" },
    custo: { texto: t.compraCusto, classe: "bg-accent-soft text-accent-strong" },
    nao: { texto: t.compraNao, classe: "bg-danger/12 text-danger" },
  };
  const fundo: Record<Veredito, string> = { ok: "bg-success/10", custo: "bg-accent-soft", nao: "bg-danger/10" };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5 text-label font-medium text-ink-muted">
          O que você quer comprar?
          <input className={CONTROL_CLASSES} value={descricao} maxLength={120} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: celular" />
        </label>
        <CurrencyInputControlled label="Valor total" value={valor} onChange={setValor} />
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-2 p-1" role="group" aria-label="Forma de pagamento">
          {(["vista", "parcelado"] as const).map((op) => (
            <button
              key={op}
              type="button"
              aria-pressed={modo === op}
              onClick={() => setModo(op)}
              className={`rounded-full py-2 text-sm font-medium transition-all ${modo === op ? "bg-pill text-on-pill" : "text-ink-muted"}`}
            >
              {op === "vista" ? "À vista" : "Parcelado"}
            </button>
          ))}
        </div>
        {modo === "parcelado" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-label font-medium text-ink-muted">
              Em quantas vezes
              <input className={CONTROL_CLASSES} inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-label font-medium text-ink-muted">
              Juros ao mês (%)
              <input className={CONTROL_CLASSES} inputMode="decimal" value={juros} onChange={(e) => setJuros(e.target.value)} />
            </label>
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-label font-medium text-ink-muted">
          Desconto se pagar à vista (%)
          <input className={CONTROL_CLASSES} inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
        </label>
      </Card>

      {"erro" in r ? (
        r.erro === "valor" ? (
          <p className="px-1 text-caption text-ink-muted">Digite o valor pra eu fazer a conta.</p>
        ) : (
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">
              {r.erro === "renda" ? "Pra responder isso, preciso saber sua renda do mês." : "Pra responder isso, preciso do seu orçamento do mês."}
            </p>
            <p className="mt-1 text-caption text-ink-muted">Sem esse número eu estaria chutando, e sobre dinheiro eu prefiro perguntar.</p>
            <Link href="/orcamento" className="mt-3 inline-flex rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-on-pill">
              Preencher agora
            </Link>
          </Card>
        )
      ) : (
        <>
          {/* Dado que parece incompleto (orçamento que não cobre tudo, renda não planejada):
              aparece ANTES da resposta, pra ninguém decidir em cima de um número errado. */}
          {r.avisos?.map((a, i) => (
            <p key={i} role="status" className="rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-ink">
              {a}
            </p>
          ))}
          <div className={`rounded-2xl p-5 ${fundo[r.veredito]}`}>
            <span className={`inline-flex rounded-full px-3 py-1 text-caption font-semibold ${selo[r.veredito].classe}`}>{selo[r.veredito].texto}</span>
            <p className="mt-2 text-h2 font-bold tracking-tight text-ink">{r.titulo}</p>
            <p className="mt-1 text-sm text-ink">{r.explicacao}</p>
            {r.comprometimento && (
              <p className="mt-2 text-caption text-ink-muted">
                Hoje sua renda já está <b className="text-ink">{pctRenda(r.comprometimento.hoje)}</b> comprometida: {m(r.comprometimento.valor)} de {m(r.comprometimento.renda)}
                {r.comprometimento.fonte === "real"
                  ? " (a média do que você gastou nos últimos meses, que é maior que o seu orçamento)"
                  : r.comprometimento.fonte === "mes"
                    ? " (o que já saiu neste mês, que passou do orçamento)"
                    : " (seu orçamento do mês)"}
                . Com a compra:{" "}
                <b className={r.comprometimento.depois > 0.9 ? "text-danger" : "text-ink"}>{pctRenda(r.comprometimento.depois)}</b>.
              </p>
            )}
            {r.alertaJuros && (
              <p className="mt-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm font-medium text-ink">
                ⚠️ {r.alertaJuros} Se der, junte e compre à vista.
              </p>
            )}
          </div>

          <Card className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-caption uppercase tracking-wide text-ink-faint">
                  <th className="pb-2 text-left font-semibold" />
                  <th className="pb-2 text-right font-semibold">Hoje</th>
                  <th className="pb-2 text-right font-semibold">Com a compra</th>
                </tr>
              </thead>
              <tbody>
                {r.linhas.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-2 text-ink">{l.rotulo}</td>
                    <td className="py-2 text-right tabular-nums text-ink-muted">{l.hoje}</td>
                    <td className={`py-2 pl-2 text-right tabular-nums ${l.hoje !== l.depois ? "font-semibold text-ink" : "text-ink-muted"}`}>{l.depois}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {r.sugestao && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">{r.sugestao}</p>}

          {r.comparacao && (
            <Card className="p-5">
              <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">À vista ou parcelado? A regra de ouro</p>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-ink-muted">À vista{descontoPct > 0 ? ` com ${descontoPct.toLocaleString("pt-BR")}%` : ""}</dt>
                <dd className="text-right tabular-nums text-ink">{m(r.comparacao.vista)}</dd>
                <dt className="text-ink-muted">Parcelado, com o dinheiro rendendo</dt>
                <dd className="text-right tabular-nums text-ink">{m(r.comparacao.parceladoHoje)} em valor de hoje</dd>
              </dl>
              <p className="mt-2 text-sm text-ink">
                <b>{r.comparacao.melhor === "vista" ? "À vista vale mais" : "Parcelar vale mais"}</b>: cerca de {m(r.comparacao.diferenca)} de diferença.
                {r.comparacao.melhor === "parcelado" ? " Mas só se o dinheiro ficar de fato rendendo até a última parcela." : " O desconto é maior que o rendimento do dinheiro parado."}
              </p>
              <p className="mt-1 text-caption text-ink-faint">Rendimento de referência: {(base.taxaReferencia * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ao mês.</p>
            </Card>
          )}

          <details className="px-1">
            <summary className="cursor-pointer text-caption font-semibold text-accent-strong">{t.focoComoCheguei}</summary>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-caption">
              {r.conta.map((c) => (
                <div key={c.rotulo} className="contents">
                  <dt className="text-ink-muted">{c.rotulo}</dt>
                  <dd className="text-right tabular-nums text-ink">{c.valor}</dd>
                </div>
              ))}
            </dl>
          </details>

          <ReportarErro tela="Posso comprar?" regra="regra dos 90% + sonhos mais distantes perdem aporte primeiro; reserva por último" />

          {decisao ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink">{decisao}</p>
          ) : (
            <div className="grid gap-2">
              {erroAoSalvar && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">Não consegui salvar agora. Tenta de novo em instantes.</p>}
              <button
                type="button"
                disabled={salvando}
                onClick={() => registrar("compra_amanha", "Combinado. Amanhã ela aparece no seu Foco e você decide com a cabeça fria.")}
                className="rounded-2xl bg-pill px-4 py-3 text-sm font-semibold text-on-pill disabled:opacity-60"
              >
                {t.compraAmanha} (regra das 24 horas)
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  registrar(
                    "compra_comprei",
                    r.veredito === "nao" ? "Registrado. Essa compra passa do plano do mês: vale rever o orçamento no próximo fechamento." : "Registrado. Boa compra: agora é seguir o plano.",
                  )
                }
                className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent-strong disabled:opacity-60"
              >
                Vou comprar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => registrar("compra_desisti", `Ficou com você: ${m(custoDecidido)}. Entrou no que você conquistou.`)}
                className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-ink-muted disabled:opacity-60"
              >
                {t.compraDesisti}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
