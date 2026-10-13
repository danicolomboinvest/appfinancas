"use client";

import { useState, useTransition } from "react";
import { ArrowRight, ChevronRight, Layers } from "lucide-react";
import type { ProfileKind } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { ProfileIcon } from "@/components/profiles/ProfileIcon";
import { profileTheme } from "@/lib/profiles/themes";
import { useToast } from "@/components/ui/toast-context";
import { desfazerEnvioAction, enviarParaPerfilAction, prepararEnvioAction } from "./mover-actions";

export type PerfilParaEnviar = { id: string; name: string; kind: ProfileKind; icon: string; theme: string };

const TIPO: Record<ProfileKind, string> = { PESSOAL: "Pessoal", EMPRESA: "Empresa", CASAL: "Casal", CASA: "Casa", PROJETO: "Projeto", OUTRO: "Outro" };

type Passo = "perfil" | "parcelas" | "confirmar";

/** "kalunga sp" → "Kalunga Sp": a chave do comerciante, legível. */
function nomeDoComerciante(chave: string): string {
  return chave.replace(/\b\p{L}/gu, (l) => l.toUpperCase());
}

/** O círculo com o ícone do perfil nas cores do tema DELE (como em Perfis). */
function SeloDoPerfil({ perfil, size = 48 }: { perfil: PerfilParaEnviar; size?: number }) {
  const tema = profileTheme(perfil.theme);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: tema.paleta.accentSoft, color: tema.paleta.accent }}>
      <ProfileIcon name={perfil.icon} size={Math.round(size * 0.45)} />
    </span>
  );
}

/**
 * "Enviar para…" (12/10/2026): a compra da Empresa que caiu no cartão Pessoal, já importada, vai
 * para a Empresa. Uma coisa por vez: o perfil, as outras parcelas (se houver) e a confirmação, com
 * "sempre mandar" este comerciante para lá. Depois, o aviso com Desfazer.
 */
export function EnviarParaPerfil({
  ids,
  perfis,
  onFechar,
  onEnviado,
}: {
  /** Vazio = folha fechada. */
  ids: string[];
  perfis: PerfilParaEnviar[];
  onFechar: () => void;
  /** Saiu deste perfil: a lista sai do modo seleção. */
  onEnviado: () => void;
}) {
  const aberto = ids.length > 0;
  return (
    <Modal open={aberto} onClose={onFechar} title="Enviar para">
      {aberto && <Passos key={ids.join(",")} ids={ids} perfis={perfis} onFechar={onFechar} onEnviado={onEnviado} />}
    </Modal>
  );
}

