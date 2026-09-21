"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast-context";
import { ProfileIcon, PROFILE_ICONS } from "./ProfileIcon";
import { PROFILE_COLORS, profileColor } from "@/lib/profiles/palette";
import { PROFILE_KIND_LABEL, PROFILE_KINDS, type ProfileRow } from "@/lib/repositories/profile.repo";
import { criarPerfilAction, editarPerfilAction, excluirPerfilAction, trocarPerfilAction } from "@/app/(app)/perfis/actions";
import type { ProfileKind } from "@prisma/client";

/**
 * Criar, renomear, trocar cor e ícone, e excluir perfis.
 *
 * A exclusão pede confirmação escrevendo o nome porque ela leva junto TUDO que estava dentro:
 * lançamentos, orçamento, metas, carteira. É a única ação do app que apaga anos de histórico
 * num clique, e um "tem certeza?" comum não é proporcional a isso.
 */
export function ProfilesManager({ perfis, ativoId }: { perfis: ProfileRow[]; ativoId: string }) {
  const { showToast } = useToast();
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState<ProfileRow | null>(null);
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState<ProfileRow | null>(null);

  function executar(fn: () => Promise<{ ok: boolean; error?: string }>, sucesso: string, aoFim?: () => void) {
    iniciar(async () => {
      const r = await fn();
      showToast(r.ok ? sucesso : (r.error ?? "Não consegui fazer isso agora."));
      if (r.ok) aoFim?.();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {perfis.map((p) => {
        const cor = profileColor(p.color);
        const eAtivo = p.id === ativoId;
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `rgba(${cor.dark.rgb}, 0.18)`, color: cor.dark.accent }}
            >
              <ProfileIcon name={p.icon} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
              <p className="text-caption text-ink-faint">
                {PROFILE_KIND_LABEL[p.kind]}
                {eAtivo && " · em uso agora"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!eAtivo && (
                <Button size="sm" variant="ghost" disabled={pendente} onClick={() => executar(() => trocarPerfilAction(p.id), `Você está no ${p.name}.`)}>
                  Usar
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={pendente} onClick={() => setEditando(p)}>
                Editar
              </Button>
              {perfis.length > 1 && (
                <button
                  type="button"
                  aria-label={`Excluir ${p.name}`}
                  disabled={pendente}
                  onClick={() => setExcluindo(p)}
                  className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <Button type="button" variant="secondary" onClick={() => setCriando(true)} disabled={pendente} className="w-fit">
        <Plus size={16} /> Novo perfil
      </Button>

      {(criando || editando) && (
        <FormularioPerfil
          perfil={editando}
          pendente={pendente}
          onFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
          onSalvar={(dados) =>
            executar(
              () => (editando ? editarPerfilAction(editando.id, dados) : criarPerfilAction(dados)),
              editando ? "Perfil atualizado." : `Perfil ${dados.name} criado. Você já está nele.`,
              () => {
                setCriando(false);
                setEditando(null);
              },
            )
          }
        />
      )}

      {excluindo && (
        <ConfirmarExclusao
          perfil={excluindo}
          pendente={pendente}
          onFechar={() => setExcluindo(null)}
          onConfirmar={() =>
            executar(() => excluirPerfilAction(excluindo.id), `Perfil ${excluindo.name} excluído.`, () => setExcluindo(null))
          }
        />
      )}
    </div>
  );
}

type Dados = { name: string; kind: ProfileKind; icon: string; color: string };

function FormularioPerfil({
  perfil,
  pendente,
  onFechar,
  onSalvar,
}: {
  perfil: ProfileRow | null;
  pendente: boolean;
  onFechar: () => void;
  onSalvar: (d: Dados) => void;
}) {
  const [nome, setNome] = useState(perfil?.name ?? "");
  const [tipo, setTipo] = useState<ProfileKind>(perfil?.kind ?? "PESSOAL");
  const [icone, setIcone] = useState(perfil?.icon ?? "wallet");
  const [cor, setCor] = useState(perfil?.color ?? "ambar");

  return (
    <Modal open onClose={onFechar} title={perfil ? "Editar perfil" : "Novo perfil"}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            placeholder="Empresa, Casal, Casa…"
            className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTipo(k)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  tipo === k ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                {PROFILE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Cor</span>
          <div className="flex flex-wrap gap-2">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.label}
                title={c.label}
                onClick={() => setCor(c.key)}
                className={`flex size-8 items-center justify-center rounded-full border-2 transition-transform ${
                  cor === c.key ? "border-ink scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c.dark.accent }}
              >
                {cor === c.key && <Check size={14} style={{ color: c.dark.onAccent }} />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Ícone</span>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_ICONS.map((i) => (
              <button
                key={i.key}
                type="button"
                aria-label={i.label}
                title={i.label}
                onClick={() => setIcone(i.key)}
                className={`flex size-9 items-center justify-center rounded-lg border transition-colors ${
                  icone === i.key ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                <ProfileIcon name={i.key} size={17} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" disabled={pendente || !nome.trim()} onClick={() => onSalvar({ name: nome, kind: tipo, icon: icone, color: cor })}>
            {perfil ? "Salvar" : "Criar perfil"}
          </Button>
          <Button type="button" variant="ghost" onClick={onFechar} disabled={pendente}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmarExclusao({
  perfil,
  pendente,
  onFechar,
  onConfirmar,
}: {
  perfil: ProfileRow;
  pendente: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const confere = texto.trim().toLowerCase() === perfil.name.trim().toLowerCase();

  return (
    <Modal open onClose={onFechar} title="Excluir perfil">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          Excluir <b>{perfil.name}</b> apaga junto tudo que está dentro dele: lançamentos, orçamento, metas e carteira.
          Isso não tem como desfazer.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Escreva {perfil.name} para confirmar</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="danger" disabled={!confere || pendente} onClick={onConfirmar}>
            Excluir para sempre
          </Button>
          <Button type="button" variant="ghost" onClick={onFechar} disabled={pendente}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
