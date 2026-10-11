"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Clock, Copy, Eye, House, Link2, Lock, Mail, Target, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BOTAO_ESCURO, BOTAO_SUAVE, Bolinha, CARTAO, ParDeAvatares, TituloDoTema } from "./visual";
import { mensagemDoConvite, type CanalDoConvite, type EstadoDoConvite } from "@/lib/casal-login/regras";
import { cancelarConviteAction, criarConviteAction, registrarEnvioAction } from "@/app/(app)/divisao/nos-dois-actions";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";

export type ConviteNaTelaDaTitular = {
  nomePar: string;
  estado: EstadoDoConvite;
  canal: CanalDoConvite | null;
  enviadoEmIso: string | null;
  criadoEmIso: string;
  expiraEmIso: string;
};

const CANAL: Record<CanalDoConvite, string> = { whatsapp: "Pelo WhatsApp", email: "Por e-mail", copiar: "Link copiado" };
const DIA_MS = 24 * 60 * 60 * 1000;
const ESCONDER_KEY = "nos-dois-lancar-sozinha";

function diaMes(iso: string): string {
  return new Date(new Date(iso).getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function quando(iso: string | null, agora: number): string {
  if (!iso) return "ainda não mandou";
  const d = new Date(iso);
  const hoje = new Date(agora);
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const ontem = new Date(hoje.getTime() - DIA_MS).toDateString() === d.toDateString();
  return mesmoDia ? "hoje" : ontem ? "ontem" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Copia sem depender só da API nova: o WebView do app antigo às vezes não deixa. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = texto;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * O lado da titular no Nós dois (protótipo aprovado, telas a e b):
 * - Casal ainda não liberado: o desbloqueio de R$ 27 por ano (a2).
 * - Sem par: "Agora, chame o seu par" com o que ele vê e o que não vê (a1).
 * - Convite mandado: o cartão "Aguardando" com o prazo, "Mandar de novo" e "Cancelar" (b2).
 * A folha do convite (b1) tem o nome, o link e os três jeitos de mandar.
 */
export function ChamarOPar({
  nomeTitular,
  casalValendo,
  convite,
  precoDoCasal = 27,
  mostrarSempre = false,
  agoraIso,
}: {
  /** O instante da página (vem do servidor: o render não pode ler o relógio). */
  agoraIso: string;
  nomeTitular: string;
  casalValendo: boolean;
  convite: ConviteNaTelaDaTitular | null;
  precoDoCasal?: number;
  /** Abre a chamada mesmo se ela tocou "Lançar sozinha por enquanto" (vem de Configurações). */
  mostrarSempre?: boolean;
}) {
  const router = useRouter();
  const [folha, setFolha] = useState(false);
  const [escondido, setEscondido] = useState(false);
  const [, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Preferência deste aparelho, só pra não insistir; o convite continua a um toque no menu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!mostrarSempre && window.localStorage.getItem(ESCONDER_KEY) === "1") setEscondido(true);
    } catch {}
  }, [mostrarSempre]);

  const aberto = convite && (convite.estado === "aberto" || convite.estado === "vencido") ? convite : null;

  if (!casalValendo) {
    return (
      <section className="flex flex-col items-center pt-4 text-center">
        <ParDeAvatares titular={nomeTitular} par={null} />
        <TituloDoTema className="mt-6">O dinheiro da casa, a dois</TituloDoTema>
        <p className="mt-2 text-[17px] text-ink-muted">Libere o Casal e convide o seu par.</p>
        <ul className={`${CARTAO} mt-6 w-full divide-y divide-border px-5 text-left`}>
          <Item icone={<House size={20} strokeWidth={1.6} />} titulo="Contas da casa" texto="quem cuida e quem pagou" />
          <Item icone={<ArrowLeftRight size={20} strokeWidth={1.6} />} titulo="Acerto sozinho" texto="quem manda quanto pra quem" />
          <Item icone={<Target size={20} strokeWidth={1.6} />} titulo="Metas a dois" texto="cada um coloca a sua parte" />
        </ul>
        <div className={`${CARTAO} mt-4 flex w-full flex-col items-center gap-1 px-5 py-6`}>
          <span className="flex items-baseline gap-2 text-ink">
            <span className="text-[2.5rem] font-light leading-none">+</span>
            <ValorDestaque texto={formatMoney(precoDoCasal, DEFAULT_CURRENCY, { round: true })} className="text-[3.25rem] font-light leading-none tracking-[-0.03em] tabular-nums" />
          </span>
          <span className="text-[15px] text-ink-muted">por ano · o seu par entra grátis</span>
        </div>
        {/* A tela de compra (Hubla no site, Apple no iPhone) mora no branch de cobrança. */}
        <Link href="/adicionais/conta_parceiro" className={`${BOTAO_ESCURO} mt-6`}>
          Liberar o Casal
        </Link>
        <p className="mt-4 text-[15px] text-ink-muted">Somado ao seu SPI. Empresa é à parte.</p>
      </section>
    );
  }

  const folhaDoConvite = (
    <FolhaDoConvite
      open={folha}
      onClose={() => {
        setFolha(false);
        router.refresh();
      }}
      nomeInicial={aberto?.nomePar ?? ""}
    />
  );

  if (aberto) {
    const vencido = aberto.estado === "vencido";
    const total = new Date(aberto.expiraEmIso).getTime() - new Date(aberto.criadoEmIso).getTime();
    const agora = new Date(agoraIso).getTime();
    const passou = Math.min(1, Math.max(0, (agora - new Date(aberto.criadoEmIso).getTime()) / total));
    const restam = Math.max(0, Math.ceil((new Date(aberto.expiraEmIso).getTime() - agora) / DIA_MS));
    return (
      <section className="flex flex-col items-center pt-4 text-center">
        <ParDeAvatares titular={nomeTitular} par={aberto.nomePar} esperando />
        <TituloDoTema className="mt-6">{vencido ? "O convite venceu" : "Convite enviado"}</TituloDoTema>
        <p className="mt-2 text-[17px] text-ink-muted">{vencido ? "Mande de novo, com um link novo." : `Quando ${aberto.nomePar} entrar, aparece aqui.`}</p>
        <div className={`${CARTAO} mt-6 w-full p-5 text-left`}>
          <div className="flex items-center gap-3">
            <Bolinha nome={aberto.nomePar} cor="par" size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-ink">{aberto.nomePar}</p>
              <p className="truncate text-[15px] text-ink-muted">{aberto.canal ? `${CANAL[aberto.canal]}, ${quando(aberto.enviadoEmIso, agora)}` : "Link pronto, falta mandar"}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-semibold text-accent-strong">
              <Clock size={15} strokeWidth={1.8} aria-hidden />
              {vencido ? "Venceu" : "Aguardando"}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${Math.round(passou * 100)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[15px] text-ink-muted">
            <span>{vencido ? `Venceu em ${diaMes(aberto.expiraEmIso)}` : `Vale até ${diaMes(aberto.expiraEmIso)}`}</span>
            {!vencido && <span>{restam === 1 ? "1 dia" : `${restam} dias`}</span>}
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setFolha(true)} className={BOTAO_SUAVE}>
              Mandar de novo
            </button>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setErro(null);
                  const r = await cancelarConviteAction();
                  if (!r.ok) setErro(r.mensagem);
                  else router.refresh();
                })
              }
              className={BOTAO_SUAVE}
            >
              Cancelar
            </button>
          </div>
          {erro && <p className="mt-3 text-[14px] text-danger">{erro}</p>}
        </div>
        <p className="mt-5 text-[15px] text-ink-muted">Enquanto isso, você lança pelos dois.</p>
        {folhaDoConvite}
      </section>
    );
  }

  if (escondido) {
    return (
      <button type="button" onClick={() => setFolha(true)} className={`${CARTAO} flex w-full items-center gap-3 p-4 text-left`}>
        <ParDeAvatares titular={nomeTitular} par={null} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-ink">Convidar meu par</span>
          <span className="block text-[14px] text-ink-muted">Cada um com o próprio login</span>
        </span>
        <UserPlus size={20} strokeWidth={1.6} className="shrink-0 text-ink-muted" aria-hidden />
        {folhaDoConvite}
      </button>
    );
  }

  return (
    <section className="flex flex-col items-center pt-4 text-center">
      <ParDeAvatares titular={nomeTitular} par={null} />
      <TituloDoTema className="mt-6">Agora, chame o seu par</TituloDoTema>
      <p className="mt-2 text-[17px] text-ink-muted">Cada um com o próprio login. A casa num lugar só.</p>
      <ul className={`${CARTAO} mt-6 w-full divide-y divide-border px-5 text-left`}>
        <Item icone={<Eye size={20} strokeWidth={1.6} />} titulo="Ele vê" texto="o que é nosso: contas, metas, acerto" />
        <Item icone={<Lock size={20} strokeWidth={1.6} />} titulo="Ele não vê" texto="o seu pessoal e o que for só seu" />
      </ul>
      <button type="button" onClick={() => setFolha(true)} className={`${BOTAO_ESCURO} mt-6`}>
        <UserPlus size={20} strokeWidth={1.7} aria-hidden />
        Convidar meu par
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(ESCONDER_KEY, "1");
          } catch {}
          setEscondido(true);
        }}
        className="mt-4 min-h-11 text-[16px] text-ink underline underline-offset-4"
      >
        Lançar sozinha por enquanto
      </button>
      {folhaDoConvite}
    </section>
  );
}

