"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronLeft, CreditCard, FileText, Minus, Plus, Search, Banknote } from "lucide-react";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { useToast } from "@/components/ui/toast-context";
import { Explica } from "@/components/ui/Explica";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { PRAZOS_DO_CREDITO, RAMOS, ramoDe, type Forma, type Ramo, type TipoDeEmpresa } from "@/lib/empresa/config";
import { ehGuiaDoMei, ehVenda, mesAntes, salarioSeguro, lucrosParaOSalario } from "@/lib/empresa/regras";
import { origemDaGuia, textoDaGuia } from "@/lib/empresa/legal";
import { guiaDoMeiDaEmpresa, MESES_CURTOS, MESES } from "@/lib/empresa/resumo";
import type { DadosDaEmpresa } from "@/lib/empresa/dados";
import { abrirNegocioAction } from "./actions";
import { BOTAO_PRINCIPAL, BOTAO_SECUNDARIO, CARTAO } from "./partes";

type Jeito = { chave: "maquininha" | "pix" | "boleto" | "dinheiro"; nome: string; sub: string; pct: number | null; logo: string | null; formas: Forma[] };

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAQUININHA = /\b(maquininha|stone|cielo|getnet|pagseguro|pag seguro|sumup|infinitepay|mercado ?pago|ton|rede)\b/;

/** Os jeitos de receber que dá para achar nas vendas dos últimos meses (pela descrição do extrato). */
function jeitosDoExtrato(dados: DadosDaEmpresa): Jeito[] {
  const desde = mesAntes(dados.mesAtual, 3);
  const soma = { maquininha: 0, pix: 0, boleto: 0 };
  let total = 0;
  let marca: string | null = null;
  let clienteDoBoleto: string | null = null;
  for (const l of dados.lancamentos) {
    if (!ehVenda(l) || l.year * 12 + l.month < desde.ano * 12 + desde.mes) continue;
    total += l.amount;
    const d = semAcento(l.description ?? "");
    if (MAQUININHA.test(d) || l.forma === "credito" || l.forma === "debito") {
      soma.maquininha += l.amount;
      marca ??= marcaDaDescricao(l.description)?.nome ?? null;
    } else if (/\bpix\b/.test(d) || l.forma === "pix") soma.pix += l.amount;
    else if (/\bboleto\b/.test(d) || l.forma === "boleto") {
      soma.boleto += l.amount;
      clienteDoBoleto ??= l.cliente ?? null;
    }
  }
  const achado = soma.maquininha + soma.pix + soma.boleto;
  const pct = (v: number) => (achado > 0 && total > 0 ? Math.round((v / total) * 100) : null);
  const jeitos: Jeito[] = [
    { chave: "maquininha", nome: "Maquininha", sub: marca ?? "crédito e débito", pct: pct(soma.maquininha), logo: marca, formas: ["credito", "debito"] },
    { chave: "pix", nome: "Pix", sub: "cai na hora", pct: pct(soma.pix), logo: "pix", formas: ["pix"] },
    { chave: "boleto", nome: "Boleto", sub: clienteDoBoleto ?? "a prazo", pct: pct(soma.boleto), logo: null, formas: ["boleto"] },
  ];
  return achado > 0 ? jeitos.filter((j) => (j.pct ?? 0) > 0) : [...jeitos, { chave: "dinheiro", nome: "Dinheiro", sub: "no balcão", pct: null, logo: null, formas: ["dinheiro"] }];
}

/**
 * O assistente de entrada da Empresa: 5 telas, uma pergunta por vez (protótipo aprovado). O que dá
 * para achar no extrato vem marcado "Achei no seu extrato"; o que não dá, ela escolhe. Termina no
 * cartão de abertura e grava tudo de uma vez em "Abrir meu negócio".
 */
