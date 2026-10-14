"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check, ChevronLeft, ChevronRight, Copy, CreditCard, Crown, DoorOpen, Download, FileSpreadsheet, FileText, FileX, FlaskConical, KeyRound, MoreHorizontal, Palette, RotateCcw, Shuffle, Smartphone, Sprout, Trash2, Undo2, UserRound, type LucideIcon,
} from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { PasswordField } from "@/components/ui/PasswordField";
import { alternarParte, PALAVRA_DE_CONFIRMACAO, temSaidaMenor, type MotivoDaLimpeza, type Parte, type RespostaDoMotivo } from "@/lib/limpar-dados/regras";
import { copiaAntesDeLimparAction, desfazerUltimaImportacaoAction, limparDadosAction, registrarMotivoDaLimpezaAction } from "../dados/limpar-dados-actions";
import { ImportarExtrato } from "../_ajustes/Interativos";
import { deleteAccountAction, type DeleteAccountState } from "../dados/delete-account-actions";
import { PARTE_NA_TELA } from "./partes-da-tela";
import { SegureParaConfirmar } from "./SegureParaConfirmar";

/**
 * Configurações › Apagar dados ou conta (proposta A aprovada pela Dani em 12/10/2026, com duas
 * peças da B: a tela final que marca cada parte limpa e o "Quer só recomeçar?" dentro do apagar).
 *
 * A tela já é a escolha: um cartão grande e claro para limpar e recomeçar (a conta fica) e um
 * menor e sóbrio para apagar a conta. Uma coisa por vez, pouco texto, sem vermelho no limpar.
 *
 * Limpar: por que (um toque, ou Pular) → o que sai e o que fica → o que sai e de qual perfil →
 * cópia (opcional) → segurar para confirmar → pronto. Apagar conta: o que acontece (com a linha da
 * Apple) → senha.
 *
 * O "por que" (13/10/2026): 7 de 9 pessoas que limparam no primeiro dia importaram tudo de novo.
 * Para "Importei errado" e "Apareceu repetido", antes de seguir, a saída menor: desfazer só a
 * última importação. Um toque, ao lado do "Não, quero limpar", sem empurrar.
 */

type Tela = "inicio" | "motivo" | "saida" | "sai-fica" | "partes" | "copia" | "confirmar" | "pronto" | "conta" | "senha";
type PerfilDaTela = { id: string; nome: string };
type Copia = "nao" | "baixando" | "ok" | "erro";
export type UltimaImportacao = { id: string; fatura: boolean; arquivo: string | null; em: string; lancamentos: number };

const PASSOS_DO_LIMPAR: Partial<Record<Tela, number>> = { motivo: 1, saida: 1, "sai-fica": 2, partes: 3, copia: 4, confirmar: 5 };
const VOLTAR_PARA: Partial<Record<Tela, Tela>> = { motivo: "inicio", saida: "motivo", "sai-fica": "motivo", partes: "sai-fica", copia: "partes", confirmar: "copia", conta: "inicio", senha: "conta" };

const MOTIVOS: { motivo: MotivoDaLimpeza; rotulo: string; Icone: LucideIcon }[] = [
  { motivo: "importei_errado", rotulo: "Importei errado", Icone: FileX },
  { motivo: "repetido", rotulo: "Apareceu repetido", Icone: Copy },
  { motivo: "categorias", rotulo: "Categorias bagunçadas", Icone: Shuffle },
  { motivo: "testar", rotulo: "Quero testar do zero", Icone: FlaskConical },
  { motivo: "outro", rotulo: "Outro", Icone: MoreHorizontal },
];
const PASSOS_DA_CONTA: Partial<Record<Tela, number>> = { conta: 1, senha: 2 };

