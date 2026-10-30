"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { LapisDaCategoria } from "@/components/categorias/LapisDaCategoria";
import { useState, useTransition, type ReactNode } from "react";
import { Check, ChevronRight, EyeOff, Pencil, PieChart, Scissors, Send, SplitSquareHorizontal, Tag, Trash2, User, Users } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useToast } from "@/components/ui/toast-context";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel, categoriasParaEscolher, colorForCategorySlice, type CategoriasDoPerfil } from "@/lib/categories";
import { contaDaDivisao, contaDaSeparacao, type ModoDaDivisao } from "@/lib/entries/divisao";
import { dividirLancamentoAction, desfazerDivisaoAction, separarLancamentoAction } from "./transacao-actions";

export type TransacaoDaFolha = {
  id: string;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: string | null;
  customCategoryId: string | null;
  description: string | null;
  amount: number;
  divididoCom?: string | null;
  parteDeOutro?: number | null;
  devolvido?: boolean;
};

type Categoria = { parentCategory: ParentCategory | null; customCategoryId: string | null };
type Tela = "acoes" | "dividir" | "separar" | "trocar";

/**
 * A folha "Transação" (protótipo aprovado): logo, nome, categoria, "Gasto R$ 87,30" grande e
 * quatro ações redondas: Dividir com alguém, Separar em categorias, Trocar categoria, Ignorar.
 * Editar e Remover continuam, pequenos, embaixo.
 */
export function FolhaDaTransacao({
  entry,
  titulo,
  nomeDaCategoria,
  tipo,
  visual,
  valor,
  money,
  kind,
  customCategories,
  pessoas,
  onFechar,
  onEditar,
  onRemover,
  onIgnorar,
  onTrocar,
  onEnviar,
  extra,
  somenteLeitura,
}: {
  /** "Enviar para outro perfil": só para quem tem mais de um perfil. */
  onEnviar?: () => void;
  /** Casal simples: o "Só meu", logo abaixo das quatro ações. */
  extra?: ReactNode;
  /** Casal simples: o gasto é do par. Só quem gastou edita: no lugar das ações, de quem é. */
  somenteLeitura?: ReactNode;
  entry: TransacaoDaFolha;
  titulo: string;
  nomeDaCategoria: string;
  tipo: string;
  visual: { icon: LucideIcon; emoji: string | undefined };
  valor: string;
  money: (v: number) => string;
  kind: CategoriasDoPerfil;
  customCategories: { id: string; name: string; icon: string }[];
  pessoas: string[];
  onFechar: () => void;
  onEditar: () => void;
  onRemover: () => void;
  onIgnorar: () => void;
  onTrocar: (c: Categoria) => void;
}) {
  const [tela, setTela] = useState<Tela>("acoes");
  const ehGasto = entry.category === "EXPENSE" && entry.amount >= 0;
  const opcoes: (Categoria & { key: string; nome: string; icon: LucideIcon; cor: string })[] = [
    ...categoriasParaEscolher(kind).map((pc) => ({ key: pc, parentCategory: pc, customCategoryId: null, nome: categoryLabel(kind, pc), icon: categoryIcon(kind, pc), cor: colorForCategorySlice({ kind: "parent", value: pc }, kind) })),
    ...customCategories.map((c) => ({ key: c.id, parentCategory: null, customCategoryId: c.id, iconeChave: c.icon, nome: c.name, icon: CUSTOM_CATEGORY_ICON_MAP[c.icon] ?? Tag, cor: colorForCategorySlice({ kind: "custom", value: c.id }, kind) })),
  ];
  const atual = entry.customCategoryId ?? entry.parentCategory;

  return (
    <div className="flex flex-col gap-5" data-folha-transacao={tela}>
      <div className="flex flex-col items-center gap-1 pt-1 text-center">
        <span className="mb-2">
          <LogoDoLancamento descricao={entry.description} icon={visual.icon} emoji={visual.emoji} size={48} />
        </span>
        <b className="text-[17px] font-medium text-ink">{titulo}</b>
        <span className="text-sm text-ink-muted">{nomeDaCategoria}</span>
        <span className="mt-2 text-sm text-ink-muted">{tipo}</span>
        <em className="text-[2.25rem] font-light not-italic leading-tight tracking-[-0.03em] tabular-nums text-ink">{valor}</em>
        {entry.divididoCom && (
          <span className="mt-1 rounded-full bg-accent-soft px-3 py-1 text-[13px] text-accent-strong" data-dividido>
            {entry.parteDeOutro ? (entry.devolvido ? `Dividido com ${entry.divididoCom} · já acertou` : `Dividido com ${entry.divididoCom} · te deve ${money(entry.parteDeOutro)}`) : `Presente para ${entry.divididoCom}`}
          </span>
        )}
      </div>

      {somenteLeitura}

      {tela === "acoes" && !somenteLeitura && (
        <>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {ehGasto && <Acao icon={Users} rotulo="Dividir com alguém" onClick={() => setTela("dividir")} />}
            {ehGasto && <Acao icon={Scissors} rotulo="Separar em categorias" onClick={() => setTela("separar")} />}
            {entry.category === "EXPENSE" && <Acao icon={Tag} rotulo="Trocar categoria" onClick={() => setTela("trocar")} />}
            <Acao icon={EyeOff} rotulo="Ignorar" onClick={onIgnorar} />
          </div>
          {extra}
          {entry.divididoCom && <DesfazerDivisao id={entry.id} onFeito={onFechar} />}
          {onEnviar && (
            <button
              type="button"
              onClick={onEnviar}
              data-enviar-um
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left text-[15px] text-ink shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors hover:bg-surface-hover"
            >
              <Send size={20} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">Enviar para outro perfil</span>
              <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
            </button>
          )}
          <div className="flex items-center justify-center gap-6 pt-1 text-sm text-ink-muted">
            <button type="button" onClick={onEditar} className="inline-flex min-h-11 items-center gap-1.5">
              <Pencil size={15} aria-hidden /> Editar
            </button>
            <button type="button" onClick={onRemover} className="inline-flex min-h-11 items-center gap-1.5 text-danger">
              <Trash2 size={15} aria-hidden /> Remover
            </button>
          </div>
        </>
      )}

      {tela === "trocar" && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[15px] font-medium text-ink">Nova categoria</h3>
          <GradeDeCategorias opcoes={opcoes} marcada={atual} onEscolher={(c) => onTrocar({ parentCategory: c.parentCategory, customCategoryId: c.customCategoryId })} />
        </div>
      )}

      {tela === "dividir" && <Dividir entry={entry} money={money} pessoas={pessoas} onFeito={onFechar} />}
      {tela === "separar" && <Separar entry={entry} money={money} opcoes={opcoes.filter((o) => o.key !== atual)} nomeAtual={nomeDaCategoria} onFeito={onFechar} />}
    </div>
  );
}

