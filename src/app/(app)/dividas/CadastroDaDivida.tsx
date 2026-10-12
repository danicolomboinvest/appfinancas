"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, CircleCheck, TriangleAlert, Zap } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Explica } from "@/components/ui/Explica";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { escolherTipo, perfilDoTipo, taxaDe, taxaEstimadaDoTipo, TIPOS, type TipoDeDivida } from "@/lib/dividas/tipos";
import { ehImpossivel, simularQuitacao } from "@/lib/dividas/plano";
import { FRASE_DA_SAUDE, PARA_QUE_FOI, nomeDaDivida, paraResolver, saudeDe, taxaAnual, type DividaDoSpi } from "@/lib/dividas/saude";
import { salvarDividaAction } from "./actions";
import { COR_DA_SAUDE, ICONE, mesAdiante, mesCurto, pct, type Hoje } from "./partes";

const PASSOS = 8;

type Rascunho = {
  tipo: TipoDeDivida | null;
  paraQue: string | null;
  planejada: boolean | null;
  credor: string;
  apelido: string;
  saldo: number;
  porMes: number | null;
  parcelasAbertas: number | null;
  parcelasTotal: number | null;
  semParcela: boolean;
  taxa: number | null;
  naoSei: boolean;
  dia: number | null;
  atrasada: boolean | null;
};

function rascunhoDe(d?: DividaDoSpi): Rascunho {
  if (!d) return { tipo: null, paraQue: null, planejada: null, credor: "", apelido: "", saldo: 0, porMes: null, parcelasAbertas: null, parcelasTotal: null, semParcela: false, taxa: null, naoSei: false, dia: null, atrasada: null };
  return {
    tipo: d.tipo,
    paraQue: d.paraQue,
    planejada: d.planejada,
    credor: d.credor,
    apelido: d.apelido,
    saldo: d.saldo,
    porMes: d.porMes,
    parcelasAbertas: d.parcelasAbertas,
    parcelasTotal: d.parcelasTotal,
    semParcela: d.semParcela,
    taxa: d.taxaMensal,
    naoSei: d.taxaMensal === null,
    dia: d.diaVencimento,
    atrasada: d.atrasada,
  };
}

const soDigitos = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
const milhar = (v: number) => (v ? Math.round(v).toLocaleString("pt-BR") : "");

/**
 * O cadastro guiado: uma pergunta por tela, 8 passos, e a revelação com o selo (Saudável, Atenção
 * ou Cara) e o canhoto destacável com o mês em que ela cai. Os passos de escolha andam sozinhos.
 */