function baixar(nome: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ApagarDadosOuConta({
  avisoDaApple,
  perfis,
  perfilAtual,
  partesVisiveis,
  ultimaImportacao = null,
}: {
  avisoDaApple: boolean;
  perfis: PerfilDaTela[];
  perfilAtual: string;
  partesVisiveis: Parte[];
  ultimaImportacao?: UltimaImportacao | null;
}) {
  const { titulos: t } = useProfileTheme().voz;
  const [tela, setTela] = useState<Tela>("inicio");
  const [partes, setPartes] = useState<Parte[]>(partesVisiveis);
  const [perfil, setPerfil] = useState<string>(perfilAtual);
  const [copia, setCopia] = useState<Copia>("nao");
  const [avisoDeDependencia, setAvisoDeDependencia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [limpando, startLimpar] = useTransition();
  const [feito, setFeito] = useState<{ partes: Parte[]; recomecar: boolean } | null>(null);
  const [motivo, setMotivo] = useState<RespostaDoMotivo | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeira = useRef(true);

  // Cada tela nova começa do topo, e o leitor de tela ouve o título dela.
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    titulo.current?.focus();
  }, [tela]);

  const ir = (proxima: Tela) => {
    setErro(null);
    if (proxima === "inicio") setCopia("nao");
    setTela(proxima);
  };

  /** Um toque: grava a resposta (uma vez só, em segundo plano) e segue. */
  function responder(r: RespostaDoMotivo) {
    if (motivo === null) void registrarMotivoDaLimpezaAction(r).catch(() => undefined);
    setMotivo(r);
    ir(temSaidaMenor(r) && ultimaImportacao ? "saida" : "sai-fica");
  }

  async function baixarCopia() {
    setCopia("baixando");
    try {
      const { lancamentos, carteira } = await copiaAntesDeLimparAction();
      baixar("lancamentos", lancamentos);
      // Dois arquivos: o segundo espera um instante, senão alguns navegadores barram.
      setTimeout(() => baixar("carteira", carteira), 400);
      setCopia("ok");
    } catch {
      setCopia("erro");
    }
  }

  function alternar(p: Parte) {
    const novas = alternarParte(partes, p);
    const puxou = novas.filter((x) => x !== p && !partes.includes(x));
    const tirou = partes.filter((x) => x !== p && !novas.includes(x));
    const nomes = (l: Parte[]) => l.map((x) => PARTE_NA_TELA[x].curto).join(" e ");
    if (puxou.length > 0) setAvisoDeDependencia(`Também marquei ${nomes(puxou)}.`);
    else if (tirou.length > 0) setAvisoDeDependencia(`Também desmarquei ${nomes(tirou)}.`);
    else setAvisoDeDependencia("");
    setPartes(novas);
  }

  function limpar() {
    setErro(null);
    startLimpar(async () => {
      const r = await limparDadosAction({
        escopo: perfil === "todos" ? "todos" : "perfil",
        perfilId: perfil === "todos" ? undefined : perfil,
        partes,
        confirmacao: PALAVRA_DE_CONFIRMACAO,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setFeito({ partes: r.partes.filter((p) => partesVisiveis.includes(p)), recomecar: r.recomecar });
      setTela("pronto");
    });
  }

  const todas = partesVisiveis.every((p) => partes.includes(p));
  const nomeDoPerfil = perfil === "todos" ? null : (perfis.find((p) => p.id === perfil)?.nome ?? null);
  const passo = PASSOS_DO_LIMPAR[tela] ?? PASSOS_DA_CONTA[tela];
  const cuidado = tela in PASSOS_DA_CONTA;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {passo !== undefined && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => ir(VOLTAR_PARA[tela] ?? "inicio")}
            aria-label="Voltar"
            className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-2"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
          <Pontos atual={passo} total={cuidado ? 2 : 5} cuidado={cuidado} />
          <span className="size-11" aria-hidden />
        </div>
      )}

      {tela === "inicio" && (
        <>
          <h1 ref={titulo} tabIndex={-1} className="titulo-tema text-2xl font-medium text-ink outline-none">
            Apagar dados ou conta
          </h1>
          <button
            type="button"
            onClick={() => ir("motivo")}
            className="flex min-h-[188px] flex-col justify-between gap-4 rounded-[26px] border p-5 text-left transition-transform active:scale-[0.985]"
            style={{
              background: "var(--heroi-fundo, linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para)))",
              color: "var(--color-heroi-tinta)",
              borderColor: "var(--color-heroi-borda, transparent)",
              boxShadow: "var(--cartao-fio, none)",
            }}
          >
            <span className="flex items-center gap-3">
              <span className="heroi-veu flex size-14 shrink-0 items-center justify-center rounded-[20px]">
                <RotateCcw size={28} strokeWidth={1.7} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[20px] font-semibold leading-tight">Limpar e recomeçar</b>
                <small className="mt-0.5 block text-sm text-heroi-suave">A conta fica. Os dados saem.</small>
              </span>
              <ChevronRight size={20} className="shrink-0 opacity-60" aria-hidden />
            </span>
            <span className="flex flex-wrap gap-1.5">
              {["Login", "Assinatura", "Tema"].map((x) => (
                <span key={x} className="heroi-veu inline-flex items-center gap-1 rounded-full py-1 pl-2 pr-2.5 text-[12.5px] font-semibold">
                  <Check size={14} strokeWidth={2.4} aria-hidden />
                  {x}
                </span>
              ))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => ir("conta")}
            className="flex min-h-[76px] items-center gap-3 rounded-[22px] bg-surface p-4 text-left shadow-[inset_0_0_0_1px_var(--color-border)] transition-transform active:scale-[0.985]"
          >
            <span className="flex size-[46px] shrink-0 items-center justify-center rounded-2xl bg-danger-soft text-danger">
              <DoorOpen size={22} strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[17px] font-semibold leading-tight text-ink">Apagar minha conta</b>
              <small className="mt-0.5 block text-sm text-ink-muted">Tudo sai, sem volta.</small>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
          </button>

          <BotaoDeTexto onClick={baixarCopia} disabled={copia === "baixando"}>
            <Download size={16} aria-hidden />
            {copia === "baixando" ? "Baixando..." : copia === "ok" ? "Cópia baixada" : "Baixar uma cópia dos meus dados"}
          </BotaoDeTexto>
          {copia === "erro" && <Erro>Não consegui baixar a cópia. Tente de novo.</Erro>}
        </>
      )}

      {tela === "motivo" && (
        <>
          <Titulo refTitulo={titulo}>Por que está limpando?</Titulo>
          <div role="group" aria-label="Por que está limpando" className="flex flex-col gap-2">
            {MOTIVOS.map(({ motivo: m, rotulo, Icone }) => (
              <button
                key={m}
                type="button"
                onClick={() => responder(m)}
                className="flex min-h-[58px] w-full items-center gap-3 rounded-[20px] bg-surface px-4 py-2.5 text-left shadow-[inset_0_0_0_1px_var(--color-border)] transition-transform active:scale-[0.985]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icone size={19} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-[15.5px] font-semibold leading-snug text-ink">{rotulo}</span>
                <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
              </button>
            ))}
          </div>
          <BotaoDeTexto onClick={() => responder("pulou")}>Pular</BotaoDeTexto>
        </>
      )}

      {tela === "saida" && ultimaImportacao && (
        <SaidaMenor
          refTitulo={titulo}
          lote={ultimaImportacao}
          repetido={motivo === "repetido"}
          aoSeguir={() => ir("sai-fica")}
        />
      )}

      {tela === "sai-fica" && (
        <>
          <Titulo refTitulo={titulo}>O que sai e o que fica</Titulo>
          <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2">
            <Lado titulo="Pode sair" cor="accent" Icone={Trash2}>
              {partesVisiveis.map((p) => {
                const { curto, Icone } = PARTE_NA_TELA[p];
                return <ItemDoLado key={p} Icone={Icone} riscado>{curto}</ItemDoLado>;
              })}
            </Lado>
            <Lado titulo="Fica" cor="success" Icone={Check}>
              <ItemDoLado Icone={KeyRound}>Login</ItemDoLado>
              <ItemDoLado Icone={Crown}>Assinatura</ItemDoLado>
              <ItemDoLado Icone={Palette}>Tema e ajustes</ItemDoLado>
              <ItemDoLado Icone={UserRound}>Nome e foto</ItemDoLado>
            </Lado>
          </div>
          <BotaoPrincipal onClick={() => ir("partes")}>Continuar</BotaoPrincipal>
        </>
      )}

      {tela === "partes" && (
        <>
          <div className="flex items-end justify-between gap-3">
            <Titulo refTitulo={titulo}>O que limpar?</Titulo>
            <button
              type="button"
              onClick={() => {
                setAvisoDeDependencia("");
                setPartes(todas ? [] : partesVisiveis);
              }}
              className="min-h-11 shrink-0 text-sm font-medium text-ink-muted underline underline-offset-4"
            >
              {todas ? "Desmarcar tudo" : "Marcar tudo"}
            </button>
          </div>
          <div role="group" aria-label="O que limpar" className="overflow-hidden rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] [&>*+*]:border-t [&>*+*]:border-border">
            {partesVisiveis.map((p) => {
              const { titulo: nome, sub, Icone } = PARTE_NA_TELA[p];
              const marcada = partes.includes(p);
              return (
                <button key={p} type="button" role="checkbox" aria-checked={marcada} onClick={() => alternar(p)} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${marcada ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-faint"}`}>
                    <Icone size={19} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] font-semibold leading-snug ${marcada ? "text-ink" : "text-ink-muted"}`}>{nome}</span>
                    <small className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{sub}</small>
                  </span>
                  <span
                    aria-hidden
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${marcada ? "[background:var(--botao-fundo,var(--color-ink))] [color:var(--botao-tinta,var(--color-canvas))]" : "shadow-[inset_0_0_0_2px_var(--color-border-strong)]"}`}
                  >
                    {marcada && <Check size={15} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="-mt-2 min-h-5 text-[13px] text-ink-muted">
            {avisoDeDependencia}
          </p>

          {perfis.length > 1 && (
            <div role="group" aria-labelledby="de-qual-perfil" className="-mt-2 flex flex-wrap items-center gap-2">
              <span id="de-qual-perfil" className="mr-1 w-full text-sm text-ink-muted">
                De qual perfil?
              </span>
              {[...perfis, { id: "todos", nome: "Todos" }].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={perfil === p.id}
                  onClick={() => setPerfil(p.id)}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ${perfil === p.id ? "[background:var(--botao-fundo,var(--color-ink))] [color:var(--botao-tinta,var(--color-canvas))]" : "bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          )}
          <BotaoPrincipal onClick={() => ir("copia")} disabled={partes.length === 0}>
            Continuar
          </BotaoPrincipal>
        </>
      )}

      {tela === "copia" && (
        <>
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <Arquivo pronto={copia === "ok"} />
            <Titulo refTitulo={titulo}>{copia === "ok" ? "Cópia guardada" : "Guardar uma cópia antes?"}</Titulo>
            <p className="-mt-1 text-[15px] text-ink-muted">{copia === "ok" ? "Está nos seus arquivos." : "Lançamentos e carteira, em planilha."}</p>
            {copia === "erro" && <Erro>Não consegui baixar a cópia. Tente de novo.</Erro>}
          </div>
          {copia === "ok" ? (
            <BotaoPrincipal onClick={() => ir("confirmar")}>Continuar</BotaoPrincipal>
          ) : (
            <div className="flex flex-col gap-2.5">
              <BotaoPrincipal onClick={baixarCopia} disabled={copia === "baixando"}>
                <Download size={18} aria-hidden />
                {copia === "baixando" ? "Baixando..." : "Baixar cópia"}
              </BotaoPrincipal>
              <BotaoContorno onClick={() => ir("confirmar")}>Seguir sem cópia</BotaoContorno>
            </div>
          )}
        </>
      )}

      {tela === "confirmar" && (
        <>
          <Titulo refTitulo={titulo}>Tudo certo?</Titulo>
          <div className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <LinhaDoResumo Icone={RotateCcw} cor="text-accent">
              Limpar{" "}
              <b className="font-semibold">{todas ? "tudo" : partes.length <= 2 ? partes.map((p) => PARTE_NA_TELA[p].curto).join(" e ") : `${partes.length} partes`}</b>
            </LinhaDoResumo>
            {perfis.length > 1 && (
              <LinhaDoResumo Icone={UserRound} cor="text-accent">
                {nomeDoPerfil ? (
                  <>
                    Perfil <b className="font-semibold">{nomeDoPerfil}</b>
                  </>
                ) : (
                  <>
                    <b className="font-semibold">Todos</b> os perfis
                  </>
                )}
              </LinhaDoResumo>
            )}
            {partes.includes("lancamentos") && (
              <LinhaDoResumo Icone={Sprout} cor="text-accent">
                Depois, volta para o primeiro extrato
              </LinhaDoResumo>
            )}
            <LinhaDoResumo Icone={Check} cor="text-success">
              Conta, assinatura e tema ficam
            </LinhaDoResumo>
            <LinhaDoResumo Icone={copia === "ok" ? Check : Download} cor={copia === "ok" ? "text-success" : "text-ink-muted"}>
              {copia === "ok" ? "Cópia guardada" : "Sem cópia"}
            </LinhaDoResumo>
          </div>
          <p className="text-center text-sm text-ink-muted">Não dá para desfazer.</p>
          {erro && <Erro>{erro}</Erro>}
          <SegureParaConfirmar
            rotulo={limpando ? "Limpando..." : "Segure para limpar"}
            rotuloSemSegurar="Limpar agora, sem segurar"
            aoConfirmar={limpar}
            desabilitado={limpando}
          />
        </>
      )}

      {tela === "pronto" && feito && (
        <Pronto
          refTitulo={titulo}
          partes={feito.partes}
          titulo={todas && feito.partes.length === partesVisiveis.length ? (perfil === "todos" || perfis.length === 1 ? "Pronto, conta zerada" : "Pronto, perfil zerado") : "Pronto, está limpo"}
          frase={todas ? t.cfgLimparProntoTudo : t.cfgLimparProntoParte}
          recomecar={feito.recomecar}
        />
      )}

      {tela === "conta" && (
        <>
          <div className="flex flex-col items-center gap-2.5 pt-1 text-center">
            <span className="flex size-[76px] items-center justify-center rounded-full bg-danger-soft text-danger">
              <DoorOpen size={32} strokeWidth={1.7} aria-hidden />
            </span>
            <Titulo refTitulo={titulo}>Apagar minha conta</Titulo>
            <p className="-mt-1 text-[15px] text-ink-muted">Tudo sai, sem volta.</p>
          </div>
          <div className="overflow-hidden rounded-[20px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] [&>*+*]:border-t [&>*+*]:border-border">
            <LinhaDaConta Icone={ReceiptIcone}>Todos os dados</LinhaDaConta>
            <LinhaDaConta Icone={KeyRound}>Login e senha</LinhaDaConta>
            {/* Exigência da Apple para quem vende assinatura: apagar a conta não cancela a cobrança. */}
            {avisoDaApple && (
              <LinhaDaConta Icone={Smartphone} cuidado>
                Apagar a conta não cancela a assinatura da Apple. Cancele em Ajustes, no seu nome, em Assinaturas.
              </LinhaDaConta>
            )}
          </div>
          <button
            type="button"
            onClick={() => ir("motivo")}
            className="flex min-h-12 items-center gap-2.5 rounded-[18px] bg-accent-soft px-3.5 py-3 text-left text-sm font-medium text-ink"
          >
            <RotateCcw size={20} className="shrink-0 text-accent" aria-hidden />
            <span>
              Quer só recomeçar? <b className="font-bold text-accent">Limpar dados</b>
            </span>
          </button>
          <div className="flex flex-col gap-2.5">
            <BotaoContorno onClick={baixarCopia} disabled={copia === "baixando"}>
              <Download size={18} aria-hidden />
              {copia === "baixando" ? "Baixando..." : copia === "ok" ? "Cópia baixada" : "Baixar cópia antes"}
            </BotaoContorno>
            {copia === "erro" && <Erro>Não consegui baixar a cópia. Tente de novo.</Erro>}
            <BotaoDeCuidado onClick={() => ir("senha")}>Continuar</BotaoDeCuidado>
          </div>
        </>
      )}

      {tela === "senha" && <Senha refTitulo={titulo} aoDesistir={() => ir("inicio")} />}
    </div>
  );
}

/** "Importei errado" ou "Apareceu repetido": desfazer só a última importação, ou seguir limpando. */
function SaidaMenor({
  refTitulo,
  lote,
  repetido,
  aoSeguir,
}: {
  refTitulo: React.RefObject<HTMLHeadingElement | null>;
  lote: UltimaImportacao;
  repetido: boolean;
  aoSeguir: () => void;
}) {
  const [desfazendo, startDesfazer] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [removidos, setRemovidos] = useState<number | null>(null);
  const Icone = lote.fatura ? CreditCard : FileText;
  const nome = lote.arquivo ? lote.arquivo.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() : "";
  const quando = new Date(lote.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

  function desfazer() {
    setErro(null);
    startDesfazer(async () => {
      try {
        const r = await desfazerUltimaImportacaoAction(lote.id);
        if (r.ok) setRemovidos(r.removidos);
        else setErro(r.erro);
      } catch {
        setErro("Não consegui desfazer agora. Nada foi apagado. Tente de novo.");
      }
    });
  }

  if (removidos !== null) {
    return (
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="flex size-[76px] items-center justify-center rounded-full bg-success text-canvas">
          <Check size={34} strokeWidth={2.4} aria-hidden />
        </span>
        <h2 ref={refTitulo} tabIndex={-1} className="titulo-tema text-[24px] font-medium leading-tight text-ink outline-none">
          Importação desfeita
        </h2>
        <p aria-live="polite" className="-mt-1 text-[15px] text-ink-muted">
          {removidos === 1 ? "Saiu 1 lançamento." : `Saíram ${removidos} lançamentos.`} O resto ficou.
        </p>
        <div className="flex w-full flex-col gap-2 pt-1">
          <ImportarExtrato fatura={lote.fatura} />
          <Link href="/inicio" className={CLASSE_TEXTO}>
            Ir para o início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <Titulo refTitulo={refTitulo}>{repetido ? "Repetiu na última importação?" : "Desfazer só a última importação?"}</Titulo>
        <p className="text-[15px] text-ink-muted">Sai só o que veio dela. O resto fica.</p>
      </div>
      <div className="flex items-center gap-3 rounded-[22px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icone size={22} strokeWidth={1.8} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block break-words text-[16px] font-semibold capitalize leading-snug text-ink">{nome || (lote.fatura ? "Fatura" : "Extrato")}</b>
          <small className="mt-0.5 block text-[13.5px] text-ink-muted">
            {quando} · {lote.lancamentos === 1 ? "1 lançamento" : `${lote.lancamentos} lançamentos`}
          </small>
        </span>
      </div>
      {erro && <Erro>{erro}</Erro>}
      <div className="flex flex-col gap-2.5">
        <BotaoPrincipal onClick={desfazer} disabled={desfazendo}>
          <Undo2 size={18} aria-hidden />
          {desfazendo ? "Desfazendo..." : "Desfazer esta importação"}
        </BotaoPrincipal>
        <BotaoContorno onClick={aoSeguir} disabled={desfazendo}>
          Não, quero limpar
        </BotaoContorno>
      </div>
    </>
  );
}

/** A senha, como já era: deleteAccountAction confere, apaga, revoga na Pluggy e sai da conta. */
function Senha({ refTitulo, aoDesistir }: { refTitulo: React.RefObject<HTMLHeadingElement | null>; aoDesistir: () => void }) {
  const [state, formAction, isPending] = useActionState(deleteAccountAction, {} as DeleteAccountState);
  const [senha, setSenha] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Titulo refTitulo={refTitulo}>Confirme com sua senha</Titulo>
      {state.error && <Erro>{state.error}</Erro>}
      <PasswordField label="Senha" id="password" name="password" required autoComplete="current-password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
      <p className="text-sm text-ink-muted">Depois disso a conta some e você sai do app.</p>
      <div className="flex flex-col gap-2">
        <BotaoDeCuidado type="submit" disabled={isPending || senha.length === 0}>
          <Trash2 size={18} aria-hidden />
          {isPending ? "Apagando..." : "Apagar para sempre"}
        </BotaoDeCuidado>
        <BotaoDeTexto onClick={aoDesistir}>Mudei de ideia</BotaoDeTexto>
      </div>
    </form>
  );
}

/** A tela final (peça da B): cada parte ganha o seu certo, uma por vez; depois o broto e o caminho. */
function Pronto({
  refTitulo,
  partes,
  titulo,
  frase,
  recomecar,
}: {
  refTitulo: React.RefObject<HTMLHeadingElement | null>;
  partes: Parte[];
  titulo: string;
  frase: string;
  recomecar: boolean;
}) {
  // Sem animação para quem pediu menos movimento: tudo marcado de uma vez. A tela final só
  // aparece depois de um clique, então a janela já existe aqui.
  const [semMovimento] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [marcadas, setMarcadas] = useState(semMovimento ? partes.length : 0);
  useEffect(() => {
    if (semMovimento) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setMarcadas(n);
      if (n >= partes.length) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, [partes.length, semMovimento]);
  const fim = marcadas >= partes.length;

  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <span className={`relative flex size-[120px] items-center justify-center rounded-full transition-opacity duration-500 ${fim ? "opacity-100" : "opacity-40"}`} style={{ background: "linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para))", color: "var(--color-heroi-tinta)" }}>
        <Sprout size={52} strokeWidth={1.5} aria-hidden />
        {[
          "left-1.5 top-10 size-2",
          "right-2.5 top-5 size-1.5",
          "right-0.5 bottom-11 size-2",
          "left-6 bottom-2 size-1.5",
        ].map((c) => (
          <i key={c} aria-hidden className={`absolute rounded-full bg-accent opacity-70 ${c}`} />
        ))}
      </span>
      <h2 ref={refTitulo} tabIndex={-1} className="titulo-tema text-[26px] font-medium leading-tight text-ink outline-none">
        {fim ? titulo : "Limpando"}
      </h2>
      {/* Muitas partes viram duas colunas: o caminho de depois não pode cair para fora da tela. */}
      <ul className={`grid w-full gap-x-3 gap-y-2.5 text-left ${partes.length > 4 ? "max-w-[340px] grid-cols-2" : "max-w-[260px] grid-cols-1"}`} aria-label="O que foi limpo">
        {partes.map((p, i) => {
          const ok = i < marcadas;
          return (
            <li key={p} className={`flex min-w-0 items-center gap-2 text-[14.5px] leading-tight text-ink transition-opacity duration-300 ${ok ? "opacity-100" : "opacity-35"}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${ok ? "bg-success text-canvas" : "shadow-[inset_0_0_0_2px_var(--color-border-strong)]"}`}>
                {ok && <Check size={14} strokeWidth={3} aria-hidden />}
              </span>
              {PARTE_NA_TELA[p].curto}
              <span className="sr-only">{ok ? ": pronto" : ""}</span>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className={`text-[15px] text-ink-muted ${fim ? "" : "invisible"}`}>
        {fim ? frase : ""}
      </p>
      <div className={`flex w-full flex-col gap-2 ${fim ? "" : "invisible"}`}>
        {recomecar ? (
          // Navegação inteira (sem o cache do app): a conta voltou ao começo e tudo é novo.
          <BotaoPrincipal onClick={() => window.location.assign("/comecar")}>
            <FileSpreadsheet size={18} aria-hidden />
            Importar meu primeiro extrato
          </BotaoPrincipal>
        ) : (
          <>
            <Link href="/inicio" className={CLASSE_PRINCIPAL}>
              Ir para o início
            </Link>
            <Link href="/configuracoes" className={CLASSE_TEXTO}>
              Voltar para Configurações
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------
// Peças pequenas
// -------------------------------------------------------------------------------------------

const ReceiptIcone = PARTE_NA_TELA.lancamentos.Icone;

const BASE_BOTAO = "flex w-full items-center justify-center gap-2 rounded-full px-5 text-center text-base font-semibold leading-tight transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const CLASSE_PRINCIPAL = `${BASE_BOTAO} min-h-[52px] py-2.5 [background:var(--botao-fundo,var(--color-ink))] [color:var(--botao-tinta,var(--color-canvas))] [box-shadow:var(--botao-fio,none)]`;
const CLASSE_TEXTO = "mx-auto inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-sm font-medium text-ink-muted underline underline-offset-4 disabled:opacity-40";

type PropsDeBotao = React.ButtonHTMLAttributes<HTMLButtonElement>;

function BotaoPrincipal({ className = "", type = "button", ...p }: PropsDeBotao) {
  return <button type={type} {...p} className={`${CLASSE_PRINCIPAL} ${className}`} />;
}
function BotaoContorno({ className = "", type = "button", ...p }: PropsDeBotao) {
  return <button type={type} {...p} className={`${BASE_BOTAO} min-h-[52px] py-2.5 text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] ${className}`} />;
}
/** O único botão com o tom de cuidado: o do apagar conta. A cor de perigo do tema, que é sóbria. */
function BotaoDeCuidado({ className = "", type = "button", ...p }: PropsDeBotao) {
  return <button type={type} {...p} className={`${BASE_BOTAO} min-h-[52px] bg-danger py-2.5 text-canvas ${className}`} />;
}
function BotaoDeTexto({ className = "", type = "button", ...p }: PropsDeBotao) {
  return <button type={type} {...p} className={`${CLASSE_TEXTO} ${className}`} />;
}

function Titulo({ children, refTitulo }: { children: React.ReactNode; refTitulo: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <h2 ref={refTitulo} tabIndex={-1} className="titulo-tema text-[24px] font-medium leading-tight text-ink outline-none">
      {children}
    </h2>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

function Pontos({ atual, total, cuidado }: { atual: number; total: number; cuidado: boolean }) {
  return (
    <div className="flex flex-1 justify-center gap-1.5" role="img" aria-label={`Passo ${atual} de ${total}`}>
      {Array.from({ length: total }, (_, k) => (
        <i
          key={k}
          className={`h-[7px] rounded-full transition-all duration-300 ${k < atual ? `w-5 ${cuidado ? "bg-danger" : "bg-accent"}` : "w-[7px] bg-border-strong"}`}
        />
      ))}
    </div>
  );
}

function Lado({ titulo, cor, Icone, children }: { titulo: string; cor: "accent" | "success"; Icone: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[20px] bg-surface px-3.5 py-3.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <h3 className={`flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide ${cor === "accent" ? "text-accent" : "text-success"}`}>
        <Icone size={16} strokeWidth={2} aria-hidden />
        {titulo}
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function ItemDoLado({ Icone, riscado = false, children }: { Icone: LucideIcon; riscado?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2 text-sm leading-tight text-ink">
      <Icone size={18} strokeWidth={1.7} className="shrink-0 text-ink-muted" aria-hidden />
      <span className={riscado ? "line-through decoration-border-strong decoration-[1.5px]" : ""}>{children}</span>
    </li>
  );
}

function LinhaDoResumo({ Icone, cor, children }: { Icone: LucideIcon; cor: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[15px] text-ink">
      <Icone size={18} strokeWidth={1.9} className={`shrink-0 ${cor}`} aria-hidden />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function LinhaDaConta({ Icone, cuidado = false, children }: { Icone: LucideIcon; cuidado?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-[15px] leading-snug text-ink">
      <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-[11px] ${cuidado ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink"}`}>
        <Icone size={18} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** O arquivo da cópia (desenho): a planilha com o selo de pronto quando baixou. */
function Arquivo({ pronto }: { pronto: boolean }) {
  return (
    <div aria-hidden className="relative my-2 flex h-[140px] w-[120px] flex-col justify-end gap-1.5 rounded-[18px] bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <span className="absolute right-0 top-0 h-8 w-8 rounded-bl-xl rounded-tr-[18px] bg-surface-2" />
      <b className="absolute left-3.5 top-3.5 rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">CSV</b>
      <i className="block h-[7px] rounded-full bg-border-strong" />
      <i className="block h-[7px] w-[70%] rounded-full bg-border-strong" />
      <i className="block h-[7px] w-[85%] rounded-full bg-border-strong" />
      {pronto && (
        <span className="absolute -bottom-2.5 -right-2.5 flex size-[38px] items-center justify-center rounded-full bg-success text-canvas">
          <Check size={20} strokeWidth={2.6} />
        </span>
      )}
    </div>
  );
}