function Acao({ icon: Icone, rotulo, onClick }: { icon: LucideIcon; rotulo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 text-center text-[13px] leading-tight text-ink">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Icone size={22} strokeWidth={1.75} aria-hidden />
      </span>
      {rotulo}
    </button>
  );
}

function GradeDeCategorias<T extends { key: string; nome: string; icon: LucideIcon; cor: string; customCategoryId?: string | null; iconeChave?: string }>({ opcoes, marcada, onEscolher }: { opcoes: T[]; marcada: string | null; onEscolher: (c: T) => void }) {
  const proprias = opcoes.filter((o) => o.customCategoryId).map((o) => ({ id: o.key, name: o.nome, icon: o.iconeChave ?? "tag" }));
  return (
    <div className="grid grid-cols-2 gap-2">
      {opcoes.map((o) => {
        const bloco = (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === marcada}
          onClick={() => onEscolher(o)}
          className="relative flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-surface p-3 text-left text-[15px] text-ink shadow-[inset_0_0_0_1px_var(--color-border)] aria-pressed:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
        >
          <CategoryIcon icon={o.icon} color={o.cor} size={36} variant="soft" />
          <span className="w-full break-words leading-tight">{o.nome}</span>
          {o.key === marcada && (
            // Na que ela criou, o canto de cima é do lápis: o visto fica logo ao lado.
            <span className={`absolute top-3 flex size-[22px] items-center justify-center rounded-full bg-ink text-surface ${o.customCategoryId ? "right-10" : "right-3"}`}>
              <Check size={13} strokeWidth={2.2} aria-hidden />
            </span>
          )}
        </button>
        );
        // A que ela criou: lápis ou toque longo para editar e apagar (12/10/2026).
        return o.customCategoryId ? (
          <LapisDaCategoria key={o.key} categoria={{ id: o.key, name: o.nome, icon: o.iconeChave ?? "tag" }} outras={proprias} canto="right-3 top-3">
            {bloco}
          </LapisDaCategoria>
        ) : (
          bloco
        );
      })}
    </div>
  );
}

