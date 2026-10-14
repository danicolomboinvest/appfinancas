"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { apertos, mesDaqui, mesesParaChegar } from "@/lib/decisoes/fluxos";

export type MetaDoFluxo = {
  id: string;
  nome: string;
  foto: string;
  atual: number;
  alvo: number;
  taxaMensal: number;
  prazoMeses: number | null;
  prazoTexto: string | null;
  ritmo: number;
  necessario: number;
  noPrazo: boolean;
  ultimos3: { rotulo: string; valor: number }[];
};

const cartao = "flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]";
const preto = "flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-5 text-base font-medium text-surface disabled:opacity-40";
const claro = "flex min-h-12 w-full items-center justify-center rounded-full bg-surface px-5 text-base font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]";

/** "‹ Voltar · 1 de 3", as barrinhas do passo, o nome do caminho e a pergunta. */
function Passo({ n, total, nome, pergunta, onVoltar, children }: { n: number; total: number; nome: string; pergunta?: string; onVoltar: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4" data-passo={n}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onVoltar} className="-ml-1 flex min-h-11 items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={16} aria-hidden /> Voltar
        </button>
        {total > 0 ? <span className="text-sm tabular-nums text-ink-muted">{`${n} de ${total}`}</span> : <span className="text-sm text-ink-muted">A resposta</span>}
      </div>
      {total > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }} aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={`h-1 rounded-full ${i < n ? "bg-ink" : "bg-border-strong"}`} />
          ))}
        </div>
      )}
      <span className="text-[13px] font-medium text-ink-muted">{nome}</span>
      {pergunta && <h2 className="-mt-2 text-[1.625rem] font-medium leading-tight tracking-[-0.01em] text-ink">{pergunta}</h2>}
      {children}
    </div>
  );
}

