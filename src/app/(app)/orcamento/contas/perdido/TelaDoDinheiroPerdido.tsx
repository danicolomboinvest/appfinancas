"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as PointerEventReact } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Copy, Globe, Percent, Receipt, Repeat, ShieldQuestion, Sun, TrendingUp, type LucideIcon } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { Modal } from "@/components/ui/Modal";
import { FitText } from "@/components/ui/FitText";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { vibrar } from "@/lib/celebrar";
import { contraOPreco,
  ateAgora,
  escolhasDaCarta,
  mensagemDeEstorno,
  paraOSac,
  porqueDaCarta,
  rotuloDaCarta,
  subDaCarta,
  valorDoSim,
  ROTULO_DO_TIPO,
  type EstadoDoAchado,
} from "@/lib/dinheiro-perdido/placar";
import type { TipoDeAchado } from "@/lib/dinheiro-perdido/detectar";
import { decidirAchadoAction, marcarVistosAction } from "./actions";
import type { CartaDaTela, DinheiroPerdido } from "./dados";

type Props = Omit<DinheiroPerdido, "vivos"> & { precoDoSpi: number | null };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ARRASTE_DECIDE = 80;

function iconeDa(c: Pick<CartaDaTela, "tipo" | "tarifa">): LucideIcon {
  if (c.tipo === "repetida") return Copy;
  if (c.tipo === "aumento") return TrendingUp;
  if (c.tipo === "tarifa") return c.tarifa === "seguro" ? ShieldQuestion : c.tarifa === "iof" ? Globe : c.tarifa === "juros" ? Percent : Receipt;
  return Repeat;
}

/** O ícone do tipo, como componente fixo (sem criar componente no render). */
function IconeDoAchado({ c, size }: { c: Pick<CartaDaTela, "tipo" | "tarifa">; size: number }) {
  const p = { size, strokeWidth: 2.2, "aria-hidden": true } as const;
  if (c.tipo === "repetida") return <Copy {...p} />;
  if (c.tipo === "aumento") return <TrendingUp {...p} />;
  if (c.tipo === "tarifa") {
    if (c.tarifa === "seguro") return <ShieldQuestion {...p} />;
    if (c.tarifa === "iof") return <Globe {...p} />;
    if (c.tarifa === "juros") return <Percent {...p} />;
    return <Receipt {...p} />;
  }
  return <Repeat {...p} />;
}

function semMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A tela inteira do Dinheiro perdido: "Até agora" em cima, as cartas embaixo, a folha do estorno e
 * o "Ver tudo". As escolhas valem na hora na tela (o Até agora cresce) e vão para o servidor atrás.
 */
