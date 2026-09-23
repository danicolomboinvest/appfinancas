"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast-context";
import { ProfileIcon, PROFILE_ICONS } from "./ProfileIcon";
import { PROFILE_THEMES, profileTheme } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";
import { useProfileTheme } from "./ProfileThemeProvider";
import { PROFILE_KIND_LABEL, PROFILE_KINDS_ESCOLHIVEIS, type ProfileRow } from "@/lib/repositories/profile.repo";
import { criarPerfilAction, editarPerfilAction, excluirPerfilAction, trocarPerfilAction } from "@/app/(app)/perfis/actions";
import type { ProfileKind } from "@prisma/client";

/**
 * Criar, renomear, trocar tema e ícone, e excluir perfis.
 *
 * A exclusão pede confirmação escrevendo o nome porque ela leva junto TUDO que estava dentro:
 * lançamentos, orçamento, metas, carteira. É a única ação do app que apaga anos de histórico
 * num clique, e um "tem certeza?" comum não é proporcional a isso.
 */
export function ProfilesManager({ perfis, ativoId }: { perfis: ProfileRow[]; ativoId: string }) {
  const { showToast } = useToast();
  // A voz do perfil ATIVO: é ele quem fala enquanto a pessoa gerencia os outros.
  const { titulos: t } = useProfileTheme().voz;
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState<ProfileRow | null>(null);
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState<ProfileRow | null>(null);

  function executar(fn: () => Promise<{ ok: boolean; error?: string }>, sucesso: string, aoFim?: () => void) {
    iniciar(async () => {
      const r = await fn();
      showToast(r.ok ? sucesso : (r.error ?? t.cfgPerfisFalhou));
      if (r.ok) aoFim?.();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {perfis.map((p) => {
        const tema = profileTheme(p.theme);
        const eAtivo = p.id === ativoId;
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: tema.paleta.accentSoft, color: tema.paleta.accent }}
            >
              <ProfileIcon name={p.icon} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
              <p className="text-caption text-ink-faint">
                {t.cfgPerfisTipoLabel(p.kind, PROFILE_KIND_LABEL[p.kind])}
                {eAtivo && ` · ${t.cfgPerfisEmUso}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!eAtivo && (
                <Button size="sm" variant="ghost" disabled={pendente} onClick={() => executar(() => trocarPerfilAction(p.id), t.cfgPerfisTrocouToast(p.name))}>
                  {t.cfgPerfisUsar}
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={pendente} onClick={() => setEditando(p)}>
                {t.cfgPerfisEditar}
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
        <Plus size={16} /> {t.cfgPerfisNovo}
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
              editando ? t.cfgPerfisAtualizadoToast : t.cfgPerfisCriadoToast(dados.name),
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
            executar(() => excluirPerfilAction(excluindo.id), t.cfgPerfisExcluidoToast(excluindo.name), () => setExcluindo(null))
          }
        />
      )}
    </div>
  );
}

type Dados = { name: string; kind: ProfileKind; icon: string; theme: string };

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
  const { titulos: t } = useProfileTheme().voz;
  const [nome, setNome] = useState(perfil?.name ?? "");
  const [tipo, setTipo] = useState<ProfileKind>(perfil?.kind ?? "PESSOAL");
  const [icone, setIcone] = useState(perfil?.icon ?? "wallet");
  const [tema, setTema] = useState(perfil?.theme ?? "padrao");

  return (
    <Modal open onClose={onFechar} title={perfil ? t.cfgPerfisEditarTitulo : t.cfgPerfisNovo}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">{t.cfgPerfisNome}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            placeholder={t.cfgPerfisNomePlaceholder}
            className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">{t.cfgPerfisTipo}</span>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_KINDS_ESCOLHIVEIS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTipo(k)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  tipo === k ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                {t.cfgPerfisTipoLabel(k, PROFILE_KIND_LABEL[k])}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">{t.cfgPerfisTema}</span>
          {/* Lista, e não bolinhas como era a cor: tema não é um tom, é a paleta inteira mais
              o jeito de falar. A amostra mostra fundo E destaque juntos, porque é a diferença
              entre fundo branco e quase-preto que separa um tema do outro — não o realce. */}
          <div className="flex flex-col gap-1.5">
            {PROFILE_THEMES.map((opcao) => {
              const escolhido = tema === opcao.key;
              return (
                <button
                  key={opcao.key}
                  type="button"
                  onClick={() => setTema(opcao.key)}
                  aria-pressed={escolhido}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    escolhido ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"
                  }`}
                >
                  {/* Uma prévia de verdade, não uma bolinha: o fundo, a tinta, o destaque e
                      a primeira frase que o tema diria. É aqui que ela escolhe — tem que dar
                      pra sentir a diferença sem abrir cada um. */}
                  <span
                    className="flex w-24 shrink-0 flex-col gap-1 overflow-hidden rounded-lg border p-2"
                    style={{ backgroundColor: opcao.paleta.canvas, borderColor: opcao.paleta.borderStrong }}
                  >
                    <span className="truncate text-[10px] font-semibold leading-tight" style={{ color: opcao.paleta.ink }}>
                      {vozDoTema(opcao.key).saudacao("manha", "Dani") ?? "Platina II · 940 pts"}
                    </span>
                    <span className="h-1.5 w-3/5 rounded-full" style={{ backgroundColor: opcao.paleta.accent }} />
                    <span className="truncate text-[9px] leading-tight" style={{ color: opcao.paleta.inkMuted }}>
                      {vozDoTema(opcao.key).rotuloResultado}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{opcao.label}</span>
                    <span className="block text-caption text-ink-muted">{opcao.descricao}</span>
                  </span>
                  {escolhido && <Check size={16} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">{t.cfgPerfisIcone}</span>
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
          <Button type="button" disabled={pendente || !nome.trim()} onClick={() => onSalvar({ name: nome, kind: tipo, icon: icone, theme: tema })}>
            {perfil ? t.cfgSalvar : t.cfgPerfisCriar}
          </Button>
          <Button type="button" variant="ghost" onClick={onFechar} disabled={pendente}>
            {t.cfgCancelar}
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
  const { titulos: t } = useProfileTheme().voz;
  const [texto, setTexto] = useState("");
  const confere = texto.trim().toLowerCase() === perfil.name.trim().toLowerCase();
  // O nome do perfil vai em negrito no meio da frase, então ela vem em duas partes.
  const [avisoAntes, avisoDepois] = t.cfgPerfisExcluirTexto;

  return (
    <Modal open onClose={onFechar} title={t.cfgPerfisExcluirTitulo}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          {avisoAntes}
          <b>{perfil.name}</b>
          {avisoDepois}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">{t.cfgPerfisEscrevaParaConfirmar(perfil.name)}</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="rounded-lg border border-border-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="danger" disabled={!confere || pendente} onClick={onConfirmar}>
            {t.cfgPerfisExcluirParaSempre}
          </Button>
          <Button type="button" variant="ghost" onClick={onFechar} disabled={pendente}>
            {t.cfgCancelar}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
