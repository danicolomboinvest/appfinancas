"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { useToast } from "@/components/ui/toast-context";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { valorCurto } from "@/lib/calculadoras/vereditos";
import type { TipoDeSimulacao, ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import { saveSimulationAction, virarMetaAction } from "@/app/(app)/simuladores/actions";

/**
 * As peças das calculadoras guiadas (protótipo aprovado, rodada 20): uma pergunta por tela, o
 * número grande num cartão (ou sobre a foto), atalhos de um toque, "Ajustes finos" recolhido e o
 * botão grande embaixo. No fim, o veredito em destaque, as duas colunas e as ações.
 *
 * Tudo sai dos tokens do tema: o mesmo desenho vale para Padrão, Girly, Manifestação e Titânio,
 * no claro e no escuro.
 */

export const FOTO = (nome: string) => `/calculadoras/${nome}.jpg`;

/** Inteiro com separador de milhar ("500.000"), como o campo mostra. */
export const milhar = (v: number) => Math.round(v || 0).toLocaleString("pt-BR");
/** Percentual curto ("11", "7,5"). */
export const pc = (v: number, casas = 2) => (Math.round(v * 10 ** casas) / 10 ** casas).toLocaleString("pt-BR", { maximumFractionDigits: casas });
const soDigitos = (t: string) => Number(t.replace(/\D/g, "")) || 0;

export function useSimbolo() {
  return currencySymbol(useCurrency());
}

/** "R$ 2,16 mi" nas colunas; respeita os valores escondidos (o olho do topo). */
export function useCurto() {
  const money = useMoney();
  const simbolo = useSimbolo();
  return (v: number) => {
    const inteiro = money(v, { round: true });
    if (/•/.test(inteiro)) return inteiro;
    return valorCurto(v, simbolo, (n) => money(n, { round: true }));
  };
}

/* ---------- moldura do assistente ---------- */

export function TopoDoAssistente({ voltar, onVoltar, passo, total }: { voltar: string; onVoltar: () => void; passo?: number; total?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <button type="button" onClick={onVoltar} className="-ml-1 flex min-h-11 items-center gap-1 pr-2 text-[15px] text-ink">
          <ChevronLeft size={18} aria-hidden /> {voltar}
        </button>
        {passo && total ? <span className="text-caption text-ink-muted">{passo} de {total}</span> : null}
      </div>
      {passo && total ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={`h-[3px] rounded-full ${i < passo ? "bg-ink" : "bg-border-strong"}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VoltarParaCalculadoras() {
  return (
    <Link href="/simuladores" className="-ml-1 flex min-h-11 w-fit items-center gap-1 pr-2 text-[15px] text-ink">
      <ChevronLeft size={18} aria-hidden /> Calculadoras
    </Link>
  );
}

export function Pergunta({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-ink-muted">{nome}</span>
      <h1 className="text-[1.625rem] font-medium leading-tight tracking-tight text-ink">{children}</h1>
    </div>
  );
}

/** O pé fixo com o botão grande (ou dois). */
export function Pe({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-auto bg-[linear-gradient(to_bottom,transparent,var(--color-canvas)_30%)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 md:mx-0 md:px-0">
      <div className="flex gap-2.5">{children}</div>
    </div>
  );
}

export function BotaoGrande({ children, secundario = false, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { secundario?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full px-3 text-base font-medium max-[389px]:text-[15px] transition-[opacity,transform] active:scale-[0.99] disabled:opacity-40 ${
        secundario ? "bg-surface-2 text-ink" : "bg-ink text-canvas"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Selo({ children, claro = false }: { children: ReactNode; claro?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${claro ? "bg-white/90 text-[#1d1d1f]" : "bg-surface-2 text-ink-muted"}`}>{children}</span>
  );
}

/* ---------- números ---------- */

/** O número grande sobre a foto, com − e +. */
export function ContadorComFoto({
  foto,
  rotulo,
  valor,
  onChange,
  passo,
  min = 0,
  selo,
}: {
  foto: string;
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  passo: number;
  min?: number;
  selo?: string;
}) {
  const simbolo = useSimbolo();
  const texto = milhar(valor);
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FOTO(foto)} alt="" loading="lazy" decoding="async" className="absolute inset-0 -z-10 size-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),rgba(0,0,0,0.08)_60%,rgba(0,0,0,0.18))]" />
      <div className="flex min-h-[12.5rem] flex-col justify-between p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-black/35 px-3 py-1 text-sm text-white backdrop-blur">{rotulo}</span>
          {selo && <Selo claro>{selo}</Selo>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={`Menos ${simbolo} ${milhar(passo)}`}
            disabled={valor - passo < min}
            onClick={() => onChange(Math.max(min, valor - passo))}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur disabled:opacity-40"
          >
            <Minus size={20} aria-hidden />
          </button>
          <label className="flex min-w-0 items-baseline justify-center gap-1.5 text-white">
            <span className="text-base opacity-80">{simbolo}</span>
            <input
              inputMode="numeric"
              aria-label={rotulo}
              value={texto}
              onChange={(e) => onChange(soDigitos(e.target.value))}
              style={{ width: `${Math.max(1, texto.length) * 0.6 + 0.2}em` }}
              className="min-w-0 max-w-[9em] bg-transparent text-[2.5rem] font-light leading-none tracking-[-0.03em] tabular-nums text-white outline-none max-[359px]:text-[2.1rem]"
            />
          </label>
          <button
            type="button"
            aria-label={`Mais ${simbolo} ${milhar(passo)}`}
            onClick={() => onChange(valor + passo)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur"
          >
            <Plus size={20} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** O valor num cartão: rótulo e selo em cima, o número grande, a frase do que ele significa. */
export function CartaoValor({
  rotulo,
  selo,
  valor,
  onChange,
  sufixo,
  sub,
  children,
  editavel = true,
}: {
  rotulo: string;
  selo?: string;
  valor: number;
  onChange?: (v: number) => void;
  sufixo?: string;
  sub?: ReactNode;
  children?: ReactNode;
  editavel?: boolean;
}) {
  const simbolo = useSimbolo();
  const texto = milhar(valor);
  return (
    <div className="glass flex flex-col gap-2 rounded-3xl p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink-muted">{rotulo}</span>
        {selo && <Selo>{selo}</Selo>}
      </div>
      <label className="flex items-baseline gap-1.5 text-ink">
        <span className="text-base text-ink-muted">{simbolo}</span>
        {editavel && onChange ? (
          <input
            inputMode="numeric"
            aria-label={rotulo}
            value={texto}
            onChange={(e) => onChange(soDigitos(e.target.value))}
            style={{ width: `${Math.max(1, texto.length) * 0.6 + 0.2}em` }}
            className="min-w-0 max-w-[9em] bg-transparent text-[2.5rem] font-light leading-none tracking-[-0.03em] tabular-nums text-ink outline-none max-[359px]:text-[2.1rem]"
          />
        ) : (
          <span className="text-[2.5rem] font-light leading-none tracking-[-0.03em] tabular-nums">{texto}</span>
        )}
        {sufixo && <span className="text-base text-ink-muted">{sufixo}</span>}
      </label>
      {sub && <p className="text-sm leading-snug text-ink-muted">{sub}</p>}
      {children}
    </div>
  );
}

/** Atalhos de um toque ("R$ 300 mil", "20%"). */
export function Atalhos<T extends number>({ opcoes, ativo, onEscolher }: { opcoes: { valor: T; rotulo: string }[]; ativo: number; onEscolher: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const on = Math.abs(o.valor - ativo) < 1e-9;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={on}
            onClick={() => onEscolher(o.valor)}
            className={`min-h-10 rounded-full px-4 text-[15px] tabular-nums transition-colors ${on ? "bg-ink text-canvas" : "glass text-ink"}`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** "R$ 300 mil", "R$ 2.500". */
export function useRotuloDeAtalho() {
  const simbolo = useSimbolo();
  return (v: number) => (v >= 1e6 ? `${simbolo} ${(v / 1e6).toLocaleString("pt-BR")} mi` : v >= 1e4 ? `${simbolo} ${(v / 1000).toLocaleString("pt-BR")} mil` : `${simbolo} ${milhar(v)}`);
}

/** Uma resposta de toque (cartão inteiro clicável). */
export function Opcao({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`glass flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-shadow ${on ? "shadow-[inset_0_0_0_2px_var(--color-ink)]" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconeRedondo({ children }: { children: ReactNode }) {
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">{children}</span>;
}

/* ---------- ajustes finos ---------- */

export function AjustesFinos({ resumo, children }: { resumo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  return (
    <div className="glass rounded-2xl">
      <button type="button" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((a) => !a)} className="flex w-full items-center gap-3 p-3.5 text-left">
        <IconeRedondo>
          <SlidersHorizontal size={17} aria-hidden />
        </IconeRedondo>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink">Ajustes finos</span>
          <span className="block text-caption text-ink-muted">{resumo}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-ink-muted transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && (
        <div id={id} className="flex flex-col divide-y divide-border border-t border-border px-3.5">
          {children}
        </div>
      )}
    </div>
  );
}

/** Uma linha dos ajustes: rótulo à esquerda, número pequeno com a unidade à direita. */
export function CampoFino({
  rotulo,
  valor,
  onChange,
  prefixo,
  sufixo,
  casas = 2,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  prefixo?: string;
  sufixo?: string;
  casas?: number;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const mostrado = rascunho ?? (casas === 0 ? milhar(valor) : pc(valor, casas));
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="min-w-0 text-sm text-ink">{rotulo}</span>
      <label className="flex shrink-0 items-baseline gap-1 rounded-xl bg-surface-2 px-3 py-1.5 focus-within:ring-2 focus-within:ring-accent">
        {prefixo && <span className="text-caption text-ink-muted">{prefixo}</span>}
        <input
          inputMode="decimal"
          aria-label={rotulo}
          value={mostrado}
          onFocus={() => setRascunho(mostrado)}
          onBlur={() => setRascunho(null)}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d,]/g, "");
            setRascunho(casas === 0 ? milhar(soDigitos(t)) : t);
            const n = casas === 0 ? soDigitos(t) : Number(t.replace(/\./g, "").replace(",", "."));
            if (Number.isFinite(n)) onChange(n);
          }}
          style={{ width: `${Math.max(2, mostrado.length) + 0.5}ch` }}
          className="bg-transparent text-right text-[15px] font-medium tabular-nums text-ink outline-none"
        />
        {sufixo && <span className="text-caption text-ink-muted">{sufixo}</span>}
      </label>
    </div>
  );
}

export function SegmentoFino<T extends string>({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: { valor: T; rotulo: string }[]; valor: string; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="min-w-0 text-sm text-ink">{rotulo}</span>
      <div className="flex shrink-0 gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={valor === o.valor}
            onClick={() => onChange(o.valor)}
            className={`min-h-9 rounded-full px-3 text-sm ${valor === o.valor ? "bg-ink text-canvas" : "text-ink-muted"}`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- resultado ---------- */

/** O veredito em destaque: de onde a conta partiu, a frase, o número grande e o que ele quer dizer. */
export function HeroiDoResultado({
  rotulo,
  frase,
  numero,
  sub,
  ajuda,
  children,
  tom,
}: {
  rotulo: string;
  frase: string;
  numero: string;
  sub?: ReactNode;
  ajuda?: ReactNode;
  children?: ReactNode;
  tom?: "bom" | "ruim";
}) {
  return (
    <HeroiDoTema>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-heroi-suave">{rotulo}</span>
        {ajuda && <Explica noHeroi>{ajuda}</Explica>}
      </div>
      <span className="text-[17px]">{frase}</span>
      <span className={tom === "ruim" ? "text-danger" : undefined} aria-live="polite">
        <ValorDestaque texto={numero} className="text-[2.75rem] font-light leading-none tracking-[-0.03em] tabular-nums max-[359px]:text-[2.4rem]" />
      </span>
      {sub && <span className="text-[15px] text-heroi-suave">{sub}</span>}
      {children}
    </HeroiDoTema>
  );
}

/** As duas colunas lado a lado; a que vence fica cheia. */
export function Colunas({ itens }: { itens: { rotulo: string; valor: number; vence: boolean }[] }) {
  const curto = useCurto();
  const mx = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));
  return (
    <div className="glass grid grid-cols-2 gap-4 rounded-3xl px-5 pb-4 pt-5">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex flex-col items-center gap-2">
          <b className="text-[15px] font-medium tabular-nums text-ink">{curto(i.valor)}</b>
          <span className="flex h-28 w-full max-w-[5.5rem] items-end">
            <i className={`block w-full rounded-xl ${i.vence ? "bg-ink" : "bg-border-strong"}`} style={{ height: `${Math.max(4, (Math.abs(i.valor) / mx) * 100).toFixed(1)}%` }} />
          </span>
          <small className={`text-center text-sm ${i.vence ? "font-medium text-ink" : "text-ink-muted"}`}>{i.rotulo}</small>
        </div>
      ))}
    </div>
  );
}

export function Alerta({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-snug text-danger">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** "Ver ano a ano" e afins: uma linha que abre e fecha. */
export function Recolhivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="glass rounded-2xl">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-medium text-ink">
        {titulo}
        <ChevronDown size={18} className={`shrink-0 text-ink-muted transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ---------- virar meta ---------- */

export type MetaSugerida = { nome: string; alvo: number; foto: string; icone: "CASA" | "CARRO" | "GENERICO" };

/** "Virar meta": cria a meta com o valor da conta (24 meses de prazo, como no protótipo). Depois, "Ver minha meta". */
export function BotaoVirarMeta({ titulo, sub, meta }: { titulo: string; sub: string; meta: MetaSugerida }) {
  const [criada, setCriada] = useState<{ id: string; chave: string } | null>(null);
  const [pendente, start] = useTransition();
  const { showToast, showError } = useToast();
  const router = useRouter();
  const chave = JSON.stringify(meta);
  const feita = criada?.chave === chave;
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (feita) return router.push(`/planejamento/metas/${criada!.id}`);
        start(async () => {
          const r = await virarMetaAction({ nome: meta.nome, alvo: meta.alvo, icone: meta.icone });
          if (!r.ok) return showError(r.error);
          setCriada({ id: r.id, chave });
          showToast("Meta criada");
        });
      }}
      className="glass flex w-full items-center gap-3 rounded-2xl p-2.5 pr-4 text-left disabled:opacity-60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FOTO(meta.foto)} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-xl bg-surface-2 object-cover" />
      <span className="min-w-0 flex-1">
        <small className="block text-caption text-ink-muted">{feita ? "Ver minha meta" : titulo}</small>
        <b className="block text-[15px] font-medium text-ink">{sub}</b>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/* ---------- salvar ---------- */

/** Guardar o cenário. "Salva" vale para os números guardados: mexeu num, o botão volta. */
export function useSalvar(tipo: TipoDeSimulacao, values: ValoresDaCalculadora, resumo: string, salvaInicial?: string | null) {
  const [salvoComo, setSalvoComo] = useState<string | null>(salvaInicial ?? null);
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [pendente, start] = useTransition();
  const { showToast, showError } = useToast();
  const foto = JSON.stringify(values);
  const salva = salvoComo === foto;
  const salvar = () =>
    start(async () => {
      const r = await saveSimulationAction({ type: tipo, name: nome, inputs: values, resumo });
      if (r.error) return showError(r.error);
      setSalvoComo(foto);
      setAbrindo(false);
      setNome("");
      showToast("Simulação salva");
    });
  return { salva, abrindo, abrir: () => setAbrindo(true), nome, setNome, salvar, pendente, marcarComoSalva: () => setSalvoComo(foto) };
}

export function CampoDoNome({ s }: { s: ReturnType<typeof useSalvar> }) {
  if (!s.abrindo || s.salva) return null;
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        maxLength={32}
        aria-label="Nome da simulação"
        placeholder="Nome (opcional)"
        value={s.nome}
        onChange={(e) => s.setNome(e.target.value)}
        className="glass min-h-12 min-w-0 flex-1 rounded-full px-4 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
      />
      <button type="button" disabled={s.pendente} onClick={s.salvar} className="min-h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas disabled:opacity-50">
        Salvar
      </button>
    </div>
  );
}

/** "Salvar" e "Mexer nos números" lado a lado, embaixo do resultado. */
export function AcoesDoResultado({ s, onMexer, extra }: { s: ReturnType<typeof useSalvar> | null; onMexer?: () => void; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5">
        {s &&
          (s.salva ? (
            <span className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-success-soft text-[15px] font-medium text-success">Salva</span>
          ) : (
            <button type="button" onClick={s.abrir} className="min-h-11 flex-1 rounded-full bg-surface-2 text-[15px] text-ink">
              Salvar
            </button>
          ))}
        {onMexer && (
          <button type="button" onClick={onMexer} className="min-h-11 flex-1 rounded-full bg-surface-2 text-[15px] text-ink">
            Mexer nos números
          </button>
        )}
        {extra}
      </div>
      {s && <CampoDoNome s={s} />}
    </div>
  );
}

/** Uma linha "rótulo ... valor" dos detalhes. */
export function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <span className="min-w-0 text-ink-muted">{rotulo}</span>
      <b className="shrink-0 font-medium tabular-nums text-ink">{valor}</b>
    </div>
  );
}
