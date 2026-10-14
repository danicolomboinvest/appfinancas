"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { nowInBrazil } from "@/lib/date/brazil-now";
import {
  type Dia,
  type Intervalo,
  diaParaTexto,
  hrefDoIntervalo,
  hrefDoMes,
  intervaloDoTipo,
  mesAoLado,
  mesDeAgora,
  mesmoMes,
  periodoCompletoDaRota,
  rotuloDoIntervalo,
  rotuloDoPeriodo,
  ultimoDia,
  MESES_A_FRENTE,
} from "@/lib/visao-geral/periodo";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ordem = (d: Dia) => d.ano * 10000 + d.mes * 100 + d.dia;

/**
 * "‹ Esse mês · 1 a 11 out ›" logo abaixo das abas (protótipo aprovado, tema-padrao.html e
 * tema-girly.html). As setas andam um mês (apagadas quando o período não é um mês). Tocar no nome
 * abre "Ver o período": seis atalhos em pílulas e o Período personalizado, um calendário onde se
 * toca no primeiro e no último dia. O período viaja na URL (lib/visao-geral/periodo.ts), então
 * trocar de aba mantém o período.
 */
export function SeletorDeMes() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const router = useRouter();
  const [folha, setFolha] = useState(false);
  const [calendario, setCalendario] = useState(false);
  const agora = nowInBrazil();
  const periodo = periodoCompletoDaRota(caminho, busca, agora);
  if (!periodo) return null;
  const { aba, mes, intervalo } = periodo;
  const rotulo = intervalo ? rotuloDoIntervalo(intervalo) : rotuloDoPeriodo(mes!, agora);
  const antes = mes ? mesAoLado(mes, -1, agora) : null;
  const depois = mes ? mesAoLado(mes, 1, agora) : null;
  const seta = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)] transition-colors hover:bg-surface-2";
  const apagada = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-40 shadow-[inset_0_0_0_1px_var(--color-border)]";
  const esse = mesDeAgora(agora);
  const passado = mesAoLado(esse, -1, agora);
  const queVem = mesAoLado(esse, 1, agora);

  const ir = (href: string) => {
    setFolha(false);
    setCalendario(false);
    router.push(href, { scroll: false });
  };
  const atalhos: { chave: string; nome: string; on: boolean; href: string }[] = [
    { chave: "mes", nome: "Esse mês", on: !!mes && mesmoMes(mes, esse), href: hrefDoMes(aba, esse, agora) },
    { chave: "7d", nome: "Últimos 7 dias", on: intervalo?.tipo === "7d", href: hrefDoIntervalo(aba, intervaloDoTipo("7d", agora)) },
    { chave: "passado", nome: "Mês passado", on: !!mes && !!passado && mesmoMes(mes, passado), href: passado ? hrefDoMes(aba, passado, agora) : hrefDoMes(aba, esse, agora) },
    // Os próximos meses voltaram (14/10/2026): o que já está previsto (parcelas, contas, assinaturas).
    ...(queVem ? [{ chave: "que-vem", nome: "Mês que vem", on: !!mes && mesmoMes(mes, queVem), href: hrefDoMes(aba, queVem, agora) }] : []),
    { chave: "tri", nome: "Esse trimestre", on: intervalo?.tipo === "tri", href: hrefDoIntervalo(aba, intervaloDoTipo("tri", agora)) },
    { chave: "tri-ant", nome: "Trimestre passado", on: intervalo?.tipo === "tri-ant", href: hrefDoIntervalo(aba, intervaloDoTipo("tri-ant", agora)) },
    { chave: "ano", nome: "Esse ano", on: intervalo?.tipo === "ano", href: hrefDoIntervalo(aba, intervaloDoTipo("ano", agora)) },
  ];

  return (
    <>
      <div className="-mt-2 mb-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 pb-1" aria-label="Período">
        {antes ? (
          <Link href={hrefDoMes(aba, antes, agora)} aria-label="Mês anterior" className={seta} scroll={false}>
            <ChevronLeft size={18} aria-hidden />
          </Link>
        ) : (
          <span className={apagada} aria-hidden>
            <ChevronLeft size={18} />
          </span>
        )}
        <button
          type="button"
          data-periodo-nome
          aria-haspopup="dialog"
          onClick={() => setFolha(true)}
          className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-ink"
        >
          <span className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 leading-tight">
            <b className="whitespace-nowrap text-[15px] font-medium">{rotulo.nome}</b>
            <small className="whitespace-nowrap text-[13px] text-ink-muted">{rotulo.sub}</small>
          </span>
          <ChevronDown size={16} className="shrink-0 text-ink-muted" aria-hidden />
        </button>
        {depois ? (
          <Link href={hrefDoMes(aba, depois, agora)} aria-label="Próximo mês" className={seta} scroll={false}>
            <ChevronRight size={18} aria-hidden />
          </Link>
        ) : (
          <span className={apagada} aria-hidden>
            <ChevronRight size={18} />
          </span>
        )}
      </div>
      <Modal
        open={folha}
        onClose={() => {
          setFolha(false);
          setCalendario(false);
        }}
        title="Ver o período"
      >
        {calendario ? (
          <Calendario
            agora={agora}
            inicial={intervalo?.tipo === "custom" ? intervalo : null}
            onVoltar={() => setCalendario(false)}
            onVer={(de, ate) => ir(hrefDoIntervalo(aba, { tipo: "custom", de, ate }))}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2" data-periodo-atalhos>
              {atalhos.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  aria-pressed={a.on}
                  onClick={() => ir(a.href)}
                  className="h-[46px] rounded-full bg-surface-2 px-3 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface"
                >
                  {a.nome}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-periodo-personalizado
              onClick={() => setCalendario(true)}
              className={`flex h-14 items-center gap-3 rounded-2xl bg-surface pl-2.5 pr-4 text-left text-base text-ink shadow-sm ${intervalo?.tipo === "custom" ? "shadow-[inset_0_0_0_1.5px_var(--color-ink)]" : "shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-2">
                <CalendarDays size={18} aria-hidden />
              </span>
              Período personalizado
              <ChevronRight size={16} className="ml-auto text-ink-muted" aria-hidden />
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Calendário do Período personalizado: toca no primeiro e no último dia; vai até 6 meses à frente. */
function Calendario({ agora, inicial, onVoltar, onVer }: { agora: Date; inicial: Intervalo | null; onVoltar: () => void; onVer: (de: Dia, ate: Dia) => void }) {
  const hoje: Dia = { ano: agora.getFullYear(), mes: agora.getMonth() + 1, dia: agora.getDate() };
  const [vendo, setVendo] = useState({ ano: (inicial?.ate ?? hoje).ano, mes: (inicial?.ate ?? hoje).mes });
  const [de, setDe] = useState<Dia | null>(inicial?.de ?? null);
  const [ate, setAte] = useState<Dia | null>(inicial?.ate ?? null);
  const primeiroDaSemana = new Date(vendo.ano, vendo.mes - 1, 1).getDay();
  const dias = ultimoDia(vendo.ano, vendo.mes);
  const podeAvancar = vendo.ano * 12 + vendo.mes < hoje.ano * 12 + hoje.mes + MESES_A_FRENTE;
  const andar = (n: number) => {
    const d = new Date(vendo.ano, vendo.mes - 1 + n, 1);
    setVendo({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  };
  const tocar = (d: Dia) => {
    if (!de || ate) {
      setDe(d);
      setAte(null);
    } else if (ordem(d) < ordem(de)) {
      setAte(de);
      setDe(d);
    } else setAte(d);
  };
  const fim = ate ?? de;
  const texto = !de
    ? "Toque no primeiro e no último dia"
    : !ate
      ? "Agora toque no último dia"
      : rotuloDoIntervalo({ tipo: "custom", de, ate }).nome + " · " + rotuloDoIntervalo({ tipo: "custom", de, ate }).sub;

  return (
    <div className="flex flex-col gap-3" data-calendario>
      <button type="button" onClick={onVoltar} className="-mt-1 flex min-h-11 items-center gap-1 self-start text-sm text-ink-muted">
        <ChevronLeft size={16} aria-hidden />
        Voltar
      </button>
      <div className="grid grid-cols-[44px_1fr_44px] items-center text-center">
        <button type="button" aria-label="Mês anterior" onClick={() => andar(-1)} className="flex size-11 items-center justify-center rounded-full text-ink">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <b className="font-medium">
          {MESES[vendo.mes - 1]} {vendo.ano}
        </b>
        <button type="button" aria-label="Próximo mês" disabled={!podeAvancar} onClick={() => andar(1)} className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-30">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-ink-muted" aria-hidden>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {Array.from({ length: primeiroDaSemana }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: dias }, (_, i) => {
          const d: Dia = { ano: vendo.ano, mes: vendo.mes, dia: i + 1 };
          const o = ordem(d);
          const ponta = (de && o === ordem(de)) || (fim && o === ordem(fim));
          const meio = de && ate && o > ordem(de) && o < ordem(ate);
          const ehHoje = o === ordem(hoje);
          return (
            <button
              key={i}
              type="button"
              onClick={() => tocar(d)}
              aria-pressed={!!ponta}
              aria-label={`${d.dia} de ${MESES[d.mes - 1].toLowerCase()}`}
              data-dia={diaParaTexto(d)}
              className={`mx-auto flex aspect-square w-full max-w-11 items-center justify-center text-[15px] disabled:text-ink-faint disabled:opacity-40 ${
                ponta ? "rounded-full bg-ink text-surface" : meio ? "bg-accent-soft text-ink" : `rounded-full text-ink ${ehHoje ? "shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : ""}`
              }`}
            >
              {d.dia}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-ink-muted" aria-live="polite">
        {texto}
      </p>
      <button
        type="button"
        disabled={!de}
        onClick={() => de && onVer(de, ate ?? de)}
        className="min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-40"
      >
        Ver
      </button>
    </div>
  );
}