export function TelaDoDinheiroPerdido({ abertas, todas, conferidos, precoDoSpi, novos }: Props) {
  const money = useMoney();
  const { showError } = useToast();
  const [, iniciar] = useTransition();
  const [estados, setEstados] = useState<Record<string, EstadoDoAchado>>(() => Object.fromEntries(todas.map((c) => [c.chave, c.estado])));
  const [fila, setFila] = useState<string[]>(() => abertas.map((c) => c.chave));
  const [feitas, setFeitas] = useState(0);
  const [recuperarNaRodada, setRecuperarNaRodada] = useState(0);
  const [saindo, setSaindo] = useState<"esquerda" | "direita" | null>(null);
  const [estorno, setEstorno] = useState<CartaDaTela | null>(null);
  const [verTudo, setVerTudo] = useState(false);
  const [pula, setPula] = useState(0);
  const porChave = useMemo(() => new Map(todas.map((c) => [c.chave, c])), [todas]);
  const vistos = useRef(false);

  // Abriu a tela: as cartas novas deixam de ser novas (o próximo extrato só avisa o que for novo).
  useEffect(() => {
    if (vistos.current || (abertas.length === 0 && novos === 0)) return;
    vistos.current = true;
    void marcarVistosAction().catch(() => undefined);
  }, [abertas.length, novos]);

  const placar = ateAgora(todas.map((c) => ({ mensal: c.mensal, unico: c.unico ?? c.valorDaCobranca ?? null, estado: estados[c.chave] ?? c.estado })));
  const atual = fila.length > 0 ? porChave.get(fila[0]) ?? null : null;
  const proxima = fila.length > 1 ? porChave.get(fila[1]) ?? null : null;
  const total = feitas + fila.length;

  function gravar(chave: string, estado: EstadoDoAchado) {
    iniciar(async () => {
      const r = await decidirAchadoAction({ chave, estado }).catch(() => ({ ok: false }));
      if (!r.ok) showError("Não guardou. Atualize a tela.");
    });
  }

  function mudarEstado(c: CartaDaTela, estado: EstadoDoAchado) {
    const antes = ateAgora([{ mensal: c.mensal, unico: c.unico ?? c.valorDaCobranca ?? null, estado: estados[c.chave] ?? c.estado }]).porAno;
    const depois = ateAgora([{ mensal: c.mensal, unico: c.unico ?? c.valorDaCobranca ?? null, estado }]).porAno;
    setEstados((e) => ({ ...e, [c.chave]: estado }));
    if (depois > antes) {
      setPula((n) => n + 1);
      vibrar("sucesso");
    }
    gravar(c.chave, estado);
  }

  function escolher(sim: boolean) {
    const c = atual;
    if (!c || saindo) return;
    const e = escolhasDaCarta(c);
    const estado = sim ? e.estadoSim : e.estadoNao;
    if (sim) setRecuperarNaRodada((v) => v + valorDoSim(c));
    mudarEstado(c, estado);
    setSaindo(sim ? "esquerda" : "direita");
    window.setTimeout(
      () => {
        setSaindo(null);
        setFila((f) => f.slice(1));
        setFeitas((n) => n + 1);
        if (sim && e.abreEstorno) setEstorno(c);
      },
      semMovimento() ? 0 : 280,
    );
  }

  function desfazer(c: CartaDaTela) {
    setEstados((e) => ({ ...e, [c.chave]: "aberto" }));
    setFila((f) => (f.includes(c.chave) ? f : [...f, c.chave]));
    gravar(c.chave, "aberto");
  }

  const algumaDecididaNaRodada = feitas > 0;
  const nadaParaConferir = !atual;

  return (
    <div className="flex flex-col gap-5">
      <AteAgora porAno={placar.porAno} porMes={placar.porMes} deUmaVez={placar.deUmaVez} precoDoSpi={precoDoSpi} pula={pula} />

      <section className="flex flex-col gap-3" aria-labelledby="achei-titulo">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="achei-titulo" className="titulo-tema text-lg font-medium text-ink">
            Achei para conferir
          </h2>
          {atual && (
            <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent-strong" aria-live="polite">
              {feitas + 1} de {total}
            </span>
          )}
        </div>

        {atual ? (
          <>
            {total > 1 && total <= 14 && (
              <div className="flex justify-center gap-1.5" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <i key={i} className={`h-[7px] rounded-full transition-all ${i < feitas ? "w-[7px] bg-accent" : i === feitas ? "w-5 bg-accent" : "w-[7px] bg-accent-soft"}`} />
                ))}
              </div>
            )}
            <div className="relative touch-pan-y pb-3">
              {proxima && <Carta c={proxima} atras />}
              <Carta key={atual.chave} c={atual} saindo={saindo} onEscolher={escolher} />
            </div>
            <p className="text-center text-[13px] text-ink-muted">Arraste ou toque. Ninguém julga.</p>
          </>
        ) : algumaDecididaNaRodada ? (
          <Fim feitas={feitas} recuperar={recuperarNaRodada} />
        ) : (
          <NadaAchado conferidos={conferidos} />
        )}

        {todas.length > 0 && (
          <button
            type="button"
            onClick={() => setVerTudo((v) => !v)}
            aria-expanded={verTudo}
            className="mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-5 text-sm text-ink active:scale-95"
          >
            {verTudo ? "Esconder a lista" : "Ver tudo"}
            <ChevronDown size={16} strokeWidth={1.8} className={`transition-transform ${verTudo ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
        {verTudo && <VerTudo todas={todas} estados={estados} onAbrirEstorno={setEstorno} onDesfazer={desfazer} />}
        {nadaParaConferir && (
          <Link href="/orcamento/contas" className="botao-principal mt-1 flex min-h-[52px] w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold active:scale-[0.98]">
            Voltar para Recorrentes
          </Link>
        )}
      </section>

      <FolhaDoEstorno
        carta={estorno}
        estado={estorno ? (estados[estorno.chave] ?? estorno.estado) : "aberto"}
        onFechar={() => setEstorno(null)}
        onVoltou={(c) => {
          mudarEstado(c, "estornado");
          setEstorno(null);
        }}
        money={money}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Até agora */

function AteAgora({ porAno, porMes, deUmaVez, precoDoSpi, pula }: { porAno: number; porMes: number; deUmaVez: number; precoDoSpi: number | null; pula: number }) {
  // "O SPI já se pagou" quando passa do preço, sem nunca escrever o preço (12/10/2026, pedido dela).
  const pagou = precoDoSpi ? contraOPreco(porAno, precoDoSpi).pagou : false;
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  return (
    <section aria-labelledby="ate-agora" className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4" style={{ boxShadow: "var(--cartao-fio, none)" }}>
      <div key={pula} className={pula > 0 ? "motion-safe:animate-[dp-pula_.5s_cubic-bezier(.2,.8,.2,1)]" : ""}>
        <p id="ate-agora" className="text-[13px] font-semibold text-ink-muted">
          Até agora
        </p>
        <FitText className="text-[2.1rem] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-success">
          {m0(porAno)} <span className="text-[0.5em] font-medium">por ano</span>
        </FitText>
        <p className="text-[13px] text-ink-muted">
          {porAno === 0 ? "Cada “não uso” soma aqui." : `${money(porMes)} por mês${deUmaVez > 0 ? ` e ${money(deUmaVez)} de estorno` : ""}`}
        </p>
      </div>
      {pagou && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-success-soft px-3 py-2.5 text-[14px] font-semibold text-success">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-[color:var(--color-surface)]" aria-hidden>
            <Check size={15} strokeWidth={3} />
          </span>
          <span className="min-w-0">O SPI já se pagou</span>
        </div>
      )}
    </section>
  );
}


/* ------------------------------------------------------------------ a carta */

function Carta({ c, atras = false, saindo = null, onEscolher }: { c: CartaDaTela; atras?: boolean; saindo?: "esquerda" | "direita" | null; onEscolher?: (sim: boolean) => void }) {
  const money = useMoney();
  const [dx, setDx] = useState(0);
  const inicio = useRef<number | null>(null);
  const e = escolhasDaCarta(c);
  const grande = c.mensal ? c.anual : (c.unico ?? c.anual);

  function down(ev: PointerEventReact<HTMLDivElement>) {
    if (atras || (ev.target as HTMLElement).closest("button, a")) return;
    inicio.current = ev.clientX;
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* sem captura, segue sem ela */
    }
  }
  function move(ev: PointerEventReact<HTMLDivElement>) {
    if (inicio.current === null) return;
    setDx(ev.clientX - inicio.current);
  }
  function up() {
    if (inicio.current === null) return;
    inicio.current = null;
    const final = dx;
    setDx(0);
    if (Math.abs(final) > ARRASTE_DECIDE) onEscolher?.(final < 0);
  }

  const transform = atras
    ? "translateY(12px) scale(0.95)"
    : saindo === "esquerda"
      ? "translateX(-130%) rotate(-14deg)"
      : saindo === "direita"
        ? "translateX(130%) rotate(14deg)"
        : dx !== 0
          ? `translateX(${dx}px) rotate(${dx / 18}deg)`
          : undefined;

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-hidden={atras || undefined}
      className={`flex select-none flex-col items-center gap-2.5 rounded-[26px] border border-border bg-surface px-4 pb-4 pt-5 text-center ${
        atras ? "pointer-events-none absolute inset-0 overflow-hidden opacity-60 blur-[1px]" : "relative z-10 cursor-grab"
      } ${dx === 0 ? "transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" : ""} ${saindo ? "opacity-0" : ""}`}
      style={{ transform, boxShadow: "var(--cartao-fio, none), 0 18px 34px -22px rgba(0,0,0,.4)", touchAction: "pan-y" }}
    >
      <span className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-accent-strong">
        <IconeDoAchado c={c} size={14} /> {rotuloDaCarta(c)}
        {c.novo && <span className="rounded-full bg-accent px-2 py-px text-[12px] tracking-[0.04em] text-on-accent">nova</span>}
      </span>
      <LogoDoLancamento descricao={c.descricaoDoLogo} icon={iconeDa(c)} size={72} />
      <h3 className="max-w-full break-words text-[18px] font-bold leading-snug text-ink">{c.nome}</h3>
      <div className="w-full">
        <FitText className="titulo-tema text-[2.6rem] font-semibold leading-none tracking-[-0.01em] tabular-nums text-accent-strong">
          {c.tipo === "aumento" ? "+" : ""}
          {money(grande)}
        </FitText>
      </div>
      <span className="text-[14px] text-ink-muted">{subDaCarta(c, money)}</span>
      <span className="w-full rounded-xl bg-surface-2 px-3 py-2 text-[14px] leading-snug text-ink">{porqueDaCarta(c, money)}</span>
      {/* Juros e multa: o caminho é pagar em dia, então a carta leva para Dívidas (sem estorno). */}
      {!atras && c.tipo === "tarifa" && c.tarifa === "juros" && (
        <Link href="/dividas" className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-accent-strong">
          Ver minhas dívidas <ChevronRight size={16} aria-hidden />
        </Link>
      )}
      {!atras && (
        <div className="mt-1 grid w-full grid-cols-2 gap-2">
          <button type="button" onClick={() => onEscolher?.(true)} className="botao-principal min-h-[52px] rounded-full px-3 text-[15px] font-semibold leading-tight active:scale-[0.97]">
            {e.sim}
          </button>
          <button type="button" onClick={() => onEscolher?.(false)} className="min-h-[52px] rounded-full border border-border-strong bg-transparent px-3 text-[15px] font-semibold leading-tight text-ink active:scale-[0.97]">
            {e.nao}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ fim e nada achado */

function Fim({ feitas, recuperar }: { feitas: number; recuperar: number }) {
  const money = useMoney();
  return (
    <div className="flex flex-col items-center gap-2 rounded-[26px] border border-border bg-surface px-4 py-6 text-center">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-accent-strong">
        Pronto, {feitas} de {feitas}
      </span>
      {recuperar > 0 ? (
        <>
          <span className="text-[14px] text-ink-muted">Se tudo der certo, volta</span>
          <FitText className="titulo-tema text-[2.4rem] font-semibold leading-none tabular-nums text-success">{money(recuperar, { round: true })}</FitText>
          <span className="text-[14px] text-ink-muted">por ano</span>
          <p className="mt-1 text-[14px] text-ink">Cancelou? Quando a cobrança parar, é dinheiro que fica com você.</p>
        </>
      ) : (
        <p className="text-[15px] text-ink">Tudo conferido. Volto a caçar no próximo extrato.</p>
      )}
    </div>
  );
}

function NadaAchado({ conferidos }: { conferidos: DinheiroPerdido["conferidos"] }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-[26px] border border-border bg-surface px-4 py-7 text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
        <Sun size={40} strokeWidth={1.6} />
      </span>
      <h3 className="text-[18px] font-bold text-ink">Nenhuma carta este mês</h3>
      <p className="text-[14px] text-ink-muted">
        {conferidos && conferidos.quantos > 0
          ? `Conferi ${conferidos.quantos} ${conferidos.quantos === 1 ? "lançamento" : "lançamentos"} de ${MESES[conferidos.mes - 1]}. Tudo no lugar.`
          : "Quando o extrato entrar, eu confiro tudo."}
      </p>
      <p className="text-[13px] text-ink-muted">Volto a caçar no próximo extrato.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ ver tudo (a lista do A) */

/** O selo de cada item no "Ver tudo": o próprio botão que ela tocou ("Não uso", "Tudo bem"). */
function seloDo(c: CartaDaTela, estado: EstadoDoAchado): string {
  const e = escolhasDaCarta(c);
  if (estado === "aberto") return "Para conferir";
  if (estado === "pedi_estorno") return "Estorno pedido";
  if (estado === "estornado") return "Voltou";
  return estado === e.estadoSim ? e.sim : e.nao;
}
const ORDEM_DOS_GRUPOS: TipoDeAchado[] = ["assinatura", "repetida", "tarifa", "aumento"];

function VerTudo({
  todas,
  estados,
  onAbrirEstorno,
  onDesfazer,
}: {
  todas: CartaDaTela[];
  estados: Record<string, EstadoDoAchado>;
  onAbrirEstorno: (c: CartaDaTela) => void;
  onDesfazer: (c: CartaDaTela) => void;
}) {
  const money = useMoney();
  const grupos = ORDEM_DOS_GRUPOS.map((tipo) => ({ tipo, itens: todas.filter((c) => c.tipo === tipo) })).filter((g) => g.itens.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => {
        const somaAno = g.itens.reduce((s, c) => s + c.anual, 0);
        return (
          <section key={g.tipo} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="text-accent-strong">
                  <IconeDoAchado c={{ tipo: g.tipo, tarifa: undefined }} size={16} />
                </span>{" "}
                {ROTULO_DO_TIPO[g.tipo]}
              </h3>
              <span className="text-[13px] tabular-nums text-ink-muted">
                {money(somaAno, { round: true })}
                {g.itens.some((c) => c.mensal) ? "/ano" : ""}
              </span>
            </div>
            <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-3">
              {g.itens.map((c) => {
                const estado = estados[c.chave] ?? c.estado;
                const e = escolhasDaCarta(c);
                return (
                  <li key={c.chave} className="flex items-center gap-3 py-3">
                    <LogoDoLancamento descricao={c.descricaoDoLogo} icon={iconeDa(c)} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[15px] leading-snug text-ink">{c.nome}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`rounded-full px-2 py-px text-[12px] ${estado === "nao_uso" || estado === "estornado" ? "bg-success-soft text-success" : "bg-surface-2 text-ink"}`}>{seloDo(c, estado)}</span>
                        {e.abreEstorno && (estado === "pedi_estorno" || estado === "nao_uso" || estado === "aberto") && (
                          <button type="button" onClick={() => onAbrirEstorno(c)} className="min-h-8 text-[13px] font-medium text-accent-strong">
                            Mensagem pronta
                          </button>
                        )}
                        {estado !== "aberto" && (
                          <button type="button" onClick={() => onDesfazer(c)} className="min-h-8 text-[13px] font-medium text-ink-muted">
                            Desfazer
                          </button>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-medium tabular-nums text-ink">
                        {c.tipo === "aumento" ? "+" : ""}
                        {money(c.mensal ? c.anual : (c.unico ?? c.anual), { round: Boolean(c.mensal) })}
                      </span>
                      <span className="block text-[12px] text-ink-muted">{c.mensal ? "por ano" : "uma vez"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ folha do estorno */

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* cai no jeito antigo */
  }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function FolhaDoEstorno({
  carta,
  estado,
  onFechar,
  onVoltou,
  money,
}: {
  carta: CartaDaTela | null;
  estado: EstadoDoAchado;
  onFechar: () => void;
  onVoltou: (c: CartaDaTela) => void;
  money: (v: number) => string;
}) {
  const [copiada, setCopiada] = useState<"sim" | "nao" | null>(null);
  const caixa = useRef<HTMLParagraphElement>(null);
  const texto = carta ? mensagemDeEstorno(carta, money) : "";
  const pedeEstorno = carta ? escolhasDaCarta(carta).estadoSim === "pedi_estorno" : false;

  async function copiar() {
    const ok = await copiarTexto(texto);
    setCopiada(ok ? "sim" : "nao");
    if (ok) vibrar("leve");
    else if (caixa.current) {
      // Sem área de transferência: deixa o texto selecionado para ela copiar com o dedo.
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(caixa.current);
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }

  return (
    <Modal
      open={carta !== null}
      onClose={() => {
        setCopiada(null);
        onFechar();
      }}
      title="Mensagem pronta"
    >
      {carta && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-[14px] text-ink-muted">{paraOSac(carta.quem)}</p>
          <p ref={caixa} className="select-text whitespace-pre-wrap rounded-2xl border border-dashed border-border-strong bg-surface-2 p-3 text-[15px] leading-relaxed text-ink">
            {texto}
          </p>
          <button type="button" onClick={copiar} className="botao-principal flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold active:scale-[0.98]">
            <Copy size={17} strokeWidth={2} aria-hidden /> Copiar mensagem
          </button>
          <p className="min-h-[1.25rem] text-center text-[13px] font-semibold text-success" aria-live="polite">
            {copiada === "sim" ? "Copiada. Agora é colar no chat do SAC." : copiada === "nao" ? "Selecionei o texto: segure e toque em Copiar." : ""}
          </p>
          {pedeEstorno && <p className="text-center text-[13px] text-ink-muted">Quando o estorno cair no extrato, eu somo no Até agora sozinho.</p>}
          {pedeEstorno && estado !== "estornado" && (
            <button type="button" onClick={() => onVoltou(carta)} className="min-h-11 w-full rounded-full border border-border-strong text-[15px] font-semibold text-ink active:scale-[0.98]">
              O dinheiro já voltou
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCopiada(null);
              onFechar();
            }}
            className="min-h-11 w-full rounded-full text-[15px] font-medium text-ink-muted"
          >
            Voltar para as cartas
          </button>
        </div>
      )}
    </Modal>
  );
}