export function CadastroDaDivida({
  aberto,
  divida,
  selic,
  hoje,
  dividas,
  extra,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  divida?: DividaDoSpi;
  selic: number;
  hoje: Hoje;
  dividas: DividaDoSpi[];
  extra: number;
  onFechar: () => void;
  onSalvo: (editou: boolean) => void;
}) {
  const [passo, setPasso] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(divida));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m0 = (v: number) => money(v, { round: true });
  const editar = divida?.id;

  // Cada vez que abre, começa do passo 1 com a dívida que veio (ou em branco).
  const abertoAntes = useRef(false);
  useEffect(() => {
    if (aberto && !abertoAntes.current) {
      setR(rascunhoDe(divida));
      setPasso(1);
      setErro(null);
    }
    abertoAntes.current = aberto;
  }, [aberto, divida]);

  const muda = (p: Partial<Rascunho>) => {
    setR((x) => ({ ...x, ...p }));
    setErro(null);
  };
  const raiz = useRef<HTMLDivElement>(null);
  const vai = (p: number, d: 1 | -1 = 1) => {
    setDir(d);
    setPasso(p);
    setErro(null);
    // Cada passo começa do alto da folha: no iPhone, com a folha rolada (a grade dos tipos é
    // longa), o passo seguinte nascia fora da vista e o toque parecia não ter feito nada.
    requestAnimationFrame(() => raiz.current?.closest('[role="dialog"]')?.scrollTo({ top: 0 }));
  };
  const perfil = r.tipo ? perfilDoTipo(r.tipo) : null;

  const dividaPronta = (): DividaDoSpi => ({
    id: editar ?? "nova",
    tipo: r.tipo ?? "outra",
    credor: r.credor.trim(),
    apelido: r.apelido.trim(),
    nome: nomeDaDivida(r.credor, r.apelido) || (perfil?.nome ?? ""),
    paraQue: r.paraQue,
    planejada: !!r.planejada,
    saldo: r.saldo,
    porMes: r.porMes ?? 0,
    parcelasAbertas: !r.semParcela && r.parcelasAbertas ? r.parcelasAbertas : null,
    parcelasTotal: !r.semParcela && r.parcelasAbertas ? Math.max(r.parcelasTotal ?? r.parcelasAbertas, r.parcelasAbertas) : null,
    semParcela: r.semParcela,
    taxaMensal: r.naoSei ? null : r.taxa,
    diaVencimento: r.dia,
    atrasada: !!r.atrasada,
  });

  const salvar = () => {
    const d = dividaPronta();
    startTransition(async () => {
      const res = await salvarDividaAction({
        id: editar,
        tipo: d.tipo,
        credor: d.credor,
        apelido: d.apelido,
        paraQue: d.paraQue,
        planejada: d.planejada,
        saldo: d.saldo,
        porMes: d.porMes,
        parcelasAbertas: d.parcelasAbertas,
        parcelasTotal: d.parcelasTotal,
        semParcela: d.semParcela,
        taxaMensal: d.taxaMensal,
        diaVencimento: d.diaVencimento,
        atrasada: d.atrasada,
      });
      if (!res.ok) return setErro(res.erro);
      onSalvo(!!editar);
    });
  };

  const continuar = (ok: boolean, prox: number, msg?: string) => (
    <>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <button
        type="button"
        onClick={() => (ok ? vai(prox) : setErro(msg ?? "Falta responder."))}
        className="mt-1 min-h-12 w-full rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent"
      >
        {prox > PASSOS ? "Ver o resultado" : "Continuar"}
      </button>
    </>
  );
  const pergunta = (t: string) => <p className="text-xl font-medium leading-snug text-ink">{t}</p>;
  const opcao = (on: boolean) => (on ? "ring-[1.5px] ring-ink" : "ring-1 ring-border");
  const campo = "min-h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-[17px] text-ink outline-none focus:border-ink";

  let corpo: React.ReactNode = null;
  if (passo === 1) {
    corpo = (
      <>
        {pergunta("Que tipo?")}
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de dívida">
          {TIPOS.map((t) => {
            const Icone = ICONE[t.icone];
            const on = r.tipo === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  muda(escolherTipo(r.tipo, t.id, !!editar));
                  vai(2);
                }}
                className={`flex min-h-[92px] flex-col items-start gap-2 rounded-2xl bg-surface p-3 text-left ${opcao(on)}`}
              >
                <span className="flex size-[34px] items-center justify-center rounded-full ring-[1.5px] ring-border-strong text-ink">
                  <Icone size={18} strokeWidth={1.6} aria-hidden />
                </span>
                <b className="text-sm font-medium leading-tight text-ink">{t.nome}</b>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (passo === 2) {
    corpo = (
      <>
        {pergunta("Para que foi?")}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Para que foi">
          {PARA_QUE_FOI.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={r.paraQue === p}
              onClick={() => {
                muda({ paraQue: p });
                vai(3);
              }}
              className={`min-h-11 whitespace-nowrap rounded-full px-[18px] text-[15px] ${r.paraQue === p ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-border"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </>
    );
  } else if (passo === 3) {
    const sn = (sim: boolean, rotulo: string, Icone: typeof CircleCheck) => (
      <button
        type="button"
        aria-pressed={r.planejada === sim}
        onClick={() => {
          muda({ planejada: sim });
          vai(4);
        }}
        className={`flex items-center gap-3.5 rounded-3xl bg-surface px-4 py-[18px] text-left text-[17px] font-medium text-ink ${opcao(r.planejada === sim)}`}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-2">
          <Icone size={20} strokeWidth={1.6} aria-hidden />
        </span>
        {rotulo}
      </button>
    );
    corpo = (
      <>
        {pergunta("Foi planejada?")}
        <div className="flex flex-col gap-2.5">
          {sn(true, "Sim, eu planejei", CircleCheck)}
          {sn(false, "Não, aconteceu", Zap)}
        </div>
      </>
    );
  } else if (passo === 4) {
    const previa = nomeDaDivida(r.credor, r.apelido) || perfil?.nome;
    corpo = (
      <>
        {pergunta("Com quem é?")}
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Credor
          <input className={campo} maxLength={40} autoComplete="off" autoFocus placeholder={r.tipo === "pessoa" ? "Ex.: Mãe" : "Ex.: Caixa, Nubank"} value={r.credor} onChange={(e) => muda({ credor: e.target.value.replace(/[<>]/g, "") })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Um nome que você reconhece
          <input className={campo} maxLength={40} autoComplete="off" placeholder="Ex.: Apê, Fatura" value={r.apelido} onChange={(e) => muda({ apelido: e.target.value.replace(/[<>]/g, "") })} />
        </label>
        <p className="text-sm text-ink-muted">{previa}</p>
        {continuar(!!(r.credor.trim() || r.apelido.trim()), 5, "Diga com quem é a dívida.")}
      </>
    );
  } else if (passo === 5) {
    corpo = (
      <>
        {pergunta("Quanto falta pagar?")}
        <label className="flex items-baseline gap-2 border-b border-border-strong pb-2">
          <span className="text-lg text-ink-muted">{simbolo}</span>
          <input inputMode="numeric" autoFocus aria-label="Valor total hoje" placeholder="0" value={milhar(r.saldo)} onChange={(e) => muda({ saldo: soDigitos(e.target.value) })} className="w-full bg-transparent text-[2.25rem] font-light tabular-nums text-ink outline-none" />
        </label>
        <p className="text-sm text-ink-muted">O total de hoje, somando o que falta.</p>
        {continuar(r.saldo > 0, 6, "Digite quanto falta pagar.")}
      </>
    );
  } else if (passo === 6) {
    const sp = r.semParcela;
    const parcelasOk = sp || !r.parcelasAbertas || !r.parcelasTotal || r.parcelasAbertas <= r.parcelasTotal;
    corpo = (
      <>
        {pergunta(sp ? "Quanto você paga por mês?" : "Parcela por mês")}
        <label className="flex items-baseline gap-2 border-b border-border-strong pb-2">
          <span className="text-lg text-ink-muted">{simbolo}</span>
          <input inputMode="numeric" autoFocus aria-label={sp ? "Quanto paga por mês" : "Parcela por mês"} placeholder="0" value={milhar(r.porMes ?? 0)} onChange={(e) => muda({ porMes: soDigitos(e.target.value) })} className="w-full bg-transparent text-[2.25rem] font-light tabular-nums text-ink outline-none" />
        </label>
        {sp ? (
          <p className="text-sm text-ink-muted">Pode ser zero, se hoje você não está pagando.</p>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[15px] text-ink">
            Faltam
            <input inputMode="numeric" maxLength={3} aria-label="Parcelas em aberto" placeholder="18" value={r.parcelasAbertas ?? ""} onChange={(e) => muda({ parcelasAbertas: soDigitos(e.target.value) || null })} className={`${campo} w-16 px-0 text-center`} />
            de
            <input inputMode="numeric" maxLength={3} aria-label="Total de parcelas" placeholder="48" value={r.parcelasTotal ?? ""} onChange={(e) => muda({ parcelasTotal: soDigitos(e.target.value) || null })} className={`${campo} w-16 px-0 text-center`} />
            parcelas
          </div>
        )}
        <button type="button" aria-pressed={sp} onClick={() => muda({ semParcela: !sp })} className={`inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-4 text-sm ${sp ? "bg-ink text-canvas" : "text-ink ring-1 ring-border"}`}>
          {sp && <Check size={16} strokeWidth={2} aria-hidden />}
          Não tem parcela fixa
        </button>
        {continuar(parcelasOk, 7, "Faltam mais parcelas do que o total.")}
      </>
    );
  } else if (passo === 7) {
    const est = r.tipo ? taxaEstimadaDoTipo(r.tipo) : 0;
    corpo = (
      <>
        {pergunta("Juros ao mês")}
        <label className={`flex items-baseline gap-2 border-b border-border-strong pb-2 ${r.naoSei ? "opacity-40" : ""}`}>
          <input
            inputMode="decimal"
            autoFocus
            disabled={r.naoSei}
            aria-label="Taxa ao mês"
            placeholder="0"
            defaultValue={r.naoSei || r.taxa === null ? "" : String(r.taxa).replace(".", ",")}
            onChange={(e) => {
              const v = parseFloat(e.target.value.replace(",", "."));
              muda({ taxa: Number.isFinite(v) ? v : null });
            }}
            className="w-28 bg-transparent text-[2.25rem] font-light tabular-nums text-ink outline-none"
          />
          <span className="text-lg text-ink-muted">% ao mês</span>
        </label>
        <button type="button" aria-pressed={r.naoSei} onClick={() => muda({ naoSei: !r.naoSei })} className={`inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-4 text-sm ${r.naoSei ? "bg-ink text-canvas" : "text-ink ring-1 ring-border"}`}>
          {r.naoSei && <Check size={16} strokeWidth={2} aria-hidden />}
          Não sei
        </button>
        {r.naoSei && perfil && (
          <p className="flex items-center justify-center gap-1 text-center text-sm text-ink-muted">
            Vou usar {pct(est)}% ao mês, {perfil.tetoLegal !== undefined ? "o teto da lei" : "o meio da faixa típica"} (estimada).
            <Explica rotulo="De onde vem?">
              {perfil.nome}: faixa típica de {pct(perfil.faixa[0])}% a {pct(perfil.faixa[1])}% ao mês.{perfil.tetoLegal !== undefined ? ` A lei limita a ${pct(perfil.tetoLegal)}%.` : ""}
            </Explica>
          </p>
        )}
        {continuar(r.naoSei || (r.taxa !== null && r.taxa >= 0 && r.taxa <= 100), 8, "Digite a taxa ou toque em Não sei.")}
      </>
    );
  } else if (passo === 8) {
    corpo = (
      <>
        {pergunta("Vence que dia?")}
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Dia do vencimento">
          {Array.from({ length: 31 }, (_, k) => k + 1).map((dia) => (
            <button key={dia} type="button" aria-pressed={r.dia === dia} onClick={() => muda({ dia })} className={`h-10 rounded-[10px] text-sm tabular-nums ${r.dia === dia ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-border"}`}>
              {dia}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-[15px] text-ink">
          Está atrasada?
          <div className="grid w-40 grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
            {[false, true].map((sim) => (
              <button key={String(sim)} type="button" aria-pressed={r.atrasada === sim} onClick={() => muda({ atrasada: sim })} className={`min-h-9 rounded-full text-sm ${r.atrasada === sim ? "bg-surface text-ink shadow-premium-sm" : "text-ink-muted"}`}>
                {sim ? "Sim" : "Não"}
              </button>
            ))}
          </div>
        </div>
        {continuar(r.atrasada !== null, 9, "Diga se está atrasada.")}
      </>
    );
  } else {
    corpo = <Revelacao divida={dividaPronta()} selic={selic} hoje={hoje} dividas={dividas} extra={extra} m0={m0} />;
  }

  return (
    <Modal open={aberto} onClose={onFechar} title={editar ? "Editar dívida" : "Nova dívida"}>
      <div ref={raiz} className="flex flex-col gap-4">
        {passo <= PASSOS && (
          <div className="flex items-center gap-3">
            {passo > 1 && (
              <button type="button" onClick={() => vai(passo - 1, -1)} className="-ml-1 inline-flex min-h-9 items-center gap-0.5 text-sm text-ink-muted">
                <ChevronLeft size={18} strokeWidth={1.8} aria-hidden /> Voltar
              </button>
            )}
            <div className="flex flex-1 gap-1" aria-label={`Passo ${passo} de ${PASSOS}`}>
              {Array.from({ length: PASSOS }, (_, k) => (
                <i key={k} className={`h-1 flex-1 rounded-full ${k < passo ? "bg-ink" : "bg-border"}`} />
              ))}
            </div>
          </div>
        )}
        <div key={passo} className={`flex flex-col gap-4 ${dir > 0 ? "passo-entra" : ""}`}>
          {corpo}
        </div>
        {passo > PASSOS && (
          <>
            {erro && <p className="text-sm text-danger">{erro}</p>}
            <button type="button" disabled={salvando} onClick={salvar} className="min-h-12 w-full rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent disabled:opacity-60">
              {editar ? "Salvar" : "Adicionar dívida"}
            </button>
            <button type="button" onClick={() => vai(PASSOS, -1)} className="-mt-2 min-h-11 text-sm text-ink-muted">
              Voltar e mudar
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** A revelação: o selo grande, uma frase sem julgamento, os juros contra a Selic e o canhoto. */
function Revelacao({ divida, selic, hoje, dividas, extra, m0 }: { divida: DividaDoSpi; selic: number; hoje: Hoje; dividas: DividaDoSpi[]; extra: number; m0: (v: number) => string }) {
  const saude = saudeDe(divida, selic);
  const cor = COR_DA_SAUDE[saude];
  const tx = taxaDe(divida);
  const juros = divida.saldo * (tx.taxa / 100);
  // Onde ela cai no plano, junto das que já existem (a mesma conta da tela principal).
  const outras = dividas.filter((d) => d.id !== divida.id);
  const res = paraResolver([...outras, divida], selic);
  const plano = saude !== "saudavel" && res.length ? simularQuitacao(res, extra) : null;
  const q = plano && !ehImpossivel(plano) ? plano.quitacoes.find((x) => x.id === divida.id) : null;
  const Icone = saude === "saudavel" ? CircleCheck : saude === "atencao" ? TriangleAlert : Zap;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1.5 pt-2 text-center">
        <span className="mb-1.5 flex size-16 items-center justify-center rounded-full" style={{ backgroundColor: cor.fundo, color: cor.texto }}>
          <Icone size={28} strokeWidth={1.6} aria-hidden />
        </span>
        <b className="text-2xl font-medium text-ink">{FRASE_DA_SAUDE[saude].selo}</b>
        <span className="text-sm text-ink-muted">{divida.nome}</span>
        <p className="max-w-[300px] text-[15px] leading-snug text-ink">{FRASE_DA_SAUDE[saude].frase}</p>
      </div>
      <dl className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface px-3.5">
        <div className="flex justify-between gap-3 py-3 text-[15px]">
          <dt className="text-ink-muted">Juros</dt>
          <dd className="text-right font-medium text-ink">
            {pct(tx.taxa)}% ao mês{tx.estimada ? " (estimada)" : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-3 text-[15px]">
          <dt className="text-ink-muted">Ao ano</dt>
          <dd className="text-right font-medium text-ink">
            {pct(taxaAnual(tx.taxa), 0)}% · Selic {pct(selic, 2)}%
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-3 text-[15px]">
          <dt className="text-ink-muted">Juros deste mês</dt>
          <dd className="text-right font-medium tabular-nums text-ink">{m0(juros)}</dd>
        </div>
      </dl>
      {juros > divida.porMes && (
        <p className="flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm leading-snug text-ink" style={{ backgroundColor: "var(--color-atencao-fundo)" }}>
          <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" style={{ color: "var(--color-atencao)" }} aria-hidden />
          Do jeito que está, ela cresce: os juros passam do que você paga por mês.
        </p>
      )}
      {q && (
        // O canhoto destacável: o mês em que ela cai, se seguir o plano.
        <div className="canhoto foco self-center" style={{ ["--k" as string]: cor.texto, flex: "none", minWidth: 180 }}>
          <i className="mk" />
          <small className="pr-3.5 text-xs font-medium opacity-80">Se seguir o plano</small>
          <b className="text-[15px] font-medium leading-tight">{divida.nome}</b>
          <span className="text-xs font-medium opacity-80">cai em {mesCurto(mesAdiante(hoje, q.mes))}</span>
        </div>
      )}
    </div>
  );
}
