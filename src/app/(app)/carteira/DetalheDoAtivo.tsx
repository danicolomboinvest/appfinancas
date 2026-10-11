"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, PencilLine, WalletMinimal } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { NOME_DO_TIPO, TIPOS, type Onde, type Tipo } from "@/lib/portfolio/classificacao";
import { grupoDoAtivo } from "@/lib/portfolio/classificacao";
import { AssetForm } from "./AssetForm";
import { textoDaTaxaCompra } from "@/lib/portfolio/taxa-compra";
import { ResgatarDoAtivo } from "./ResgatarDoAtivo";
import { DeleteAssetButton } from "./DeleteAssetButton";
import { LogoDoAtivo } from "@/components/ui/LogoDoAtivo";
import { COR_DO_GRUPO } from "./cores-dos-grupos";
import { trocarClassificacaoAction, trocarObjetivoAction } from "./carteira-nova-actions";
import type { AtivoDaTela } from "./MeusAtivos";
import type { NumeroDeFora, PrecoDoTitulo } from "./dados";

const NOME_DA_CLASSE: Record<string, string> = {
  RENDA_FIXA: "Renda fixa",
  TESOURO_DIRETO: "Tesouro Direto",
  ACAO: "Ação",
  FII: "FII",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  INTERNACIONAL: "Exterior",
  OUTRO: "Outro",
};
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * O detalhe de um ativo (rodadas 16 e 23): valor, ganho ou perda, preço médio × cotação, os
 * proventos dele no ano (mini colunas), a classificação com "Trocar" (tipo e Brasil/Exterior,
 * "você escolheu" e "Voltar ao automático"), o objetivo ("Para: ..." com Trocar), Editar e
 * Resgatei. Todo número de fora diz a fonte e a data.
 */