function Passos({ ids, perfis, onFechar, onEnviado }: { ids: string[]; perfis: PerfilParaEnviar[]; onFechar: () => void; onEnviado: () => void }) {
  const [passo, setPasso] = useState<Passo>("perfil");
  const [destino, setDestino] = useState<PerfilParaEnviar | null>(null);
  const [extras, setExtras] = useState<{ parcelas: string[]; comerciantes: string[] } | null>(null);
  const [levarParcelas, setLevarParcelas] = useState(true);
  const [lembrar, setLembrar] = useState(false);
  const [pendente, start] = useTransition();
  const { showToast, showError } = useToast();

  function escolher(p: PerfilParaEnviar) {
    setDestino(p);
    start(async () => {
      const r = extras ?? (await prepararEnvioAction(ids).catch(() => ({ parcelas: [], comerciantes: [] })));
      setExtras(r);
      setPasso(r.parcelas.length > 0 ? "parcelas" : "confirmar");
    });
  }

  const todos = levarParcelas && extras ? [...ids, ...extras.parcelas] : ids;

  function enviar() {
    if (!destino) return;
    start(async () => {
      const r = await enviarParaPerfilAction({ ids: todos, destinoId: destino.id, lembrar }).catch(() => ({ ok: false as const, erro: "Não deu para enviar. Tente de novo." }));
      if (!r.ok) return showError(r.erro);
      onFechar();
      onEnviado();
      const desfazer = r.desfazer;
      showToast(`${r.movidos} ${r.movidos === 1 ? "enviado" : "enviados"} para ${r.destino.name}`, {
        label: "Desfazer",
        onClick: () => {
          void desfazerEnvioAction(desfazer)
            .catch(() => ({ ok: false, voltaram: 0 }))
            .then((d) => (d.ok ? showToast(d.voltaram === 1 ? "Voltou para cá" : `${d.voltaram} voltaram para cá`) : showError("Não deu para desfazer. Tente de novo.")));
        },
      });
      if (r.ficaram > 0) showError(r.ficaram === 1 ? "1 ficou aqui: já está na carteira deste perfil." : `${r.ficaram} ficaram aqui: já estão na carteira deste perfil.`);
    });
  }

  if (passo === "perfil") {
    return (
      <div className="flex flex-col gap-2" data-enviar-passo="perfil">
        {perfis.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pendente}
            onClick={() => escolher(p)}
            aria-pressed={destino?.id === p.id}
            className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors hover:bg-surface-hover disabled:opacity-60 aria-pressed:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
          >
            <SeloDoPerfil perfil={p} />
            <span className="min-w-0 flex-1">
              <b className="block break-words text-[16px] font-medium leading-snug text-ink">{p.name}</b>
              <span className="block text-[13px] text-ink-muted">{TIPO[p.kind]}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
          </button>
        ))}
      </div>
    );
  }

  if (passo === "parcelas" && extras && destino) {
    const n = extras.parcelas.length;
    return (
      <div className="flex flex-col items-center gap-4 text-center" data-enviar-passo="parcelas">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <Layers size={28} strokeWidth={1.75} aria-hidden />
        </span>
        <b className="text-[19px] font-medium leading-snug text-ink">{n === 1 ? "Levar a outra parcela?" : `Levar as outras ${n} parcelas?`}</b>
        <p className="text-[15px] text-ink-muted">Da mesma compra</p>
        <div className="grid w-full grid-cols-1 gap-2">
          <button type="button" onClick={() => { setLevarParcelas(true); setPasso("confirmar"); }} className="min-h-12 rounded-full bg-ink text-base font-medium text-canvas">
            Sim, levar todas
          </button>
          <button type="button" onClick={() => { setLevarParcelas(false); setPasso("confirmar"); }} className="min-h-12 rounded-full bg-surface-2 text-base font-medium text-ink">
            {ids.length === 1 ? "Só esta" : "Só estas"}
          </button>
        </div>
      </div>
    );
  }

  if (!destino) return null;
  const comerciantes = extras?.comerciantes ?? [];
  return (
    <div className="flex flex-col gap-5" data-enviar-passo="confirmar">
      <div className="flex items-center justify-center gap-3 pt-1">
        <span className="flex min-w-16 flex-col items-center">
          <em className="text-[2.5rem] font-light not-italic leading-none tabular-nums text-ink">{todos.length}</em>
          <span className="mt-1 text-[13px] text-ink-muted">{todos.length === 1 ? "lançamento" : "lançamentos"}</span>
        </span>
        <ArrowRight size={22} className="shrink-0 text-ink-faint" aria-hidden />
        <span className="flex min-w-0 flex-col items-center">
          <SeloDoPerfil perfil={destino} size={56} />
          <span className="mt-1 max-w-[9rem] break-words text-center text-[13px] font-medium text-ink">{destino.name}</span>
        </span>
      </div>

      {comerciantes.length > 0 && (
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-surface p-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">
            {comerciantes.length === 1 ? (
              <>Sempre mandar <b className="font-medium">{nomeDoComerciante(comerciantes[0])}</b> para lá</>
            ) : (
              <>Sempre mandar estas {comerciantes.length} lojas para lá</>
            )}
          </span>
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="peer sr-only" />
          <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${lembrar ? "bg-ink" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border-strong)]"}`}>
            <span className={`absolute left-1 top-1 size-5 rounded-full bg-canvas shadow transition-transform ${lembrar ? "translate-x-5" : ""}`} />
          </span>
        </label>
      )}

      <div className="grid grid-cols-1 gap-2">
        <button type="button" disabled={pendente} onClick={enviar} className="min-h-12 rounded-full bg-ink text-base font-medium text-canvas disabled:opacity-50">
          Enviar
        </button>
        <button type="button" disabled={pendente} onClick={() => setPasso("perfil")} className="min-h-11 text-sm text-ink-muted">
          Trocar o perfil
        </button>
      </div>
    </div>
  );
}