function DesfazerDivisao({ id, onFeito }: { id: string; onFeito: () => void }) {
  const [pendente, start] = useTransition();
  const { showError } = useToast();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        start(async () => {
          const r = await desfazerDivisaoAction(id).catch(() => ({ ok: false }));
          if (!r.ok) return showError("Não desfez. Tente de novo.");
          // Sem aviso (14/10/2026): o lançamento volta inteiro na lista.
          onFeito();
        })
      }
      className="self-center text-sm text-ink-muted underline underline-offset-4"
    >
      Desfazer a divisão
    </button>
  );
}

function Dividir({ entry, money, pessoas, onFeito }: { entry: TransacaoDaFolha; money: (v: number) => string; pessoas: string[]; onFeito: () => void }) {
  const total = entry.amount + (entry.parteDeOutro ?? 0);
  const [modo, setModo] = useState<ModoDaDivisao>("metade");
  const [pct, setPct] = useState(30);
  const [volta, setVolta] = useState(true);
  const lista = pessoas.length ? pessoas : [];
  const [quem, setQuem] = useState(entry.divididoCom ?? lista[0] ?? "");
  const [nova, setNova] = useState(lista.length === 0);
  const [pendente, start] = useTransition();
  const erro = useErroNoBotao();
  const r = contaDaDivisao(total, modo, pct, volta);
  const MODOS: { m: ModoDaDivisao; nome: string; icon: LucideIcon }[] = [
    { m: "metade", nome: "Metade", icon: SplitSquareHorizontal },
    { m: "parte", nome: "Uma parte", icon: PieChart },
    { m: "outra", nome: "É de outra pessoa", icon: User },
  ];
  const nome = quem.trim() || "a pessoa";
  return (
    <div className="flex flex-col gap-3.5" data-dividir>
      <h3 className="text-[15px] font-medium text-ink">Como dividir?</h3>
      <div className="grid grid-cols-3 gap-2">
        {MODOS.map(({ m, nome: n, icon: I }) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => setModo(m)}
            className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-1.5 pb-3 pt-3.5 text-center text-sm leading-tight text-ink shadow-[inset_0_0_0_1px_var(--color-border)] aria-pressed:bg-ink aria-pressed:text-surface aria-pressed:shadow-none"
          >
            <I size={20} strokeWidth={1.75} aria-hidden />
            {n}
          </button>
        ))}
      </div>
      {modo === "parte" && (
        <div className="flex flex-col gap-1">
          <input type="range" min={10} max={90} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} aria-label="Quanto é seu" className="w-full accent-[var(--color-ink)]" />
          <p className="text-center text-sm text-ink-muted">
            {pct}% é seu, {100 - pct}% é de {nome}
          </p>
        </div>
      )}
      {modo === "outra" && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-medium text-ink">Vai te devolver?</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, n: "Sim" },
              { v: false, n: "Não, eu dei" },
            ].map((o) => (
              <button key={o.n} type="button" aria-pressed={volta === o.v} onClick={() => setVolta(o.v)} className="h-11 rounded-full bg-surface-2 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface">
                {o.n}
              </button>
            ))}
          </div>
        </div>
      )}
      <h3 className="text-[15px] font-medium text-ink">Com quem?</h3>
      <div className="flex flex-wrap gap-2">
        {lista.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={!nova && quem === p}
            onClick={() => {
              setNova(false);
              setQuem(p);
            }}
            className="h-[38px] rounded-full bg-surface-2 px-4 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface"
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={nova}
          onClick={() => {
            setNova(true);
            setQuem("");
          }}
          className="h-[38px] rounded-full bg-surface-2 px-4 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface"
        >
          + Nova pessoa
        </button>
      </div>
      {nova && (
        <input
          value={quem}
          onChange={(e) => setQuem(e.target.value.slice(0, 40))}
          placeholder="Nome (ex.: Marina)"
          aria-label="Nome da pessoa"
          className="h-12 rounded-full border border-border-strong bg-surface px-4 text-base text-ink"
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <span className="text-[13px] text-ink-muted">Fica no seu orçamento</span>
          <b className="text-xl font-medium tabular-nums text-ink">{money(r.minha)}</b>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-accent-soft p-3.5">
          <span className="text-[13px] text-ink-muted">{r.presente ? `Presente para ${nome}` : quem.trim() ? `${nome} te deve` : "A pessoa te deve"}</span>
          <b className="text-xl font-medium tabular-nums text-accent-strong">{money(r.presente ? total : r.dela)}</b>
        </div>
      </div>
      <button
        type="button"
        disabled={pendente || !quem.trim()}
        onClick={() => {
          erro.limpar();
          start(async () => {
            const res = await dividirLancamentoAction({ id: entry.id, modo, pctMeu: pct, volta, quem }).catch(() => ({ ok: false, erro: undefined }));
            if (!res.ok) return erro.falhou(res.erro ?? "Não salvou");
            // Sem aviso (14/10/2026): a folha fecha e a divisão aparece no lançamento.
            onFeito();
          });
        }}
        className={`min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-40 ${erro.classe}`}
      >
        {erro.erro ? TENTAR_DE_NOVO : "Salvar divisão"}
      </button>
      <ErroNoBotao erro={erro.erro} />
    </div>
  );
}

function Separar({
  entry,
  money,
  opcoes,
  nomeAtual,
  onFeito,
}: {
  entry: TransacaoDaFolha;
  money: (v: number) => string;
  opcoes: (Categoria & { key: string; nome: string; icon: LucideIcon; cor: string })[];
  nomeAtual: string;
  onFeito: () => void;
}) {
  const [primeiraDigitada, setPrimeira] = useState<number | null>(() => Math.round(entry.amount * 0.75 * 100) / 100);
  const [outra, setOutra] = useState(opcoes[0] ?? null);
  const [pendente, start] = useTransition();
  const erro = useErroNoBotao();
  const primeira = primeiraDigitada ?? 0;
  const { v1, v2 } = contaDaSeparacao(entry.amount, primeira);
  return (
    <div className="flex flex-col gap-3" data-separar>
      <h3 className="text-[15px] font-medium text-ink">Separar em categorias</h3>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl bg-surface p-3 pl-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="break-words leading-tight text-[15px] text-ink">{nomeAtual}</span>
        <CampoDeDinheiro
          valor={primeiraDigitada}
          onValor={setPrimeira}
          placeholder="0,00"
          aria-label="Valor da primeira categoria"
          className="h-10 w-[116px] rounded-full bg-canvas px-3.5 text-right text-base font-medium tabular-nums text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
        />
      </div>
      <h3 className="text-[15px] font-medium text-ink">O resto vai para</h3>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button key={o.key} type="button" aria-pressed={outra?.key === o.key} onClick={() => setOutra(o)} className="h-[38px] rounded-full bg-surface-2 px-3.5 text-sm text-ink aria-pressed:bg-ink aria-pressed:text-surface">
            {o.nome}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl bg-surface p-3 pl-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="break-words leading-tight text-[15px] text-ink">{outra?.nome ?? "Escolha a categoria"}</span>
        <em className="not-italic font-medium tabular-nums text-ink">{money(v2)}</em>
      </div>
      <p className="text-center text-sm text-ink-muted">Total {money(entry.amount)}</p>
      <button
        type="button"
        disabled={pendente || !outra || v1 <= 0 || v2 <= 0}
        onClick={() => {
          erro.limpar();
          start(async () => {
            if (!outra) return;
            const res = await separarLancamentoAction({ id: entry.id, primeira: v1, outra: { parentCategory: outra.parentCategory, customCategoryId: outra.customCategoryId } }).catch(() => ({ ok: false, erro: undefined }));
            if (!res.ok) return erro.falhou(res.erro ?? "Não separou");
            // Sem aviso (14/10/2026): a folha fecha e os dois lançamentos aparecem na lista.
            onFeito();
          });
        }}
        className={`min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-40 ${erro.classe}`}
      >
        {erro.erro ? TENTAR_DE_NOVO : "Salvar"}
      </button>
      <ErroNoBotao erro={erro.erro} />
    </div>
  );
}
