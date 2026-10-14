"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, TrendingDown, TrendingUp } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { useToast } from "@/components/ui/toast-context";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { EVENTO_IMPORTAR } from "@/components/shell/registrar-eventos";
import { FORMAS, NOME_DA_FORMA, type Forma } from "@/lib/empresa/config";
import { ehVenda, foiRecebida, somarDias } from "@/lib/empresa/regras";
import { MESES, contasDoMes } from "@/lib/empresa/resumo";
import type { ResumoDaEmpresa } from "@/lib/empresa/resumo";
import type { DadosDaEmpresa } from "@/lib/empresa/dados";
import { pagueiAction, recebiAction, vendiAction } from "./actions";
import { BOTAO_PRINCIPAL, Chip, Iniciais, LinhaDoRecibo } from "./partes";
import { FileUp } from "lucide-react";

type Modo = null | "vendi" | "paguei" | "recebi";

const GASTOS = [
  ["insumos", "Insumos"],
  ["embalagens", "Embalagens"],
  ["entregas", "Entregas"],
  ["anuncios", "Anúncios"],
  ["maquininha", "Maquininha"],
  ["outro", "Outro"],
] as const;


/**
 * O + de quem vende (protótipo aprovado): Vendi, Paguei, Recebi e Importar extrato PJ. Tudo entra no
 * mês de hoje. Na venda, "de quem" e "quando cai" são opcionais.
 */
