"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, Minus, PiggyBank, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Interruptor, Segmentado } from "@/components/ui/Interruptor";
import { lerData } from "@/lib/contas/contas";
import { camposDaRegra, ehMenosQueMensal, estimativaAproximada, guardePorMes, mediaPorMes, previaDoze, regraDaConta, textoDaRegra, type Regra, type Unidade } from "@/lib/contas/frequencia";
import { apagarContaAction, historicoDaContaAction, salvarContaAction } from "./actions";
import type { ContaSerial } from "./LinhaDaConta";

type Modo = "nao" | "cada" | "meses";
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const UNIDADE_ROTULO: Record<Unidade, [string, string]> = { dias: ["dia", "dias"], semanas: ["semana", "semanas"], meses: ["mês", "meses"], anos: ["ano", "anos"] };

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-ink-muted">{children}</span>;
}

/** Um − N + com o número no meio. */
function Contador({ valor, min, max, aoMudar, rotulo }: { valor: number; min: number; max: number; aoMudar: (n: number) => void; rotulo: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={rotulo}>
      <button type="button" aria-label="Menos" disabled={valor <= min} onClick={() => aoMudar(Math.max(min, valor - 1))} className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink disabled:opacity-35">
        <Minus size={18} aria-hidden />
      </button>
      <span className="flex h-11 min-w-12 items-center justify-center rounded-xl border border-border bg-surface px-2 text-[17px] tabular-nums text-ink" aria-live="polite">
        {valor}
      </span>
      <button type="button" aria-label="Mais" disabled={valor >= max} onClick={() => aoMudar(Math.min(max, valor + 1))} className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink disabled:opacity-35">
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}

/**
 * A prévia dos 12 meses (rodada 10 e adendo): uma coluna por mês, altura do zero proporcional ao
 * total do mês, sem número em cima. Quando varia (2 ou 3 vezes no mês), o tom forte marca os meses
 * cheios e a legenda diz quanto é cada um. Aproximada: as colunas listradas.
 */
function Previa({ meses, aproximado, valor, aoTocar, tocado }: { meses: ReturnType<typeof previaDoze>; aproximado: boolean; valor: number; aoTocar: (i: number | null) => void; tocado: number | null }) {
  const money = useMoney();
  const max = Math.max(...meses.map((m) => m.total), 1);
  const vezes = [...new Set(meses.filter((m) => m.vezes > 0).map((m) => m.vezes))].sort((a, b) => a - b);
  const varia = vezes.length > 1;
  const maiorVez = vezes[vezes.length - 1];
  const listra = "repeating-linear-gradient(135deg, var(--color-accent) 0 3px, color-mix(in srgb, var(--color-accent) 45%, transparent) 3px 6px)";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-32 items-end gap-1 pt-4" role="img" aria-label="Prévia dos próximos 12 meses">
        {meses.map((m, i) => {
          const forte = !varia || m.vezes === maiorVez;
          const virada = m.mes === 1 && i > 0;
          return (
            <div key={`${m.ano}-${m.mes}`} className={`relative flex h-full min-w-0 flex-1 flex-col justify-end ${virada ? "border-l border-border pl-0.5" : ""}`}>
              {virada && <span className="absolute -top-4 left-1 text-[12px] text-ink-muted">{m.ano}</span>}
              <button
                type="button"
                aria-label={`${MES_CURTO[m.mes - 1]}: ${money(m.total)}`}
                onClick={() => aoTocar(tocado === i ? null : i)}
                className="w-full rounded-t-[4px]"
                style={{
                  height: m.total > 0 ? `${Math.max(6, (m.total / max) * 100)}%` : "3px",
                  background: m.total <= 0 ? "color-mix(in srgb, var(--color-ink) 10%, transparent)" : aproximado ? listra : forte ? "var(--color-accent)" : "color-mix(in srgb, var(--color-accent) 40%, transparent)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {meses.map((m, i) => (
          <span key={i} className={`min-w-0 flex-1 text-center text-[12px] ${tocado === i ? "font-semibold text-ink" : "text-ink-muted"}`}>
            {MES_CURTO[m.mes - 1]}
          </span>
        ))}
      </div>
      {tocado !== null && (
        <p className="text-center text-[13px] text-ink">
          {MES_CURTO[meses[tocado].mes - 1]}: {aproximado ? "~" : ""}
          {money(meses[tocado].total)}
        </p>
      )}
      {varia && (
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
          {vezes.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: v === maiorVez ? "var(--color-accent)" : "color-mix(in srgb, var(--color-accent) 40%, transparent)" }} aria-hidden />
              {v} vezes no mês: {money(v * valor, { round: true })}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export type InicioDaFolha = { conta?: ContaSerial; dia?: string; doAno?: boolean };

/**
 * A folha da conta (protótipo aprovado, rodadas 4, 6a e 10): nome com sugestões, valor ou "mais ou
 * menos", primeiro vencimento, a regra livre (não repete, a cada N, meses que eu escolho),
 * parcelado, a prévia de 12 meses com o "guarde por mês" e o "Me lembrar".
 */
export function FolhaDaConta({ inicio, hoje, onFeito }: { inicio: InicioDaFolha; hoje: string; onFeito: () => void }) {
  const conta = inicio.conta;
  const money = useMoney();
  const router = useRouter();
  const { showError } = useToast();
  const [salvando, iniciar] = useTransition();
  const regraInicial: Regra = conta
    ? regraDaConta(conta)
    : inicio.doAno
      ? { tipo: "a_cada", n: 1, unidade: "anos" }
      : { tipo: "a_cada", n: 1, unidade: "meses" };

  const [nome, setNome] = useState(conta?.nome ?? "");
  const [valor, setValor] = useState<number | undefined>(conta?.valor ?? undefined);
  const [aproximado, setAproximado] = useState(conta ? conta.aproximado || conta.valor === null : false);
  const [vencimento, setVencimento] = useState(conta?.vencimento ?? inicio.dia ?? hoje);
  const [modo, setModo] = useState<Modo>(regraInicial.tipo === "nao_repete" ? "nao" : regraInicial.tipo === "meses" ? "meses" : "cada");
  const [n, setN] = useState(regraInicial.tipo === "a_cada" ? regraInicial.n : 1);
  const [unidade, setUnidade] = useState<Unidade>(regraInicial.tipo === "a_cada" ? regraInicial.unidade : "meses");
  const [meses, setMeses] = useState<number[]>(regraInicial.tipo === "meses" ? regraInicial.meses : []);
  const [parcelado, setParcelado] = useState((conta?.parcelas ?? 0) > 1);
  const [vezes, setVezes] = useState(conta?.parcelas ?? 10);
  const [peloTotal, setPeloTotal] = useState(conta?.valorEhTotal ?? false);
  const [lembrar, setLembrar] = useState(conta?.lembrar ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [tocado, setTocado] = useState<number | null>(null);
  const [historico, setHistorico] = useState<{ mes: string; valor: number }[]>([]);

  // A sugestão da média só aparece com o "valor muda" ligado e um nome que o extrato conhece.
  useEffect(() => {
    if (!aproximado || nome.trim().length < 3) return;
    let vivo = true;
    const t = setTimeout(() => {
      void historicoDaContaAction(nome).then((h) => vivo && setHistorico(h));
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aproximado, nome]);
  const media = historico.length >= 2 ? estimativaAproximada(historico.map((h) => h.valor)) : null;

  const regra: Regra = modo === "nao" ? (parcelado ? { tipo: "a_cada", n: 1, unidade: "meses" } : { tipo: "nao_repete" }) : modo === "meses" && meses.length > 0 ? { tipo: "meses", meses } : { tipo: "a_cada", n, unidade };
  const parcela = valor && parcelado && peloTotal ? Math.round((valor / vezes) * 100) / 100 : (valor ?? 0);
  const primeira = lerData(vencimento);
  const hojeD = lerData(hoje)!;
  const restantes = parcelado ? vezes - ((conta?.parcelaAtual ?? 1) - 1) : Infinity;
  const previa = primeira ? previaDoze(primeira, regra, parcela, hojeD, restantes, conta?.diaDoMes ?? primeira.getUTCDate()) : [];
  const menosQueMensal = ehMenosQueMensal(regra) && !parcelado;
  const guarde = menosQueMensal && primeira && parcela > 0 ? guardePorMes(parcela, primeira, hojeD) : null;

  const til = aproximado ? "~" : "";
  const frase = (() => {
    if (!parcela) return null;
    const v = `${til}${money(parcela, { round: parcela >= 100 })}`;
    if (parcelado) return `${vezes}x de ${money(parcela)}${peloTotal && valor ? ` · total ${money(valor, { round: true })}` : ""}`;
    if (regra.tipo === "nao_repete") return primeira ? `${v} uma vez · ${primeira.getUTCDate()} ${MES_CURTO[primeira.getUTCMonth()]}` : v;
    if (regra.tipo === "a_cada" && regra.unidade === "meses" && regra.n === 1) return `${v} todo mês${primeira ? ` · próxima ${primeira.getUTCDate()} ${MES_CURTO[primeira.getUTCMonth()]}` : ""}`;
    if (menosQueMensal) return `${v} ${textoDaRegra(regra)}${primeira && regra.tipo === "a_cada" && regra.unidade === "anos" ? ` · ${MES_CURTO[primeira.getUTCMonth()]}` : ""}`;
    return `${v} ${textoDaRegra(regra)} · dá uns ${money(mediaPorMes(parcela, regra), { round: true })} por mês`;
  })();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Diga o que é a conta.");
    if (!aproximado && !(valor && valor > 0)) return setErro('Coloque o valor ou ligue "Valor muda todo mês".');
    if (modo === "meses" && meses.length === 0) return setErro("Escolha pelo menos um mês.");
    setErro(null);
    const campos = camposDaRegra(regra);
    iniciar(async () => {
      const r = await salvarContaAction({
        id: conta?.id,
        nome,
        valor: valor && valor > 0 ? parcela : null,
        vencimento,
        lembrar,
        ...campos,
        parcelas: parcelado ? vezes : null,
        parcelaAtual: parcelado ? Math.min(vezes, conta?.parcelaAtual ?? 1) : null,
        valorEhTotal: parcelado && peloTotal,
        aproximado,
      });
      if (!r.ok) return setErro(r.erro);
      // Sem aviso (14/10/2026): a folha fecha e a conta aparece na lista.
      router.refresh();
      onFeito();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Luz, Internet, Diarista"
        maxLength={80}
        aria-label="Nome da conta"
        autoFocus={!conta}
        className="min-h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-[17px] text-ink outline-none focus:border-accent"
      />

      {/* Protótipo (folha "Nova conta"): Nome, Valor, a chave "Valor muda todo mês", a linha do
          primeiro vencimento, Repete, Parcelado e a prévia dos 12 meses. */}
      <CurrencyInputControlled label={aproximado ? "Mais ou menos" : parcelado && peloTotal ? "Valor total" : parcelado ? "Valor da parcela" : "Valor"} value={valor} onChange={setValor} />
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <Interruptor ligado={aproximado} aoMudar={setAproximado} titulo="Valor muda todo mês" sub={aproximado ? "Usamos esse valor para planejar. Quando a conta chegar no extrato, vale o valor de verdade." : undefined} />
      </div>
      {aproximado && media !== null && (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3">
          <p className="text-sm text-ink">
            Nos últimos {historico.length} meses deu em média {money(media, { round: true })} ({money(Math.min(...historico.map((h) => h.valor)), { round: true })} a {money(Math.max(...historico.map((h) => h.valor)), { round: true })})
          </p>
          <button type="button" onClick={() => setValor(media)} className="min-h-10 rounded-full bg-accent-soft px-4 text-sm font-medium text-accent-strong">
            Usar {money(media, { round: true })}
          </button>
        </div>
      )}
      <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-2">
        <span className="text-[15px] text-ink">Primeiro vencimento</span>
        <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required aria-label="Primeiro vencimento" className="min-h-10 min-w-0 rounded-xl bg-surface-2 px-2 text-right text-[15px] text-ink" />
      </label>

      <div className="flex flex-col gap-2">
        <Rotulo>Repete</Rotulo>
        <Segmentado
          rotulo="Repete"
          valor={modo}
          aoEscolher={setModo}
          opcoes={[
            { valor: "nao", rotulo: "Não repete" },
            { valor: "cada", rotulo: "A cada" },
            { valor: "meses", rotulo: "Meses" },
          ]}
        />
        {modo === "cada" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] text-ink">A cada</span>
              <Contador valor={n} min={1} max={36} aoMudar={setN} rotulo="Quantas" />
              <select value={unidade} onChange={(e) => setUnidade(e.target.value as Unidade)} aria-label="Unidade" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-[15px] text-ink">
                {(Object.keys(UNIDADE_ROTULO) as Unidade[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIDADE_ROTULO[u][n === 1 ? 0 : 1]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {([[1, "meses", "1 mês"], [2, "semanas", "2 semanas"], [1, "anos", "1 ano"]] as const).map(([k, u, t]) => {
                const on = n === k && unidade === u;
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => { setN(k); setUnidade(u); }} className="min-h-10 rounded-full bg-surface-2 px-3.5 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-canvas">
                    {t}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {modo === "meses" && (
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Meses">
            {MES_CURTO.map((m, i) => {
              const on = meses.includes(i + 1);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => setMeses(on ? meses.filter((x) => x !== i + 1) : [...meses, i + 1].sort((a, b) => a - b))} className={`min-h-10 rounded-full text-[13px] ${on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink"}`}>
                  {m}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <Interruptor ligado={parcelado} aoMudar={setParcelado} titulo="Parcelado" icone={<CreditCard size={18} aria-hidden />} />
        {parcelado && (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] text-ink">Em quantas vezes</span>
              <Contador valor={vezes} min={2} max={48} aoMudar={setVezes} rotulo="Vezes" />
            </div>
            <Segmentado rotulo="O valor é" valor={peloTotal ? "total" : "parcela"} aoEscolher={(v) => setPeloTotal(v === "total")} opcoes={[{ valor: "parcela", rotulo: "Valor da parcela" }, { valor: "total", rotulo: "Valor total" }]} />
          </div>
        )}
      </div>

      {previa.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4" data-previa-conta>
          <p className="text-[13px] text-ink-muted">
            Prévia · {MES_CURTO[previa[0].mes - 1]} {previa[0].ano} a {MES_CURTO[previa[previa.length - 1].mes - 1]} {previa[previa.length - 1].ano}
          </p>
          {frase && <p className="text-[15px] text-ink">{frase}</p>}
          <Previa meses={previa} aproximado={aproximado} valor={parcela} aoTocar={setTocado} tocado={tocado} />
          {guarde !== null && guarde > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-ink">
              <PiggyBank size={16} aria-hidden /> Guarde <b className="font-semibold">{money(guarde, { round: true })}</b> por mês
            </p>
          )}
          {/* Vence neste mês: é para pagar agora, não para separar aos poucos (21/10/2026). */}
          {guarde === 0 && <p className="text-center text-sm text-ink">Vence este mês</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <Interruptor ligado={lembrar} aoMudar={setLembrar} titulo="Me lembrar" icone={<Bell size={18} aria-hidden />} />
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}

      <button type="submit" disabled={salvando} className="min-h-12 w-full rounded-full bg-ink text-[15px] font-medium text-canvas disabled:opacity-60">
        Salvar
      </button>
      {conta && (
        <div className="flex justify-center">
          <DeleteButton
            label="Apagar conta"
            onDelete={async () => {
              try {
                await apagarContaAction(conta.id);
                router.refresh();
                onFeito();
              } catch {
                showError("Não apagou. Tente de novo.");
              }
            }}
          />
        </div>
      )}
    </form>
  );
}