function Opcao({ meta, on, selo, sub, onClick }: { meta: MetaDoFluxo; on: boolean; selo?: { texto: string; ruim: boolean } | null; sub: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="flex items-center gap-3 rounded-3xl bg-surface p-2.5 pr-4 text-left shadow-[inset_0_0_0_1px_var(--color-border)] aria-pressed:shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto da meta */}
      <img src={meta.foto} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-2xl object-cover" />
      <span className="min-w-0 flex-1">
        {selo && <small className={`mb-0.5 inline-block rounded-full px-2 py-px text-xs font-medium ${selo.ruim ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>{selo.texto}</small>}
        <b className="block truncate text-[15px] font-medium text-ink">{meta.nome}</b>
        <small className="text-[13px] tabular-nums text-ink-muted">{sub}</small>
      </span>
    </button>
  );
}

const atrasada = (m: MetaDoFluxo) => m.prazoMeses !== null && !m.noPrazo;

/**
 * "Como guardar mais?" (protótipo, #decidir-guardar): 1 de 3 "Seu plano guarda R$ X por mês.
 * Certo?" com o que as metas pedem; 2 de 3 "Onde dá para apertar?" com as chaves; 3 de 3 "Para
 * qual sonho vai?"; e a resposta: quanto dá para guardar e quando a meta chega com e sem o extra.
 */
export function FluxoGuardarMais({
  guarda,
  renda,
  categorias,
  repeteNoMes,
  metas,
  hoje,
}: {
  guarda: number;
  renda: number | null;
  categorias: { key: string; label: string; planejado: number; essencial?: boolean }[];
  repeteNoMes: number;
  metas: MetaDoFluxo[];
  hoje: { ano: number; mes: number };
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [passo, setPasso] = useState<1 | 2 | 3 | 4>(1);
  const opcoes = apertos(categorias);
  const [liga, setLiga] = useState<Record<string, boolean>>(() => ({ ...Object.fromEntries(opcoes.map((o) => [o.key, o.ligadoDeInicio])), repete: repeteNoMes > 0 }));
  const [metaId, setMetaId] = useState<string | null>(() => (metas.find(atrasada) ?? metas[0])?.id ?? null);
  const extra = opcoes.reduce((s, o) => s + (liga[o.key] ? o.corte : 0), 0) + (liga.repete ? Math.round(repeteNoMes) : 0);
  const somaPede = metas.reduce((s, x) => s + x.necessario, 0);
  const voltar = () => (passo === 1 ? router.push("/decidir") : setPasso((p) => (p - 1) as 1 | 2 | 3));
  const nome = "Guardar mais";

  if (passo === 1)
    return (
      <Passo n={1} total={3} nome={nome} pergunta={`Seu plano guarda ${m(guarda)} por mês. Certo?`} onVoltar={voltar}>
        <div className={cartao}>
          <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
            <span>Guardar no mês</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink">Do seu plano</span>
          </div>
          <ValorDestaque texto={m(guarda)} />
          {renda ? <p className="text-sm text-ink-muted">{Math.round((guarda / renda) * 100)}% da renda</p> : null}
        </div>
        {metas.length > 0 && (
          <div className={cartao}>
            <b className="text-[15px] font-medium text-ink">Suas metas pedem {m(somaPede)}</b>
            {metas.map((x) => (
              <div key={x.id} className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm first-of-type:border-t-0">
                <span className="min-w-0 truncate text-ink-muted">
                  {x.nome}
                  {x.prazoTexto ? ` · até ${x.prazoTexto}` : ""}
                </span>
                <b className="shrink-0 font-medium tabular-nums text-ink">{m(x.necessario)}</b>
              </div>
            ))}
          </div>
        )}
        <button type="button" className={preto} onClick={() => setPasso(2)}>
          Sim, continuar
        </button>
      </Passo>
    );

  if (passo === 2)
    return (
      <Passo n={2} total={3} nome={nome} pergunta="Onde dá para apertar?" onVoltar={voltar}>
        <p className="-mt-2 text-sm text-ink-muted">Sem mexer em moradia, saúde e educação.</p>
        <div className="overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]">
          {opcoes.map((o) => (
            <Chave key={o.key} titulo={o.label} sub={`${m(o.planejado)} vira ${m(o.depois)}`} ligado={!!liga[o.key]} onTrocar={() => setLiga((l) => ({ ...l, [o.key]: !l[o.key] }))} />
          ))}
          {repeteNoMes > 0 && <Chave titulo="Assinaturas" sub={`As que se repetem todo mês · ${m(repeteNoMes)} por mês`} ligado={!!liga.repete} onTrocar={() => setLiga((l) => ({ ...l, repete: !l.repete }))} />}
        </div>
        <div className={cartao}>
          <span className="text-sm text-ink-muted">A mais por mês</span>
          <ValorDestaque texto={m(extra)} />
          <p className="text-sm text-ink-muted">{m(extra * 12)} por ano</p>
        </div>
        <p className="text-sm text-ink-muted">O quanto apertar é a regra do app: desejos primeiro, depois o dia a dia.</p>
        <button type="button" className={preto} disabled={!(extra > 0)} onClick={() => setPasso(metas.length ? 3 : 4)}>
          Continuar
        </button>
      </Passo>
    );

  if (passo === 3)
    return (
      <Passo n={3} total={3} nome={nome} pergunta="Para qual sonho vai?" onVoltar={voltar}>
        <div className="flex flex-col gap-2">
          {metas.map((x) => (
            <Opcao key={x.id} meta={x} on={metaId === x.id} selo={atrasada(x) ? { texto: "Atrasada", ruim: true } : null} sub={`${m(x.atual)} de ${m(x.alvo)}`} onClick={() => setMetaId(x.id)} />
          ))}
        </div>
        <button type="button" className={preto} onClick={() => setPasso(4)}>
          Ver o resultado
        </button>
      </Passo>
    );

  const meta = metas.find((x) => x.id === metaId) ?? null;
  const novo = guarda + extra;
  const sem = meta ? mesesParaChegar(meta, meta.ritmo) : null;
  const com = meta ? mesesParaChegar(meta, meta.ritmo + extra) : null;
  return (
    <Passo n={0} total={0} nome={nome} onVoltar={voltar}>
      <HeroiDoTema>
        <div className="flex flex-col gap-1" data-resposta-decidir>
          <span className="text-sm text-heroi-suave">Dá para guardar por mês</span>
          <ValorDestaque texto={m(novo)} />
          <span className="text-[15px] text-heroi-suave">
            em vez de {m(guarda)} · {m(extra)} a mais por mês
          </span>
        </div>
      </HeroiDoTema>
      {meta && (
        <div className={cartao}>
          <b className="text-[15px] font-medium text-ink">{meta.nome} chega em</b>
          {meta.prazoTexto && <Linha rotulo="Prazo" valor={meta.prazoTexto} />}
          <Linha rotulo="Com o extra" valor={com !== null ? mesDaqui(com, hoje, true) : "sem previsão"} />
          <Linha rotulo="Sem o extra" valor={sem !== null ? mesDaqui(sem, hoje, true) : "sem previsão"} />
          <p className="text-xs text-ink-muted">
            No ritmo dos últimos 3 meses ({m(meta.ritmo)} por mês), mais o extra.
            {meta.prazoMeses !== null && com !== null && com > meta.prazoMeses ? " Ainda depois do prazo." : ""}
          </p>
        </div>
      )}
      {renda ? (
        <p className="px-1 text-[15px] text-ink">
          São <b className="font-medium">{Math.round((novo / renda) * 100)}% da renda</b>. A aula pede no mínimo 10%.
        </p>
      ) : null}
      <Link href="/orcamento" className={preto}>
        Ajustar no orçamento
      </Link>
      {repeteNoMes > 0 && (
        <Link href="/decidir/raio-x" className={claro}>
          Ver as assinaturas
        </Link>
      )}
    </Passo>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm">
      <span className="text-ink-muted">{rotulo}</span>
      <b className="font-medium tabular-nums text-ink">{valor}</b>
    </div>
  );
}

function Chave({ titulo, sub, ligado, onTrocar }: { titulo: string; sub: string; ligado: boolean; onTrocar: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={`Apertar ${titulo}`} onClick={onTrocar} className="flex min-h-14 w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left first:border-t-0">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-medium text-ink">{titulo}</b>
        <small className="text-[13px] tabular-nums text-ink-muted">{sub}</small>
      </span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? "bg-ink" : "bg-[color-mix(in_srgb,var(--color-ink)_16%,transparent)]"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${ligado ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/**
 * "Quando chego na minha meta?" (protótipo, #decidir-meta): 1 de 3 Qual sonho?; 2 de 3 "Você
 * guarda R$ X por mês para Y. Certo?" com as colunas dos 3 últimos meses; 3 de 3 "E se guardar
 * mais?" com a régua; e a resposta: o mês em que chega, o prazo e o atraso.
 */
export function FluxoMinhaMeta({ metas, hoje }: { metas: MetaDoFluxo[]; hoje: { ano: number; mes: number } }) {
  const money = useMoney();
  const moeda = useCurrency();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const direto = metas.length === 1;
  const [passo, setPasso] = useState<1 | 2 | 3 | 4>(direto ? 2 : 1);
  const [metaId, setMetaId] = useState<string | null>(direto ? metas[0].id : null);
  const [outro, setOutro] = useState(false);
  const meta = metas.find((x) => x.id === metaId) ?? null;
  const [ritmo, setRitmo] = useState<number | null>(null);
  const [porMes, setPorMes] = useState<number | null>(null);
  const nome = "Minha meta";
  const voltar = () => (passo === 1 || (direto && passo === 2) ? router.push("/decidir") : setPasso((p) => (p - 1) as 1 | 2 | 3));

  if (metas.length === 0)
    return (
      <Passo n={0} total={0} nome={nome} onVoltar={() => router.push("/decidir")}>
        <p className="text-[15px] text-ink">Você ainda não tem uma meta em andamento.</p>
        <Link href="/planejamento/metas" className={preto}>
          Criar uma meta
        </Link>
      </Passo>
    );

  if (passo === 1 || !meta)
    return (
      <Passo n={1} total={3} nome={nome} pergunta="Qual sonho?" onVoltar={voltar}>
        <div className="flex flex-col gap-2">
          {metas.map((x) => (
            <Opcao
              key={x.id}
              meta={x}
              on={false}
              selo={x.prazoMeses === null ? null : { texto: x.noPrazo ? "No prazo" : "Atrasada", ruim: !x.noPrazo }}
              sub={`${Math.round((x.atual / x.alvo) * 100)}%${x.prazoTexto ? ` · prazo ${x.prazoTexto}` : ""}`}
              onClick={() => {
                setMetaId(x.id);
                setRitmo(null);
                setPorMes(null);
                setOutro(false);
                setPasso(2);
              }}
            />
          ))}
        </div>
      </Passo>
    );

  const media = Math.round(meta.ritmo);
  const ritmoUsado = ritmo ?? media;
  const v = porMes ?? ritmoUsado;
  const meses = mesesParaChegar(meta, v);
  const atraso = meses !== null && meta.prazoMeses !== null ? meses - meta.prazoMeses : 0;
  const precisa = meta.prazoMeses !== null && meta.necessario > 0 ? Math.ceil(meta.necessario) : null;
  const quando = (k: number | null) => (k !== null ? mesDaqui(k, hoje) : "Sem previsão");
  const situacao = meses === null ? "Sem guardar, a meta não chega." : atraso > 0 ? `Depois do prazo (${meta.prazoTexto}) · ${atraso} ${atraso > 1 ? "meses" : "mês"} de atraso` : meta.prazoMeses !== null ? "Dentro do prazo" : "Sem prazo definido";

  if (passo === 2) {
    const maior = Math.max(1, ...meta.ultimos3.map((x) => x.valor));
    return (
      <Passo n={2} total={3} nome={nome} pergunta={`Você guarda ${m(media)} por mês para ${meta.nome}. Certo?`} onVoltar={voltar}>
        <div className={cartao}>
          <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
            <span>Média dos últimos 3 meses</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink">Dos seus aportes</span>
          </div>
          <ValorDestaque texto={m(media)} />
          <p className="text-sm text-ink-muted">por mês</p>
          <div className="mt-1 grid h-28 grid-cols-3 items-end gap-3" data-tres-meses>
            {meta.ultimos3.map((x) => (
              <span key={x.rotulo} className="flex h-full flex-col items-center justify-end gap-1">
                <b className="text-xs font-medium tabular-nums text-ink">{m(x.valor)}</b>
                <i className="w-full max-w-12 rounded-t-lg bg-[var(--color-dinheiro-guardou)]" style={{ height: `${Math.max(3, (x.valor / maior) * 70)}%` }} />
                <small className="text-xs text-ink-muted">{x.rotulo}</small>
              </span>
            ))}
          </div>
        </div>
        {outro && (
          <label className="flex items-baseline justify-center gap-2 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <span className="text-lg text-ink-muted">{currencySymbol(moeda)}</span>
            <CampoDeDinheiro
              autoFocus
              aria-label="Quanto guarda por mês"
              placeholder="0,00"
              valor={ritmo}
              onValor={(v) => setRitmo(v ?? 0)}
              className="w-40 bg-transparent text-[2rem] font-light tabular-nums text-ink outline-none"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          {!outro ? (
            <button type="button" className={claro} onClick={() => setOutro(true)}>
              Outro valor
            </button>
          ) : (
            <span />
          )}
          <button type="button" className={preto} onClick={() => setPasso(3)}>
            Sim, continuar
          </button>
        </div>
      </Passo>
    );
  }

  if (passo === 3) {
    const max = Math.max(3000, precisa ?? 0, v);
    return (
      <Passo n={3} total={3} nome={nome} pergunta="E se guardar mais?" onVoltar={voltar}>
        <div className={cartao}>
          <span className="text-sm text-ink-muted">
            {meta.nome} · faltam {m(meta.alvo - meta.atual)}
          </span>
          <ValorDestaque texto={m(v)} />
          <p className="text-sm text-ink-muted">por mês</p>
          <input type="range" min={0} max={max} step={10} value={v} onChange={(e) => setPorMes(Number(e.target.value))} aria-label="Quanto guardar por mês" className="w-full accent-[var(--color-ink)]" />
          <p className="text-sm text-ink" aria-live="polite">
            {quando(meses)}
            {atraso > 0 ? ` · ${atraso} ${atraso > 1 ? "meses" : "mês"} depois do prazo` : meta.prazoMeses !== null && meses !== null ? " · no prazo" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPorMes(ritmoUsado)} className="min-h-10 rounded-full bg-surface-2 px-4 text-sm text-ink">
            Hoje
          </button>
          <button type="button" onClick={() => setPorMes(v + 100)} className="min-h-10 rounded-full bg-surface-2 px-4 text-sm text-ink">
            + guardar mais
          </button>
          {precisa !== null && (
            <button type="button" onClick={() => setPorMes(Math.max(precisa, 0))} className="min-h-10 rounded-full bg-surface-2 px-4 text-sm text-ink">
              No prazo
            </button>
          )}
        </div>
        <button type="button" className={preto} onClick={() => setPasso(4)}>
          Ver a resposta
        </button>
      </Passo>
    );
  }

  const linhaDoTempo = meses !== null && meta.prazoMeses !== null && meta.prazoMeses > 0;
  const fim = Math.max(meta.prazoMeses ?? 0, meses ?? 0, 1);
  return (
    <Passo n={0} total={0} nome={nome} onVoltar={voltar}>
      <HeroiDoTema>
        <div className="flex flex-col gap-1" data-resposta-decidir>
          <span className="text-sm text-heroi-suave">
            {meta.nome} · guardando {m(v)} por mês
          </span>
          <b className="text-[2.25rem] font-normal leading-tight tracking-[-0.02em]">{quando(meses)}</b>
          <span className="text-[15px] text-heroi-suave">{situacao}</span>
          {linhaDoTempo && (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="relative h-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)]">
                {[0, meta.prazoMeses! / fim, meses! / fim].map((p, i) => (
                  <b key={i} className={`absolute -top-1 size-3.5 -translate-x-1/2 rounded-full ${i === 2 && atraso > 0 ? "bg-danger" : "bg-[var(--color-heroi-tinta)]"}`} style={{ left: `${Math.min(100, p * 100)}%` }} />
                ))}
              </div>
              <div className="flex justify-between gap-2 text-xs text-heroi-suave">
                <span>Hoje</span>
                <span>Prazo {meta.prazoTexto}</span>
                <span>Chega {mesDaqui(meses!, hoje, true)}</span>
              </div>
            </div>
          )}
        </div>
      </HeroiDoTema>
      {precisa !== null && atraso > 0 && (
        <Link href={`/planejamento/metas/${meta.id}`} className={preto}>
          Guardar {m(precisa)} por mês
        </Link>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/planejamento/metas/${meta.id}`} className={claro}>
          Mudar o prazo
        </Link>
        <Link href={`/planejamento/metas/${meta.id}`} className={claro}>
          Ver a meta
        </Link>
      </div>
    </Passo>
  );
}