export function RegistrarNaEmpresa({ aberto, onFechar, dados, R, clientes }: { aberto: boolean; onFechar: () => void; dados: DadosDaEmpresa; R: ResumoDaEmpresa; clientes: string[] }) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m0 = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showError } = useToast();
  const [salvando, iniciar] = useTransition();
  const [modo, setModo] = useState<Modo>(null);
  const [valor, setValor] = useState<number | null>(null);
  const formasDela = dados.config?.formas.length ? dados.config.formas : (["pix", "credito"] as Forma[]);
  const [forma, setForma] = useState<Forma>(formasDela[0]);
  const [cliente, setCliente] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState("");
  const [depois, setDepois] = useState<boolean | null>(null);
  const [data, setData] = useState<string>("");
  const [gasto, setGasto] = useState<{ tipo?: string; contaId?: string; contaNome?: string } | null>(null);

  // Ao abrir, sempre do começo.
  const [estava, setEstava] = useState(aberto);
  if (aberto !== estava) {
    setEstava(aberto);
    if (aberto) {
      setModo(null);
      setValor(null);
      setCliente(null);
      setOutroNome("");
      setDepois(null);
      setData("");
      setGasto(null);
    }
  }

  const prazoPadrao = (f: Forma) => (f === "credito" ? (dados.config?.prazoCredito ?? 30) : f === "debito" ? 1 : 30);
  const caiDepois = depois ?? (forma === "credito" || forma === "boleto");
  const dataDeCair = data || somarDias(dados.hoje, prazoPadrao(forma));
  const contasAbertas = useMemo(() => contasDoMes(dados).filter((c) => !c.paga), [dados]);
  const aReceber = useMemo(
    () => dados.lancamentos.filter((l) => ehVenda(l) && l.forma !== "credito" && l.forma !== "debito" && l.recebeEm && !foiRecebida(l, dados.hoje)).sort((a, b) => (a.recebeEm ?? "").localeCompare(b.recebeEm ?? "")),
    [dados],
  );
  const valorNum = valor ?? 0;

  // Sem aviso (14/10/2026): a folha fecha e o lançamento aparece na lista do negócio.
  function pronto() {
    onFechar();
    router.refresh();
  }

  function salvarVenda() {
    const nome = cliente === "__outro" ? outroNome.trim() || null : cliente;
    iniciar(async () => {
      const r = await vendiAction({ valor: valorNum, forma, cliente: nome, cai: caiDepois ? "data" : "agora", data: caiDepois ? dataDeCair : null });
      if (!r.ok) return showError(r.erro);
      pronto();
    });
  }
  function salvarPagamento() {
    if (!gasto) return;
    iniciar(async () => {
      const r = await pagueiAction({ valor: valorNum, ...gasto });
      if (!r.ok) return showError(r.erro);
      pronto();
    });
  }
  function receber(id: string) {
    iniciar(async () => {
      const r = await recebiAction(id);
      if (!r.ok) return showError(r.erro);
      pronto();
    });
  }

  const campoValor = (rotulo: string) => (
    <label className="mx-auto flex items-baseline justify-center gap-2 border-b border-border-strong px-2 pb-1">
      <span className="text-xl text-ink-muted">{simbolo}</span>
      <CampoDeDinheiro autoFocus valor={valor} onValor={setValor} max={10_000_000} placeholder="0,00" aria-label={rotulo} className="w-44 bg-transparent text-center text-[2.5rem] font-light tabular-nums text-ink outline-none placeholder:text-ink-faint" />
    </label>
  );
  const voltar = (
    <button type="button" onClick={() => setModo(null)} className="-mt-1 mb-2 flex min-h-11 items-center gap-1 text-sm text-ink-muted">
      <ChevronLeft size={16} aria-hidden /> Voltar
    </button>
  );
  const pergunta = (t: string, opc?: boolean) => (
    <p className="mt-5 mb-2 text-sm font-medium text-ink">
      {t} {opc && <small className="font-normal text-ink-faint">opcional</small>}
    </p>
  );

  return (
    <Modal open={aberto} onClose={onFechar} title={`Registrar ${dados.negocio.com.startsWith("o ") ? "no" : "na"} ${dados.negocio.sem}`}>
      {modo === null && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-surface-2 px-4 py-2">
            <LinhaDoRecibo rotulo={`Entrou em ${MESES[dados.mesAtual.mes - 1]}`} valor={m0(R.reciboAtual.entrou)} />
            <LinhaDoRecibo rotulo="Sobrou até hoje" valor={R.reciboAtual.sobrou < 0 ? `−${m0(-R.reciboAtual.sobrou)}` : m0(R.reciboAtual.sobrou)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["vendi", TrendingUp, "Vendi", "entrou agora"],
                ["paguei", TrendingDown, "Paguei", "conta ou compra"],
                ["recebi", Check, "Recebi", "venda a prazo"],
              ] as const
            ).map(([k, Icone, t, s], i) => (
              <button key={k} type="button" onClick={() => setModo(k)} className={`flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-3xl border px-2 py-4 text-center ${i === 0 ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}>
                <span className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border)]">
                  <Icone size={20} strokeWidth={1.6} aria-hidden />
                </span>
                <b className="text-[16px] font-medium text-ink">{t}</b>
                <small className="text-xs leading-tight text-ink-muted">{s}</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onFechar();
              window.dispatchEvent(new Event(EVENTO_IMPORTAR));
            }}
            className="flex min-h-16 items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="flex -space-x-2">
              <LogoDoLancamento descricao="mercado pago" icon={FileUp} size={36} />
              <LogoDoLancamento descricao="nubank" icon={FileUp} size={36} />
              <LogoDoLancamento descricao="pix" icon={FileUp} size={36} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-medium text-ink">Importar extrato PJ</b>
              <small className="text-xs text-ink-muted">o SPI separa vendas e contas</small>
            </span>
            <ChevronRight size={18} className="text-ink-muted" aria-hidden />
          </button>
        </div>
      )}

      {modo === "vendi" && (
        <div className="flex flex-col">
          {voltar}
          {campoValor("Valor da venda")}
          {pergunta("Como pagou?")}
          <div className="flex flex-wrap gap-2">
            {[...formasDela, ...FORMAS.filter((f) => !formasDela.includes(f))].map((f) => (
              <Chip key={f} on={forma === f} onClick={() => { setForma(f); setDepois(null); setData(""); }}>
                {NOME_DA_FORMA[f]}
              </Chip>
            ))}
          </div>
          {pergunta("De quem?", true)}
          <div className="flex flex-wrap gap-2">
            {clientes.map((c) => (
              <Chip key={c} on={cliente === c} onClick={() => setCliente(cliente === c ? null : c)}>
                {c}
              </Chip>
            ))}
            <Chip on={cliente === "__outro"} onClick={() => setCliente(cliente === "__outro" ? null : "__outro")}>
              {clientes.length ? "Outro nome" : "Escrever o nome"}
            </Chip>
          </div>
          {cliente === "__outro" && (
            <input value={outroNome} onChange={(e) => setOutroNome(e.target.value.slice(0, 80))} placeholder="Nome do cliente" aria-label="Nome do cliente" className="mt-2 min-h-12 rounded-2xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-accent" />
          )}
          {pergunta("O dinheiro", true)}
          <div className="flex flex-wrap gap-2">
            <Chip on={!caiDepois} onClick={() => setDepois(false)}>
              Já caiu
            </Chip>
            <Chip on={caiDepois} onClick={() => setDepois(true)}>
              Cai depois
            </Chip>
          </div>
          {caiDepois && (
            <label className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4">
              <span className="text-[15px] text-ink">Cai em</span>
              <input type="date" value={dataDeCair} min={somarDias(dados.hoje, 1)} onChange={(e) => setData(e.target.value)} aria-label="Dia em que o dinheiro cai" className="bg-transparent text-[15px] text-ink outline-none" />
            </label>
          )}
          <div className="mt-6">
            <button type="button" className={BOTAO_PRINCIPAL} disabled={salvando || valorNum <= 0} onClick={salvarVenda}>
              {salvando ? "Registrando..." : "Registrar venda"}
            </button>
          </div>
        </div>
      )}

      {modo === "paguei" && (
        <div className="flex flex-col">
          {voltar}
          <p className="mb-2 text-sm font-medium text-ink">O que você pagou?</p>
          <div className="flex flex-wrap gap-2">
            {contasAbertas.map((c) => (
              <Chip
                key={c.id}
                on={gasto?.contaId === c.id}
                onClick={() => {
                  setGasto({ contaId: c.id, contaNome: c.nome });
                  if (c.valor !== null) setValor(c.valor);
                }}
              >
                {c.nome}
              </Chip>
            ))}
            {GASTOS.map(([k, t]) => (
              <Chip key={k} on={gasto?.tipo === k} onClick={() => setGasto({ tipo: k })}>
                {t}
              </Chip>
            ))}
          </div>
          <div className="mt-6">{campoValor("Valor pago")}</div>
          <div className="mt-6">
            <button type="button" className={BOTAO_PRINCIPAL} disabled={salvando || valorNum <= 0 || !gasto} onClick={salvarPagamento}>
              {salvando ? "Registrando..." : "Registrar"}
            </button>
          </div>
        </div>
      )}

      {modo === "recebi" && (
        <div className="flex flex-col gap-2">
          {voltar}
          <p className="text-sm font-medium text-ink">Quem pagou?</p>
          {aReceber.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">Ninguém deve nada agora.</p>
          ) : (
            aReceber.slice(0, 8).map((v) => {
              const nome = v.cliente || v.description || "Venda";
              const atrasada = (v.recebeEm ?? "") < dados.hoje;
              return (
                <button key={v.id} type="button" disabled={salvando} onClick={() => receber(v.id)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 text-left disabled:opacity-60">
                  <Iniciais nome={nome} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] font-medium text-ink">{nome}</b>
                    <small className={`text-xs ${atrasada ? "text-danger" : "text-ink-muted"}`}>
                      {m0(v.amount)} · {atrasada ? "atrasada" : `cai ${Number(v.recebeEm!.slice(8))}/${v.recebeEm!.slice(5, 7)}`}
                    </small>
                  </span>
                  <ChevronRight size={18} className="text-ink-muted" aria-hidden />
                </button>
              );
            })
          )}
        </div>
      )}
    </Modal>
  );
}