function Item({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <li className="flex items-center gap-4 py-4">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold text-ink">{titulo}</span>
        <span className="block text-[15px] text-ink-muted">{texto}</span>
      </span>
    </li>
  );
}

/**
 * A folha do convite (b1). O link nasce ao abrir a folha (e mata o anterior, se havia): ele só
 * existe aqui, o banco guarda o hash. Os três jeitos de mandar abrem o app de cada um no próprio
 * celular; o SPI não manda mensagem nem e-mail por ela.
 */
function FolhaDoConvite({ open, onClose, nomeInicial }: { open: boolean; onClose: () => void; nomeInicial: string }) {
  const [nome, setNome] = useState(nomeInicial);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, startGerar] = useTransition();

  const [estavaAberta, setEstavaAberta] = useState(open);
  if (open !== estavaAberta) {
    setEstavaAberta(open);
    if (open) {
      setLink(null);
      setErro(null);
      setCopiado(false);
    }
  }

  // Um pedido por abertura da folha (o efeito roda duas vezes no modo de desenvolvimento, e cada
  // pedido mata o link anterior).
  const pediu = useRef(false);
  useEffect(() => {
    if (!open) {
      pediu.current = false;
      return;
    }
    if (pediu.current) return;
    pediu.current = true;
    startGerar(async () => {
      const r = await criarConviteAction(nomeInicial);
      if (r.ok) setLink(r.link);
      else setErro(r.mensagem);
    });
  }, [open, nomeInicial]);

  async function mandar(canal: CanalDoConvite) {
    if (!link) return;
    const texto = mensagemDoConvite(nome.trim(), link);
    void registrarEnvioAction(canal, nome);
    if (canal === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    } else if (canal === "email") {
      window.location.href = `mailto:?subject=${encodeURIComponent("Convite para o Nós dois")}&body=${encodeURIComponent(texto)}`;
    } else {
      setCopiado(await copiar(link));
    }
  }

  const curto = link ? link.replace(/^https?:\/\//, "") : "";

  return (
    <Modal open={open} onClose={onClose} title="Convidar meu par">
      <div className="flex flex-col gap-4 text-left">
        <label className="flex flex-col gap-2">
          <span className="text-[15px] text-ink-muted">Nome do seu par</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, 30))}
            autoComplete="off"
            className="h-14 w-full rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
          />
        </label>
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 py-2 pl-4 pr-2">
          <Link2 size={20} strokeWidth={1.6} className="shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[16px] text-ink" aria-live="polite">
            {erro ? erro : link ? curto : gerando ? "Criando o link..." : ""}
          </span>
          <button
            type="button"
            disabled={!link}
            onClick={() => mandar("copiar")}
            className="min-h-10 shrink-0 rounded-full bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-40"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Canal rotulo="WhatsApp" escuro disabled={!link} onClick={() => mandar("whatsapp")} icone={<IconeWhatsApp />} />
          <Canal rotulo="E-mail" disabled={!link} onClick={() => mandar("email")} icone={<Mail size={24} strokeWidth={1.6} />} />
          <Canal rotulo={copiado ? "Copiado" : "Copiar link"} disabled={!link} onClick={() => mandar("copiar")} icone={copiado ? <Check size={24} strokeWidth={1.8} /> : <Copy size={22} strokeWidth={1.6} />} />
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1 text-[15px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Clock size={16} strokeWidth={1.6} aria-hidden />
            Vale 7 dias
          </span>
          <span className="flex items-center gap-1.5">
            <Check size={16} strokeWidth={1.6} aria-hidden />
            Com ou sem conta no SPI
          </span>
        </p>
      </div>
    </Modal>
  );
}

function Canal({ rotulo, icone, onClick, escuro = false, disabled }: { rotulo: string; icone: React.ReactNode; onClick: () => void; escuro?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 disabled:opacity-40">
      <span
        className={`flex size-[58px] items-center justify-center rounded-full ${escuro ? "bg-pill text-on-pill" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border),0_6px_18px_-12px_rgba(0,0,0,0.2)]"}`}
        aria-hidden
      >
        {icone}
      </span>
      <span className="text-[15px] text-ink">{rotulo}</span>
    </button>
  );
}

/** O balão do WhatsApp desenhado em traço, no mesmo peso dos ícones do app (sem a marca colorida). */
function IconeWhatsApp() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.3l-4.5 1.2z" />
      <path d="M9 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.6 1 1.4 1.8 2.4 2.3.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1.1-.6 1.4-.5.4-1.3.6-2.1.4-1.8-.5-3.4-1.7-4.5-3.2-.7-.9-1.1-1.9-1.1-2.9 0-.6.2-1.1.4-1.4z" />
    </svg>
  );
}