export function Assistente({ dados }: { dados: DadosDaEmpresa }) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m0 = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showError } = useToast();
  const [salvando, iniciar] = useTransition();
  const atual = dados.config;

  const [passo, setPasso] = useState(1);
  const [faz, setFaz] = useState<Ramo | null>(atual?.faz ?? null);
  const [tipo, setTipo] = useState<TipoDeEmpresa | null>(atual?.tipo ?? null);
  const [naoSou, setNaoSou] = useState(false);
  const [lembrete, setLembrete] = useState(atual?.lembreteDas ?? true);
  const [prazo, setPrazo] = useState(atual?.prazoCredito ?? 30);
  const jeitos = useMemo(() => jeitosDoExtrato(dados), [dados]);
  const acheiJeitos = jeitos.some((j) => j.pct !== null);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(acheiJeitos ? jeitos.map((j) => j.chave) : []));

  // A guia achada no extrato (a mais recente) ou a da tabela legal.
  const guiaAchada = dados.lancamentos.find((l) => ehGuiaDoMei(l)) ?? null;
  // A mesma fonte única do resto da Empresa (o que ela digitou, a última paga ou a estimativa).
  const guiaUsada = guiaDoMeiDaEmpresa({ config: { tipo: "MEI", atividadeMei: atual?.atividadeMei ?? "servico", dasDigitado: atual?.dasDigitado ?? null }, legal: dados.legal, lancamentos: dados.lancamentos });
  const valorDaGuia = guiaUsada?.valor ?? null;
  const ajudaDaGuia = textoDaGuia(dados.legal, atual?.atividadeMei ?? "servico", guiaUsada);

  // O salário: o lucro do último mês fechado e o seguro (média do lucro de 12 meses, menos 10%).
  const { lucros } = lucrosParaOSalario(dados.lancamentos, dados.mesAtual);
  const seguro = salarioSeguro(lucros);
  const lucro = lucros.length ? Math.max(0, Math.round(lucros[lucros.length - 1])) : null;
  const maximo = lucro !== null ? Math.max(50, Math.floor(lucro / 50) * 50) : 0;
  const [salario, setSalario] = useState<number | null>(atual?.salario ?? seguro);

  const ramo = ramoDe(faz);
  const titulo = (a: string, b: string) => (
    <h1 className="titulo-tema px-1 text-[1.85rem] font-medium leading-tight text-ink">
      {a} <em className="not-italic text-accent-strong">{b}</em>
    </h1>
  );
  const achei = (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
      <Search size={13} strokeWidth={2} aria-hidden /> Achei no seu extrato
    </span>
  );

  function abrir() {
    if (!tipo) return;
    const formas = jeitos.filter((j) => marcados.has(j.chave)).flatMap((j) => j.formas);
    iniciar(async () => {
      const r = await abrirNegocioAction({ tipo, faz: faz ?? "outro", formas, prazoCredito: prazo, salario: salario ?? null, lembreteDas: lembrete });
      if (!r.ok) return showError(r.erro);
      // Sem aviso: a tela que abre já é a do negócio.
      router.replace("/empresa");
      router.refresh();
    });
  }

  const passos = (
    <div className="flex gap-1.5 px-1" aria-label={`Passo ${passo} de 5`}>
      {[1, 2, 3, 4, 5].map((k) => (
        <i key={k} className={`h-1 flex-1 rounded-full ${k <= passo ? "bg-accent" : "bg-border-strong"}`} />
      ))}
    </div>
  );
  const topo = passo > 1 ? (
    <button type="button" onClick={() => (naoSou && passo === 2 ? setNaoSou(false) : setPasso(passo - 1))} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm text-ink-muted">
      <ChevronLeft size={18} strokeWidth={1.8} aria-hidden /> Voltar
    </button>
  ) : (
    <p className="px-1 pt-2 text-sm text-ink-muted">Meu negócio</p>
  );

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      {topo}
      {passos}

      {passo === 1 && (
        <>
          {titulo("O que", "você faz?")}
          <div className="grid grid-cols-2 gap-2.5">
            {RAMOS.map((r) => {
              const on = faz === r.chave;
              return (
                <button key={r.chave} type="button" onClick={() => setFaz(r.chave)} aria-pressed={on} className={`relative aspect-[4/5] overflow-hidden rounded-3xl bg-surface-2 text-left ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-canvas" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto pequena do próprio app, em public/ */}
                  <img src={r.foto} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-3 pt-10 text-[15px] font-medium text-white">{r.nome}</span>
                  {on && (
                    <span className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check size={15} strokeWidth={2.2} aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setFaz("outro")} aria-pressed={faz === "outro"} className={`mx-auto min-h-11 px-3 text-sm underline underline-offset-4 ${faz === "outro" ? "font-medium text-ink" : "text-ink-muted"}`}>
            {faz === "outro" ? "Outro tipo de negócio, escolhido" : "Outro tipo de negócio"}
          </button>
          <div className="mt-auto">
            <button type="button" className={BOTAO_PRINCIPAL} disabled={!faz} onClick={() => setPasso(2)}>
              Continuar
            </button>
          </div>
        </>
      )}

      {passo === 2 && !naoSou && (
        <>
          {guiaAchada && achei}
          {titulo("Você é", "MEI?")}
          {valorDaGuia !== null && (
            <div className={`${CARTAO} flex flex-col gap-2 p-4`}>
              <div className="flex items-center gap-3">
                <LogoDoLancamento descricao={null} icon={FileText} size={40} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-medium text-ink">Guia do MEI</b>
                  {guiaUsada?.origem === "paga" && guiaAchada?.entryDate ? (
                    <small className="text-xs text-ink-muted">paga em {Number(guiaAchada.entryDate.slice(8))} de {MESES[Number(guiaAchada.entryDate.slice(5, 7)) - 1]}</small>
                  ) : guiaUsada ? (
                    <small className="text-xs text-ink-muted">{origemDaGuia(guiaUsada)}</small>
                  ) : null}
                </span>
                {ajudaDaGuia && <Explica rotulo="De onde vem esse valor?">{ajudaDaGuia}</Explica>}
              </div>
              <ValorDestaque texto={money(valorDaGuia)} />
              <span className="h-9 rounded-md bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_2px,transparent_2px_4px,var(--color-ink)_4px_5px,transparent_5px_8px)] opacity-80" aria-hidden />
            </div>
          )}
          {dados.legal.diaDoDas && (
            <div className={`${CARTAO} flex items-center gap-3 p-4`}>
              <LogoDoLancamento descricao={null} icon={Bell} size={40} />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-medium text-ink">Lembrete da guia</b>
                <small className="text-xs text-ink-muted">na véspera e no dia {dados.legal.diaDoDas.valor}</small>
              </span>
              <Interruptor ligado={lembrete} onTrocar={() => setLembrete((v) => !v)} rotulo="Lembrete da guia" />
            </div>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <button type="button" className={BOTAO_PRINCIPAL} onClick={() => { setTipo("MEI"); setPasso(3); }}>
              Sim, sou MEI
            </button>
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setNaoSou(true)}>
              Não sou
            </button>
          </div>
        </>
      )}

      {passo === 2 && naoSou && (
        <>
          {titulo("Sua empresa", "é...")}
          <div className={`${CARTAO} divide-y divide-border px-4`}>
            {([["AUTONOMA", "Autônoma", "trabalho por conta própria"], ["ME", "ME", "microempresa no Simples"]] as const).map(([k, nome, sub]) => (
              <button key={k} type="button" onClick={() => { setTipo(k); setPasso(3); }} className="flex min-h-16 w-full items-center gap-3 text-left">
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-medium text-ink">{nome}</b>
                  <small className="text-xs text-ink-muted">{sub}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {passo === 3 && (
        <>
          {acheiJeitos && achei}
          {titulo("Seus clientes", "pagam assim")}
          <div className={`${CARTAO} flex flex-col px-4`}>
            {jeitos.map((j) => {
              const on = marcados.has(j.chave);
              const Icone = j.chave === "boleto" ? FileText : j.chave === "dinheiro" ? Banknote : CreditCard;
              return (
                <button
                  key={j.chave}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMarcados((s) => { const n = new Set(s); if (n.has(j.chave)) n.delete(j.chave); else n.add(j.chave); return n; })}
                  className="flex min-h-16 w-full items-center gap-3 border-b border-border text-left"
                >
                  <LogoDoLancamento descricao={j.logo} icon={Icone} size={40} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-medium text-ink">{j.nome}</b>
                    <small className="block truncate text-xs text-ink-muted">{j.sub}</small>
                  </span>
                  {j.pct !== null && <em className="text-[15px] not-italic tabular-nums text-ink">{j.pct}%</em>}
                  <span className={`flex size-7 items-center justify-center rounded-lg ${on ? "bg-ink text-canvas" : "border border-border-strong text-transparent"}`} aria-hidden>
                    <Check size={15} strokeWidth={2.2} />
                  </span>
                </button>
              );
            })}
            {marcados.has("maquininha") && (
              <div className="flex min-h-16 items-center justify-between gap-3">
                <b className="text-[15px] font-medium text-ink">Crédito cai em</b>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label="Menos dias" onClick={() => setPrazo(PRAZOS_DO_CREDITO[Math.max(0, PRAZOS_DO_CREDITO.indexOf(prazo as (typeof PRAZOS_DO_CREDITO)[number]) - 1)])} className="flex size-10 items-center justify-center rounded-full border border-border text-ink">
                    <Minus size={16} aria-hidden />
                  </button>
                  <b className="min-w-16 text-center text-[15px] font-medium tabular-nums text-ink">{prazo === 0 ? "na hora" : `${prazo} ${prazo === 1 ? "dia" : "dias"}`}</b>
                  <button type="button" aria-label="Mais dias" onClick={() => setPrazo(PRAZOS_DO_CREDITO[Math.min(PRAZOS_DO_CREDITO.length - 1, PRAZOS_DO_CREDITO.indexOf(prazo as (typeof PRAZOS_DO_CREDITO)[number]) + 1)])} className="flex size-10 items-center justify-center rounded-full border border-border text-ink">
                    <Plus size={16} aria-hidden />
                  </button>
                </span>
              </div>
            )}
          </div>
          <div className="mt-auto">
            <button type="button" className={BOTAO_PRINCIPAL} disabled={marcados.size === 0} onClick={() => setPasso(4)}>
              Está certo
            </button>
          </div>
        </>
      )}

      {passo === 4 && (
        <>
          {titulo("Quanto vai", "para você?")}
          <div className={`${CARTAO} flex flex-col items-center gap-1 p-5 text-center`}>
            {lucro !== null ? (
              <>
                <div className="self-end">
                  <Explica rotulo="Como sei o seguro?">
                    {`${dados.nome} lucrou ${m0(lucro)} no último mês fechado. Seguro é a média do lucro${lucros.length > 1 ? ` de ${lucros.length} meses` : ""}, menos 10% para o caixa.`}
                  </Explica>
                </div>
                <ValorDestaque texto={m0(salario ?? 0)} />
                <small className="text-sm text-ink-muted">seu salário por mês</small>
                <div className="relative mt-6 w-full">
                  {seguro !== null && seguro > 0 && (
                    <span className="absolute -top-5 -translate-x-1/2 text-xs font-semibold uppercase tracking-wider text-success" style={{ left: `${Math.min(100, (seguro / maximo) * 100)}%` }}>
                      seguro
                    </span>
                  )}
                  <input type="range" min={0} max={maximo} step={50} value={Math.min(salario ?? 0, maximo)} onChange={(e) => setSalario(Number(e.target.value))} aria-label="Seu salário por mês" aria-valuetext={m0(salario ?? 0)} className="w-full accent-[var(--color-accent)]" />
                </div>
                <div className="mt-2 flex w-full justify-between text-left">
                  <span>
                    <small className="block text-xs text-ink-muted">Para você</small>
                    <b className="text-[15px] font-medium tabular-nums text-ink">{m0(salario ?? 0)}</b>
                  </span>
                  <span className="text-right">
                    <small className="block text-xs text-ink-muted">Fica {dados.negocio.com.startsWith("o ") ? "no" : "na"} {dados.negocio.sem}</small>
                    <b className="text-[15px] font-medium tabular-nums text-ink">{m0(Math.max(0, lucro - (salario ?? 0)))}</b>
                  </span>
                </div>
                {seguro !== null && (salario ?? 0) > seguro && <p className="mt-3 text-sm text-[var(--color-atencao)]">Acima do seguro: aperta o caixa.</p>}
              </>
            ) : (
              <>
                <label className="flex w-full flex-col gap-2 text-left">
                  <span className="text-sm text-ink-muted">Quanto você quer tirar por mês?</span>
                  <span className="flex items-baseline gap-2 border-b border-border-strong pb-2">
                    <span className="text-lg text-ink-muted">{simbolo}</span>
                    <CampoDeDinheiro valor={salario} onValor={setSalario} max={9_999_999} placeholder="0,00" className="w-full bg-transparent text-3xl font-light tabular-nums text-ink outline-none" aria-label="Seu salário por mês, em reais" />
                  </span>
                </label>
                <p className="mt-2 text-left text-xs text-ink-muted">O salário seguro aparece depois do primeiro mês fechado.</p>
              </>
            )}
          </div>
          <div className="mt-auto">
            <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setPasso(5)}>
              Combinado
            </button>
          </div>
        </>
      )}

      {passo === 5 && (
        <>
          <div className={`${CARTAO} relative overflow-hidden`}>
            <div className="relative h-36 bg-surface-2">
              {ramo && (
                // eslint-disable-next-line @next/next/no-img-element -- foto pequena do próprio app, em public/
                <img src={ramo.foto} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
              )}
              <span className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                Aberto em {MESES_CURTOS[dados.mesAtual.mes - 1]} {dados.mesAtual.ano}
              </span>
            </div>
            <div className="flex items-end gap-3 px-4 pt-4">
              <span className="min-w-0">
                <b className="titulo-tema block truncate text-xl font-medium text-ink">{dados.nome.split(" ")[0]}</b>
                <small className="text-xs text-ink-muted">empresa</small>
              </span>
              <span className="mb-3 flex-1 border-b border-dotted border-border-strong" aria-hidden />
              <span className="min-w-0 text-right">
                <b className="titulo-tema block truncate text-xl font-medium text-ink">{dados.primeiroNome}</b>
                <small className="text-xs text-ink-muted">pessoal</small>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 py-4">
              {[["Tipo", tipo === "MEI" ? "MEI" : tipo === "ME" ? "ME" : "Autônoma"], ["Faz", ramo?.curto ?? "Outro"], ["Recebe", `${marcados.size} ${marcados.size === 1 ? "jeito" : "jeitos"}`]].map(([k, v]) => (
                <span key={k}>
                  <small className="block text-xs font-semibold uppercase tracking-wider text-ink-faint">{k}</small>
                  <b className="text-[15px] font-medium text-ink">{v}</b>
                </span>
              ))}
            </div>
            <div className="border-t border-dashed border-border-strong px-4 py-4">
              <div className="flex items-end justify-between gap-3">
                <span>
                  <small className="block text-xs text-ink-muted">Seu salário</small>
                  <ValorDestaque texto={m0(salario ?? 0)} />
                </span>
                <small className="text-right text-xs leading-snug text-ink-muted">
                  todo dia {atual?.diaDoSalario ?? 5}
                  <br />
                  {`d${dados.negocio.com.startsWith("o ") ? "o" : "a"} ${dados.negocio.sem} para você`}
                </small>
              </div>
            </div>
          </div>
          <div className="mt-auto">
            <button type="button" className={BOTAO_PRINCIPAL} disabled={salvando || !tipo} onClick={abrir}>
              {salvando ? "Abrindo..." : "Abrir meu negócio"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Interruptor({ ligado, onTrocar, rotulo }: { ligado: boolean; onTrocar: () => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={onTrocar} className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${ligado ? "bg-accent" : "bg-border-strong"}`}>
      <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${ligado ? "left-[24px]" : "left-1"}`} />
    </button>
  );
}
