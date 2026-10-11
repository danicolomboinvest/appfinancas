"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Clock, Download, Eye, House, Info, Lock, LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import { logoutAction } from "@/lib/auth/actions";
import { mostrarRendaAction, removerParAction, sairDoCasalAction } from "@/app/(app)/divisao/nos-dois-actions";
import { BOTAO_ESCURO, Bolinha, CARTAO, ParDeAvatares } from "./visual";

/**
 * Configurações › Nós dois (protótipo aprovado, tela h). A titular vê o par, o fechamento a
 * dois, o plano, o aviso dos 90 dias, baixar e remover. O par vê quem paga, quando entrou,
 * baixar o que ele lançou e sair. Sem a linha "Avisos" do protótipo: os avisos de lançamento do
 * outro ainda não existem no app, e uma linha que não faz nada não entra.
 */

function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function Voltar({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} className="-ml-1 flex min-h-11 w-fit items-center gap-1 text-[17px] text-ink-muted">
      <ChevronLeft size={20} strokeWidth={1.6} aria-hidden />
      {rotulo}
    </Link>
  );
}

function Linha({ icone, rotulo, valor, perigo = false, sub, onClick, href }: { icone: React.ReactNode; rotulo: string; valor?: React.ReactNode; perigo?: boolean; sub?: string; onClick?: () => void; href?: string }) {
  const corpo = (
    <>
      <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${perigo ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink"}`}>
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[17px] font-semibold ${perigo ? "text-danger" : "text-ink"}`}>{rotulo}</span>
        {sub && <span className="block break-words text-[15px] text-ink-muted">{sub}</span>}
      </span>
      {valor !== undefined && <span className="shrink-0 text-[16px] text-ink-muted">{valor}</span>}
      {(onClick || href) && !perigo && <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-ink-muted" aria-hidden />}
    </>
  );
  const classe = "flex w-full items-center gap-4 py-4 text-left";
  if (href) return <a href={href} className={classe}>{corpo}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={classe}>{corpo}</button>;
  return <div className={classe}>{corpo}</div>;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-[15px] leading-relaxed text-ink-muted">
      <Info size={18} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ConfigDaTitular({
  nomeTitular,
  par,
  mostrarRenda,
  precoDoCasal,
  renovaEm,
}: {
  nomeTitular: string;
  par: { nome: string; entrouEmIso: string } | null;
  mostrarRenda: boolean;
  precoDoCasal: number;
  renovaEm: string | null;
}) {
  const router = useRouter();
  const [remover, setRemover] = useState(false);
  const [renda, setRenda] = useState(mostrarRenda);
  const [ocupado, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <Voltar href="/configuracoes" rotulo="Configurações" />
      <h1 className="titulo-tema text-[34px] font-medium leading-tight tracking-tight text-ink">Nós dois</h1>

      <h2 className="mt-3 px-1 text-[15px] font-semibold text-ink-muted">Seu par</h2>
      <div className={`${CARTAO} divide-y divide-border px-5`}>
        {par ? (
          <Linha
            icone={<Bolinha nome={par.nome} cor="par" size={34} />}
            rotulo={par.nome}
            sub={`no Nós dois desde ${diaMes(par.entrouEmIso)}`}
            valor={<span className="rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold text-success">Ativo</span>}
          />
        ) : (
          <Linha icone={<Clock size={20} strokeWidth={1.6} />} rotulo="Ainda sem par" sub="Convide pelo Nós dois" href="/divisao" />
        )}
        <Linha icone={<Check size={20} strokeWidth={1.6} />} rotulo="Fechar o mês" valor="Os dois conferem" />
        <button
          type="button"
          role="switch"
          aria-checked={renda}
          disabled={ocupado}
          onClick={() => {
            const novo = !renda;
            setRenda(novo);
            setErro(null);
            start(async () => {
              const r = await mostrarRendaAction(novo);
              if (!r.ok) {
                setRenda(!novo);
                setErro(r.mensagem);
              } else router.refresh();
            });
          }}
          className="flex w-full items-center gap-4 py-4 text-left"
        >
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
            <Eye size={20} strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-ink">Mostrar minha renda</span>
            <span className="block text-[15px] text-ink-muted">{renda ? "Seu par vê o valor" : "Seu par vê só a proporção"}</span>
          </span>
          <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${renda ? "bg-ink" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border-strong)]"}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${renda ? "left-6" : "left-1"}`} />
          </span>
        </button>
      </div>
      {erro && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">{erro}</p>}

      <h2 className="mt-3 px-1 text-[15px] font-semibold text-ink-muted">Casal</h2>
      <div className={`${CARTAO} divide-y divide-border px-5`}>
        <Linha icone={<House size={20} strokeWidth={1.6} />} rotulo="Plano Casal" valor={<span><span className="font-semibold text-ink">+ {formatMoney(precoDoCasal, DEFAULT_CURRENCY, { round: true })}</span> por ano</span>} />
        {renovaEm && <Linha icone={<Clock size={20} strokeWidth={1.6} />} rotulo="Renova em" valor={renovaEm} />}
      </div>
      <Aviso>Se o Casal não for renovado, o acesso do par para e o histórico fica guardado 90 dias.</Aviso>

      <div className={`${CARTAO} divide-y divide-border px-5`}>
        <Linha icone={<Download size={20} strokeWidth={1.6} />} rotulo="Baixar meus lançamentos" sub="planilha de tudo do casal" href="/api/casal/lancamentos" />
        {par && <Linha icone={<LogOut size={20} strokeWidth={1.6} />} rotulo={`Remover ${par.nome}`} sub="o histórico fica com você" perigo onClick={() => setRemover(true)} />}
      </div>
      <p className="mt-2 text-center text-[15px] text-ink-muted">Um par por vez.</p>

      {par && (
        <Modal open={remover} onClose={() => setRemover(false)} title={`Remover ${par.nome}?`}>
          <div className="flex flex-col gap-5">
            <ParDeAvatares titular={nomeTitular} par={par.nome} esperando />
            <ul className={`${CARTAO} divide-y divide-border px-5`}>
              <Linha icone={<House size={20} strokeWidth={1.6} />} rotulo="O histórico fica com você" sub="lançamentos, contas e metas" />
              <Linha icone={<Download size={20} strokeWidth={1.6} />} rotulo={`${par.nome} recebe uma cópia`} sub="do que lançou, por 90 dias" />
              <Linha icone={<Lock size={20} strokeWidth={1.6} />} rotulo={`O acesso de ${par.nome} para na hora`} />
            </ul>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                start(async () => {
                  const r = await removerParAction();
                  if (!r.ok) return setErro(r.mensagem);
                  setRemover(false);
                  router.refresh();
                })
              }
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-danger px-5 text-[17px] font-semibold text-canvas disabled:opacity-50"
            >
              {ocupado ? "Removendo..." : `Remover ${par.nome}`}
            </button>
            <button type="button" onClick={() => setRemover(false)} className="mx-auto min-h-11 text-[16px] text-ink underline underline-offset-4">
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ConfigDoPar({ nomeTitular, entrouEmIso }: { nomeTitular: string; entrouEmIso: string }) {
  const [sair, setSair] = useState(false);
  const [ocupado, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 pt-1">
      <Voltar href="/divisao" rotulo="Nós dois" />
      <h1 className="titulo-tema text-[34px] font-medium leading-tight tracking-tight text-ink">Nós dois de {nomeTitular}</h1>
      <div className={`${CARTAO} mt-3 divide-y divide-border px-5`}>
        <Linha icone={<Bolinha nome={nomeTitular} cor="titular" size={34} />} rotulo={nomeTitular} sub="paga o Casal" />
        <Linha icone={<Clock size={20} strokeWidth={1.6} />} rotulo="Entrei em" valor={diaMes(entrouEmIso)} />
      </div>
      <div className={`${CARTAO} divide-y divide-border px-5`}>
        <Linha icone={<Download size={20} strokeWidth={1.6} />} rotulo="Baixar o que eu lancei" sub="uma cópia, em planilha" href="/api/casal/lancamentos" />
        <Linha icone={<LogOut size={20} strokeWidth={1.6} />} rotulo="Sair do Nós dois" perigo onClick={() => setSair(true)} />
      </div>
      <Aviso>Se você sair, o histórico fica com {nomeTitular}. Você leva uma cópia do que lançou.</Aviso>
      <button type="button" onClick={() => start(() => logoutAction())} className="mx-auto mt-4 min-h-11 text-[16px] text-ink-muted underline underline-offset-4">
        Sair da conta
      </button>
      <Link href="/configuracoes/dados" className="mx-auto min-h-11 text-[15px] text-ink-muted underline underline-offset-4">
        Baixar ou excluir a minha conta
      </Link>

      <Modal open={sair} onClose={() => setSair(false)} title="Sair do Nós dois?">
        <div className="flex flex-col gap-5">
          <p className="text-[16px] leading-relaxed text-ink-muted">
            Você perde o acesso ao Nós dois de {nomeTitular} agora. Antes, se quiser, baixe a cópia do que você lançou: a cópia fica disponível por 90 dias.
          </p>
          {erro && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">{erro}</p>}
          <a href="/api/casal/lancamentos" className={BOTAO_ESCURO}>
            <Download size={20} strokeWidth={1.7} aria-hidden />
            Baixar o que eu lancei
          </a>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              start(async () => {
                const r = await sairDoCasalAction();
                if (!r.ok) return setErro(r.mensagem);
                await logoutAction();
              })
            }
            className="flex min-h-14 w-full items-center justify-center rounded-full bg-danger px-5 text-[17px] font-semibold text-canvas disabled:opacity-50"
          >
            {ocupado ? "Saindo..." : "Sair do Nós dois"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
