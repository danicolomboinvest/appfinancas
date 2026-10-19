"use client";

import { useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, CreditCard } from "lucide-react";
import { ErroNoBotao } from "@/components/ui/ErroNoBotao";
import { LogoDoBanco } from "@/components/cartao/LogoDoBanco";
import { BANCOS_DO_CARTAO, bancoDoCartao, nomeDoCartao, rotuloDoCartao } from "@/lib/cartao/bancos";
import { diaCurto, faturaDe, melhorDiaParaComprar, nomeDaFatura, testesDeCompra, type Dia } from "@/lib/cartao/fatura";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { salvarCartaoAction, type CartaoNaTela } from "@/app/(app)/orcamento/cartao/cartoes-actions";

/**
 * Cadastrar o cartão (15/10/2026, versão A do mockup aprovado): uma pergunta por tela. Qual é o
 * cartão, que dia a fatura fecha, que dia vence. No fim, o cartão pronto com o melhor dia para
 * comprar e o "Testar uma compra", que mostra em que fatura ela cai. Ninguém sabe os dias de cor:
 * a dica diz onde achar.
 *
 * Apelido (18/10/2026, a Dani, pedido de uma cliente com dois cartões do mesmo banco): no fim,
 * antes do "Salvar cartão", "Como você chama este cartão?", opcional. Vazio = o nome do banco.
 * "Mudar nome ou dias" reabre aqui já preenchido, e é por aqui que ela renomeia.
 */