export function DetalheDoAtivo({
  ativo: a,
  metas,
  proventos,
  titulo,
  cdi,
  temAporteRecente,
  onFechar,
}: {
  ativo: AtivoDaTela;
  metas: { id: string; nome: string }[];
  proventos: { colunas: number[]; total: number } | null;
  titulo: PrecoDoTitulo | null;
  cdi: NumeroDeFora | null;
  temAporteRecente: boolean;
  onFechar: () => void;
}) {
  const money = useMoney();
  const [modo, setModo] = useState<"ver" | "classe" | "para" | "editar" | "resgatar">("ver");
  const cor = COR_DO_GRUPO[grupoDoAtivo(a)];
  const ganho = a.investedValue !== null && a.investedValue > 0 ? a.currentValue - a.investedValue : null;
  const pct = ganho !== null && a.investedValue ? ganho / a.investedValue : null;
  const emDolar = a.currency === "USD" && a.nativeCurrentValue !== null;
  const usd = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const atualizado = new Date(a.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const nomeDoObjetivo =
    a.objective === "RESERVA_EMERGENCIA" ? "Reserva de emergência" : a.objective === "LIBERDADE_FINANCEIRA" ? "Liberdade financeira" : a.objective === "META" ? (metas.find((m) => m.id === a.goalId)?.nome ?? "Uma meta") : "Nenhum objetivo";

  if (modo === "classe") return <TrocarClassificacao ativo={a} onPronto={() => setModo("ver")} />;
  if (modo === "para") return <TrocarObjetivo ativo={a} metas={metas} onPronto={() => setModo("ver")} />;
  if (modo === "resgatar") return <ResgatarDoAtivo assetId={a.id} nome={a.ticker ?? a.name} valorAtual={a.currentValue} investido={a.investedValue} onPronto={onFechar} />;
  if (modo === "editar")
    return (
      <div className="flex flex-col gap-3">
        <AssetForm
          goals={metas.map((m) => ({ id: m.id, name: m.nome }))}
          assetId={a.id}
          submitLabel="Salvar"
          onSuccess={onFechar}
          defaults={{
            name: a.name,
            ticker: a.ticker ?? undefined,
            quantity: a.quantity ?? undefined,
            assetClass: a.assetClass,
            objective: a.objective,
            goalId: a.goalId ?? undefined,
            fixedIncomeIndex: a.fixedIncomeIndex ?? undefined,
            taxaCompra: a.taxaCompra,
            ...(emDolar ? { currency: a.currency, currentValue: a.nativeCurrentValue ?? undefined, investedValue: a.nativeInvestedValue ?? undefined } : { currentValue: a.currentValue, investedValue: a.investedValue ?? undefined }),
          }}
        />
        <div className="flex justify-center pt-1">
          <DeleteAssetButton id={a.id} name={a.ticker ?? a.name} temAporteRecente={temAporteRecente} />
        </div>
      </div>
    );

  const precoMedio = a.quantity && a.quantity > 0 && a.investedValue ? a.investedValue / a.quantity : null;
  const maxCol = proventos ? Math.max(...proventos.colunas, 0.01) : 1;
  const hoje = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <LogoDoAtivo nome={a.name} ticker={a.ticker} rendaFixa={a.assetClass === "TESOURO_DIRETO" || a.assetClass === "RENDA_FIXA"} cor={cor} tamanho={44} />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium text-ink">{a.ticker && a.ticker !== a.name ? a.name : a.name}</p>
          <p className="text-[13px] text-ink-muted">{NOME_DA_CLASSE[a.assetClass]}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {emDolar ? (
          <>
            <span className="text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums text-ink">{usd(a.nativeCurrentValue!)}</span>
            <span className="text-[13px] tabular-nums text-ink-muted">≈ {money(a.currentValue)}</span>
          </>
        ) : (
          <ValorDestaque texto={money(a.currentValue)} className="text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums text-ink" />
        )}
        {ganho !== null && pct !== null && Math.abs(ganho) >= 0.005 && (
          <span
            className="w-fit rounded-full px-2.5 py-1 text-[13px] font-medium tabular-nums"
            style={{ background: `color-mix(in srgb, var(${ganho < 0 ? "--color-danger" : "--color-success"}) 13%, var(--color-surface))`, color: `var(${ganho < 0 ? "--color-danger" : "--color-success"})` }}
          >
            {ganho < 0 ? "Perda" : "Ganho"} de {money(Math.abs(ganho))} · {(Math.abs(pct) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        )}
      </div>

      {precoMedio !== null && a.currentUnitPrice !== null && (
        <div className="grid grid-cols-2 gap-2.5">
          <Caixa rotulo="Preço médio" valor={money(precoMedio)} />
          <Caixa rotulo="Cotação" valor={money(a.currentUnitPrice)} nota={`atualizada em ${atualizado}`} />
        </div>
      )}

      {a.taxaCompra !== null && (
        <p className="text-[14px] text-ink">
          Comprou a <span className="font-medium">{textoDaTaxaCompra(a.taxaCompra, a.fixedIncomeIndex)}</span>
        </p>
      )}

      {titulo && (
        <div className="rounded-2xl bg-surface-2 p-3.5">
          <p className="text-[13px] text-ink-muted">Preço do título hoje</p>
          <p className="mt-0.5 text-[17px] font-medium tabular-nums text-ink">{money(titulo.preco)}</p>
          {titulo.taxa !== null && (
            <p className="text-[13px] text-ink">
              Taxa de hoje: {titulo.tipo.includes("IPCA") || titulo.tipo.includes("Renda+") || titulo.tipo.includes("Educa+") ? "IPCA + " : titulo.tipo.includes("Selic") ? "Selic + " : ""}
              {titulo.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%{titulo.tipo.includes("Selic") ? "" : " ao ano"}
            </p>
          )}
          <p className="mt-1 text-[12px] text-ink-muted">
            {titulo.fonte} · {titulo.quando}. Estimado, antes do IR e da taxa da B3.
          </p>
        </div>
      )}

      {!titulo && (a.assetClass === "RENDA_FIXA" || a.assetClass === "TESOURO_DIRETO") && a.fixedIncomeIndex !== "IPCA" && a.fixedIncomeIndex !== "PREFIXADO" && cdi && (
        <p className="text-[12.5px] text-ink-muted">
          CDI {cdi.valor} · {cdi.fonte} · {cdi.quando}
        </p>
      )}

      {proventos && (
        <div className="rounded-2xl bg-surface-2 p-3.5">
          <p className="text-[13px] text-ink-muted">
            Proventos dele em 12 meses · <span className="tabular-nums text-ink">{money(proventos.total)}</span>
          </p>
          <div className="mt-2.5 flex h-12 items-end gap-1" aria-hidden>
            {proventos.colunas.map((v, i) => (
              <span key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(4, (v / maxCol) * 100)}%`, background: v > 0 ? "var(--color-success)" : "var(--color-border)", opacity: 0.8 }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[12px] text-ink-faint">
            <span>{MES[new Date(hoje.getFullYear(), hoje.getMonth() - 10, 1).getMonth()]}</span>
            <span>{MES[new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getMonth()]}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-border border-y border-border">
        <Linha rotulo="Classificação" valor={a.classificacao} selo={a.classificacaoEscolhida ? "você escolheu" : null} onTrocar={() => setModo("classe")} />
        <Linha rotulo="Para" valor={nomeDoObjetivo} onTrocar={() => setModo("para")} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setModo("editar")} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
          <PencilLine size={16} /> Editar
        </button>
        <button type="button" onClick={() => setModo("resgatar")} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
          <WalletMinimal size={16} /> Resgatei
        </button>
      </div>
      {a.ticker && (a.assetClass === "ACAO" || a.assetClass === "FII" || a.assetClass === "INTERNACIONAL") && (
        <Link href="/fichas" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent">
          Ver análise <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

function Caixa({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <p className="text-[13px] text-ink-muted">{rotulo}</p>
      <p className="mt-0.5 text-[17px] font-medium tabular-nums text-ink">{valor}</p>
      {nota && <p className="text-[12px] text-ink-muted">{nota}</p>}
    </div>
  );
}

function Linha({ rotulo, valor, selo, onTrocar }: { rotulo: string; valor: string; selo?: string | null; onTrocar: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] text-ink-muted">{rotulo}</p>
        <p className="truncate text-[15px] font-medium text-ink">{valor}</p>
        {selo && <p className="text-[12px] text-accent-strong">{selo}</p>}
      </div>
      <button type="button" onClick={onTrocar} className="min-h-11 shrink-0 px-1 text-[14px] font-medium text-ink underline underline-offset-[3px]">
        Trocar
      </button>
    </div>
  );
}

function Pilulas<T extends string>({ opcoes, valor, onEscolher, rotulo }: { opcoes: [T, string][]; valor: T | null; onEscolher: (v: T) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map(([v, nome]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onEscolher(v)}
          className={`min-h-11 rounded-full border px-4 text-[14px] transition-colors ${valor === v ? "border-transparent bg-ink font-medium text-surface" : "border-border-strong text-ink hover:bg-surface-2"}`}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}

/** "Trocar" a classificação: tipo e onde, a escolha dela manda; "Voltar ao automático" desfaz. */
export function TrocarClassificacao({ ativo, onPronto }: { ativo: AtivoDaTela; onPronto: () => void }) {
  const [tipo, setTipo] = useState<Tipo>(ativo.tipo);
  const [onde, setOnde] = useState<Onde>(ativo.onde);
  const [pendente, start] = useTransition();
  const { showToast, showError } = useToast();
  const salvar = (t: Tipo | null, o: Onde | null) =>
    start(async () => {
      const r = await trocarClassificacaoAction(ativo.id, t, o);
      if (!r.ok) return showError("Não consegui trocar agora. Tente de novo.");
      showToast(t === null ? "Voltou ao automático" : "Classificação trocada");
      onPronto();
    });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-ink">
        Hoje: <span className="font-medium">{ativo.classificacao}</span>
        {ativo.classificacaoEscolhida && <span className="text-ink-muted"> (você escolheu)</span>}
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink-muted">Tipo</p>
        <Pilulas rotulo="Tipo" opcoes={TIPOS.map((t) => [t, NOME_DO_TIPO[t]] as [Tipo, string])} valor={tipo} onEscolher={setTipo} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink-muted">Onde</p>
        <Pilulas rotulo="Onde" opcoes={[["brasil", "Brasil"], ["exterior", "Exterior"]] as [Onde, string][]} valor={onde} onEscolher={setOnde} />
      </div>
      <p className="text-[12.5px] text-ink-muted">Muda o grupo no Por tipo, a linha na Estratégia e o total Brasil e Exterior.</p>
      <button type="button" disabled={pendente} onClick={() => salvar(tipo, onde)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-50">
        <Check size={16} /> Salvar
      </button>
      {ativo.classificacaoEscolhida && (
        <button type="button" disabled={pendente} onClick={() => salvar(null, null)} className="min-h-11 text-[14px] font-medium text-ink-muted underline underline-offset-[3px]">
          Voltar ao automático
        </button>
      )}
    </div>
  );
}

function TrocarObjetivo({ ativo, metas, onPronto }: { ativo: AtivoDaTela; metas: { id: string; nome: string }[]; onPronto: () => void }) {
  const atual = ativo.objective === "META" && ativo.goalId ? `meta:${ativo.goalId}` : ativo.objective;
  const [escolha, setEscolha] = useState<string>(atual);
  const [pendente, start] = useTransition();
  const { showToast, showError } = useToast();
  const opcoes: [string, string][] = [
    ...metas.map((m) => [`meta:${m.id}`, m.nome] as [string, string]),
    ["RESERVA_EMERGENCIA", "Reserva de emergência"],
    ["LIBERDADE_FINANCEIRA", "Liberdade financeira"],
    ["OUTRO", "Nenhum por enquanto"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-ink">Para que é este dinheiro?</p>
      <Pilulas rotulo="Objetivo" opcoes={opcoes} valor={escolha} onEscolher={setEscolha} />
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          start(async () => {
            const meta = escolha.startsWith("meta:") ? escolha.slice(5) : null;
            const r = await trocarObjetivoAction(ativo.id, meta ? "META" : escolha, meta);
            if (!r.ok) return showError("Não consegui trocar agora. Tente de novo.");
            showToast("Objetivo trocado");
            onPronto();
          })
        }
        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-50"
      >
        <Check size={16} /> Salvar
      </button>
    </div>
  );
}