export function CadastroDoCartao({ inicial, onSalvo }: { inicial?: CartaoNaTela | null; onSalvo: (c: CartaoNaTela) => void }) {
  const [passo, setPasso] = useState(inicial ? 3 : 0);
  const [banco, setBanco] = useState(inicial?.banco ?? "");
  const [fecha, setFecha] = useState(inicial?.diaFechamento ?? 0);
  const [vence, setVence] = useState(inicial?.diaVencimento ?? 0);
  const [teste, setTeste] = useState(0);
  const [apelido, setApelido] = useState(inicial?.apelido ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const [hoje] = useState<Dia>(() => {
    const d = nowInBrazil();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
  });

  const nomeDoBanco = banco && banco !== "outro" ? bancoDoCartao(banco).nome : "banco";
  const pontos = (
    <div className="flex justify-center gap-1.5" aria-label={`Passo ${Math.min(passo + 1, 3)} de 3`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={`h-1.5 rounded-full transition-all ${i <= passo ? "w-6 bg-ink" : "w-1.5 bg-border-strong"}`} />
      ))}
    </div>
  );
  const voltar = passo > 0 && (
    <button type="button" onClick={() => setPasso((p) => p - 1)} className="-ml-1 flex min-h-10 w-fit items-center gap-1 text-sm text-ink-muted">
      <ChevronLeft size={18} aria-hidden />
      Voltar
    </button>
  );
  const grade = (sel: number, marca: number, escolher: (d: number) => void, rotulo: string) => (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={rotulo}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={sel === d}
          aria-label={`Dia ${d}`}
          onClick={() => escolher(d)}
          className={`flex h-11 min-w-0 items-center justify-center rounded-xl text-[15px] tabular-nums transition-colors ${
            sel === d ? "bg-ink font-semibold text-canvas" : marca === d ? "bg-accent-soft font-medium text-accent-strong ring-1 ring-accent" : "bg-surface text-ink ring-1 ring-border"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );

  if (passo === 0)
    return (
      <div className="flex flex-col gap-4">
        {pontos}
        <h2 className="text-h2 font-semibold tracking-tight text-ink">Qual é o cartão?</h2>
        <div className="grid grid-cols-3 gap-2">
          {BANCOS_DO_CARTAO.map((b) => (
            <button
              key={b.slug}
              type="button"
              aria-pressed={banco === b.slug}
              onClick={() => (setBanco(b.slug), setPasso(1))}
              className={`flex min-h-[92px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl px-1 py-2.5 text-center text-[13px] leading-tight text-ink transition-colors ${
                banco === b.slug ? "bg-accent-soft ring-2 ring-ink" : "bg-surface ring-1 ring-border"
              }`}
            >
              <LogoDoBanco banco={b.slug} size={40} />
              <span className="w-full break-words">{b.nome}</span>
            </button>
          ))}
        </div>
      </div>
    );

  if (passo === 1)
    return (
      <div className="flex flex-col gap-4">
        {pontos}
        {voltar}
        <div>
          <h2 className="text-h2 font-semibold tracking-tight text-ink">Que dia a fatura fecha?</h2>
          <p className="mt-1 text-sm text-ink-muted">Está no app do {nomeDoBanco}, em Fatura.</p>
        </div>
        {grade(fecha, 0, (d) => (setFecha(d), setPasso(2)), "Dia do fechamento")}
      </div>
    );

  if (passo === 2)
    return (
      <div className="flex flex-col gap-4">
        {pontos}
        {voltar}
        <div>
          <h2 className="text-h2 font-semibold tracking-tight text-ink">E que dia vence?</h2>
          <p className="mt-1 text-sm text-ink-muted">O dia {fecha} é o fechamento.</p>
        </div>
        {grade(vence, fecha, (d) => (setVence(d), setTeste(0), setPasso(3)), "Dia do vencimento")}
      </div>
    );

  const dias = { diaFechamento: fecha, diaVencimento: vence };
  const testes = testesDeCompra(hoje, dias);
  const sel = testes[Math.min(teste, testes.length - 1)];
  const fatura = faturaDe(sel.dia, dias);
  const rotuloDoTeste = (t: (typeof testes)[number]) => (t.chave === "hoje" ? "Hoje" : `${t.dia.dia}/${String(t.dia.mes).padStart(2, "0")}`);

  const salvar = () => {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await salvarCartaoAction({ id: inicial?.id ?? null, banco, apelido: apelido.trim() || null, diaFechamento: fecha, diaVencimento: vence });
        if (!r.ok) return setErro(r.error);
        onSalvo(r.cartao);
      } catch {
        setErro("Não salvou. Tente de novo.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {voltar}
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-premium-sm ring-1 ring-border">
        <div className="flex min-w-0 items-center gap-3">
          <LogoDoBanco banco={banco} size={44} />
          <p className="min-w-0 break-words text-[17px] font-semibold text-ink">{rotuloDoCartao({ banco, apelido })}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <p className="text-caption text-ink-muted">Fecha</p>
            <p className="text-[17px] font-semibold text-ink">dia {fecha}</p>
          </div>
          <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <p className="text-caption text-ink-muted">Vence</p>
            <p className="text-[17px] font-semibold text-ink">dia {vence}</p>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[15px] font-medium text-ink">
        <CalendarDays size={18} className="shrink-0 text-accent-strong" aria-hidden />
        Melhor dia para comprar: dia {melhorDiaParaComprar(dias)}
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink-muted">Testar uma compra</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Testar uma compra">
          {testes.map((t, i) => (
            <button key={t.chave} type="button" aria-pressed={sel === t} onClick={() => setTeste(i)} className={`min-h-10 rounded-full px-4 text-sm ${sel === t ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-border"}`}>
              {rotuloDoTeste(t)}
            </button>
          ))}
        </div>
        <p key={`${sel.chave}-${fatura.chave}`} className="flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-[15px] text-ink ring-1 ring-border" aria-live="polite">
          <CreditCard size={18} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
          <span className="min-w-0">
            Vai para a fatura de <b className="font-semibold">{nomeDaFatura(fatura, hoje.ano)}</b>, que vence {diaCurto(fatura.vencimento)}
          </span>
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-ink">Como você chama este cartão?</span>
        <input
          value={apelido}
          onChange={(e) => setApelido(e.target.value.slice(0, 40))}
          maxLength={40}
          placeholder={nomeDoCartao({ banco, apelido: null })}
          autoComplete="off"
          enterKeyHint="done"
          className="box-border min-h-12 w-full min-w-0 rounded-2xl border border-border bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-ink-muted focus:border-ink"
        />
      </label>

      <div>
        <button type="button" onClick={salvar} disabled={salvando} className="min-h-12 w-full rounded-full bg-ink text-[16px] font-medium text-canvas disabled:opacity-40">
          {salvando ? "Salvando..." : "Salvar cartão"}
        </button>
        <ErroNoBotao erro={salvando ? null : erro} />
      </div>
    </div>
  );
}
