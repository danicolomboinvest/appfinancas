import Link from "next/link";
import type { DadosDoTema } from "./theme-hero-data";
import type { Money } from "@/lib/profiles/voice";
import { vozDoTema } from "@/lib/profiles/voice";
import { COR_DA_DIVISAO, PONTOS } from "@/lib/profiles/game-score";

/**
 * O bloco que só existe naquele tema, no alto da tela do mês.
 *
 * É o que faz o tema ser mais do que cor e frase: o Game abre no ranking, o Disciplina no
 * Recado de hoje, o Manifestação no mural de sonhos, o Sem filtro no campeão do mês. Padrão,
 * Minimalista e Girly não têm bloco próprio — o Girly fala pela frase e pelo rodapé.
 *
 * Tudo aqui é calculado de dado que já existe (ver theme-hero-data.ts). Nada é enfeite: cada
 * número vem de um lançamento, de um orçamento ou de uma meta da pessoa.
 */
export function ThemeHero({ dados, money, mesLabel }: { dados: DadosDoTema; money: Money; mesLabel: string }) {
  switch (dados.tema) {
    case "game":
      return <HeroGame dados={dados} mesLabel={mesLabel} />;
    case "disciplina":
      return <HeroDisciplina dados={dados} money={money} />;
    case "manifestacao":
      return <HeroManifestacao dados={dados} money={money} />;
    case "semfiltro":
      return <HeroSemFiltro dados={dados} money={money} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ Game */

/**
 * O topo do Game é uma tela de ranqueada: emblema na cor da divisão, barra em três faixas
 * (III · II · I), quantos pontos faltam pra subir, o combo do mês (lançou? aportou?), o
 * histórico das últimas seis temporadas como histórico de partidas e a fileira de conquistas,
 * travadas ou não. Nada é enfeite: cada
 * número vem de registro, orçamento ou meta da pessoa (ver game-score.ts).
 */
function HeroGame({ dados, mesLabel }: { dados: DadosDoTema; mesLabel: string }) {
  const g = dados.game;
  if (!g) return null;
  const voz = vozDoTema("game");
  const cor = COR_DA_DIVISAO[g.divisao.nome] ?? "var(--color-accent)";
  const titulo = g.divisao.numeral ? `${g.divisao.nome} ${g.divisao.numeral}` : g.divisao.nome;
  const pts = (n: number) => n.toLocaleString("pt-BR");
  const faltam = g.divisao.proximo ? g.divisao.proximo - g.divisao.pontos : 0;
  const proximaDivisao = g.divisao.proximo ? PROXIMA[g.divisao.nome] : null;
  // Três faixas dentro da divisão: cada uma enche por vez, como as ligas de ranqueada.
  const faixas = [0, 1, 2].map((i) => Math.max(0, Math.min(1, g.divisao.progresso * 3 - i)));
  const desbloqueadas = g.conquistas.filter((c) => c.desbloqueada).length;
  const maxPontos = Math.max(1, ...g.historico.map((h) => h.pontos));
  return (
    // No computador: ranqueada à esquerda (três quintos), temporadas e conquistas empilhadas à
    // direita. Um embaixo do outro na largura toda eram três faixas com muito vazio.
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-start">
      <section
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-surface-2 to-surface p-4 sm:p-5 lg:col-span-3"
        style={{ borderColor: `color-mix(in srgb, ${cor} 45%, transparent)` }}
      >
        {/* O halo da divisão, atrás do emblema: é o que faz Ouro parecer Ouro sem trocar a paleta do app. */}
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 size-48 rounded-full opacity-25 blur-3xl" style={{ background: cor }} />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Ranqueada · temporada de {mesLabel.toLowerCase()}</p>
        <div className="relative mt-3 flex items-center gap-3">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-surface-2"
            style={{ borderColor: `color-mix(in srgb, ${cor} 60%, transparent)`, boxShadow: `0 0 18px color-mix(in srgb, ${cor} 40%, transparent)` }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.7" strokeLinejoin="round">
              <path d="M12 2.6l8 4.6v8.6l-8 4.6-8-4.6V7.2z" />
              <path d="M12 8.4l3.6 2.1v4.2L12 16.8l-3.6-2.1v-4.2z" fill={cor} fillOpacity="0.35" stroke="none" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-semibold tracking-tight text-ink">{titulo}</span>
            <span className="block text-sm text-ink-muted">
              {g.divisao.proximo ? `${pts(g.divisao.pontos)} pts · faltam ${pts(faltam)} pra ${proximaDivisao}` : `${pts(g.divisao.pontos)} pts · divisão máxima`}
            </span>
          </span>
          <span
            className="flex shrink-0 flex-col items-center rounded-xl border border-border bg-surface-2 px-3 py-1.5 leading-tight"
            title="Meses seguidos com o combo feito"
          >
            <span className="text-base font-semibold text-accent"><span aria-hidden>🔥</span> {g.sequencia}</span>
            <span className="text-[10px] uppercase tracking-wider text-ink-faint">{g.sequencia === 1 ? "mês seguido" : "meses seguidos"}</span>
          </span>
        </div>
        <div className="relative mt-4 flex gap-1.5">
          {faixas.map((f, i) => (
            <div key={i} className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.round(f * 100)}%`, background: cor, boxShadow: f > 0 ? `0 0 10px color-mix(in srgb, ${cor} 55%, transparent)` : undefined }}
              />
            </div>
          ))}
        </div>
        <div className="relative mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          <span>III</span><span>II</span><span>I</span>
        </div>
        {/* O combo do mês: lançou e aportou. É o que fecha a temporada, e a pessoa vê o que falta. */}
        <div className="relative mt-4 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Combo do mês</span>
          <ComboChip feito={g.combo.registrou} rotulo="Lançou" />
          <ComboChip feito={g.combo.aportou} rotulo="Aportou" />
          {g.combo.registrou && g.combo.aportou && <span className="text-caption font-semibold text-accent">+{PONTOS.combo}</span>}
        </div>
        <p className="relative mt-3 text-caption text-ink-muted">
          <span className="font-semibold text-ink">+{pts(g.pontosDoMes)} pts</span> nesta temporada
          {g.diasParaFechar > 0 ? ` · faltam ${g.diasParaFechar} dias pra fechar` : " · encerrada"}
          {g.recorde ? " · melhor temporada 🏆" : ""}
        </p>
      </section>

      <div className="grid gap-4 lg:col-span-2 lg:grid-cols-1 lg:content-start">
      {/* Histórico de partidas: as últimas seis temporadas. Verde quando fechou o combo. */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Últimas temporadas</span>
          <span className="text-caption text-ink-muted">pontos por mês</span>
        </div>
        <ul className="mt-3 grid grid-cols-6 gap-1.5">
          {g.historico.map((h) => (
            <li key={h.mes} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end rounded-md bg-surface-2 p-0.5">
                <div
                  className={`w-full rounded-sm ${h.combo ? "bg-success" : "bg-accent"}`}
                  style={{ height: `${Math.max(h.pontos > 0 ? 8 : 0, Math.round((h.pontos / maxPontos) * 100))}%`, opacity: h.atual ? 1 : 0.7 }}
                />
              </div>
              <span className={`text-[11px] tabular-nums ${h.atual ? "font-semibold text-ink" : "text-ink-muted"}`}>{pts(h.pontos)}</span>
              <span className={`text-[10px] uppercase ${h.atual ? "text-accent" : "text-ink-faint"}`}>{h.mes}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Conquistas: sempre as seis, numa fileira só pra não roubar a tela. A travada fica em
          cinza com cadeado; o que falta aparece no toque longo (title). */}
      <section className="rounded-2xl border border-border bg-surface px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Conquistas</span>
          <span className="text-caption text-ink-muted">{desbloqueadas} de {g.conquistas.length}</span>
        </div>
        <ul className="mt-2.5 grid grid-cols-6 gap-1">
          {g.conquistas.map((c) => (
            <li key={c.chave} title={c.desbloqueada ? c.nome : `${c.nome}: ${c.como}`} className={`flex flex-col items-center gap-1 text-center ${c.desbloqueada ? "" : "opacity-45"}`}>
              <span
                aria-hidden
                className={`flex size-9 items-center justify-center rounded-full border text-base leading-none ${
                  c.desbloqueada ? "border-accent/40 bg-accent-soft/30" : "border-border bg-surface-2"
                }`}
              >
                {c.desbloqueada ? ICONE_CONQUISTA[c.chave] ?? "🏅" : "🔒"}
              </span>
              <span className="text-[9px] leading-tight text-ink-muted">{c.nome}</span>
            </li>
          ))}
        </ul>
      </section>
      </div>

      {dados.metaBatida && (
        <Link href="/planejamento/metas" className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-3 transition-colors hover:border-accent lg:col-span-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
              <path d="M12 3l7 4v6.4c0 3.2-2.8 6-7 7.6-4.2-1.6-7-4.4-7-7.6V7z" />
              <path d="M9 12.2l2.2 2.2L15.4 10" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">{voz.metaBatida(dados.metaBatida.nome)}</span>
            <span className="block text-caption text-ink-muted">+100 pontos</span>
          </span>
        </Link>
      )}
    </div>
  );
}

function ComboChip({ feito, rotulo }: { feito: boolean; rotulo: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        feito ? "border-success/40 bg-success-soft/40 text-success" : "border-border text-ink-faint"
      }`}
    >
      <span aria-hidden>{feito ? "✓" : "○"}</span>
      {rotulo}
    </span>
  );
}

const PROXIMA: Record<string, string> = { Bronze: "Prata", Prata: "Ouro", Ouro: "Platina", Platina: "Diamante" };
const ICONE_CONQUISTA: Record<string, string> = {
  "primeiro-combo": "🎮",
  "sequencia-3": "🔥",
  "temporada-limpa": "🛡️",
  "guardou-20": "💎",
  "missao-fechada": "🏆",
  veterana: "⭐",
};

/* ------------------------------------------------------------ Disciplina */

function HeroDisciplina({ dados, money }: { dados: DadosDoTema; money: Money }) {
  const voz = vozDoTema("disciplina");
  const { recado, metaEmAndamento, metaBatida } = dados;
  if (!recado && !metaEmAndamento && !metaBatida) return null;
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      {recado && (
        <section
          className={`rounded-2xl border p-4 sm:p-5 ${
            recado.tom === "elogio" ? "border-success/30 bg-success-soft/40" : recado.tom === "alerta" ? "border-danger/30 bg-danger-soft/40" : "border-accent/40 bg-accent-soft/40"
          }`}
        >
          <p className={`text-caption font-semibold ${recado.tom === "elogio" ? "text-success" : recado.tom === "alerta" ? "text-danger" : "text-accent"}`}>{recado.titulo}</p>
          <p className="mt-1.5 text-[15px] font-medium text-ink">{recado.linha1}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{recado.linha2}</p>
        </section>
      )}

      {metaEmAndamento && (
        <Link href="/planejamento/metas" className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">Seu avanço</span>
            <span className="text-lg font-semibold tabular-nums text-ink">{metaEmAndamento.pct}%</span>
          </div>
          <p className="mt-1 text-[15px] font-medium text-ink">{metaEmAndamento.nome}</p>
          <div className="relative mt-3 h-2 rounded-full bg-surface-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${metaEmAndamento.pct}%` }} />
          </div>
          <p className="mt-2.5 text-sm text-ink-muted">
            {metaEmAndamento.pct >= 50 ? "Você não chegou até aqui pra parar agora." : `Alvo: ${money(metaEmAndamento.alvo, { round: true })}${metaEmAndamento.prazo ? ` até ${metaEmAndamento.prazo}` : ""}.`}
          </p>
        </Link>
      )}

      {metaBatida && (
        <Link href="/planejamento/metas" className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-3 transition-colors hover:border-accent">
          <span aria-hidden className="text-xl">🏆</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">{voz.metaBatida(metaBatida.nome)}</span>
            <span className="block text-caption text-ink-muted">{metaBatida.nome}</span>
          </span>
        </Link>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Manifestação */

const GRADIENTES = [
  "linear-gradient(160deg, #cdb6e4, #8f6fb8)",
  "linear-gradient(160deg, #f0cfd8, #c78fa4)",
  "linear-gradient(160deg, #cfe0d8, #8fae9f)",
];

function HeroManifestacao({ dados, money }: { dados: DadosDoTema; money: Money }) {
  const { sonhos, metaEmAndamento, maisPerto } = dados;
  if (sonhos.length === 0) {
    return (
      <Link href="/planejamento/metas" className="block rounded-2xl border border-dashed border-border-strong px-4 py-4 text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink">
        <span className="block text-caption font-semibold uppercase tracking-wider text-ink-faint">Sua vida dos sonhos</span>
        <span className="mt-1 block">Comece pelo primeiro sonho: uma meta com nome, valor e data. <span className="font-medium text-accent-strong">Criar →</span></span>
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <p className="text-caption font-semibold uppercase tracking-wider text-ink-faint">✨ Sua vida dos sonhos</p>
        {/* Grade de três sempre: com uma meta só, o tile ocupa um terço e não vira um bloco
            roxo do tamanho da tela. Os vazios convidam a criar o próximo sonho. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {sonhos.map((s, i) => (
            <Link
              key={s.nome}
              href="/planejamento/metas"
              className="flex h-24 min-w-0 flex-col justify-end rounded-xl p-2.5 text-white"
              style={{ background: GRADIENTES[i % GRADIENTES.length] }}
            >
              <span className="truncate text-[11px] font-semibold drop-shadow">{s.nome}</span>
              <span className="text-[10px] opacity-90">{s.pct}%</span>
            </Link>
          ))}
          {sonhos.length < 3 && (
            <Link
              href="/planejamento/metas"
              className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-caption text-ink-faint transition-colors hover:border-accent hover:text-ink"
            >
              <span className="text-lg leading-none">+</span>
              <span>sonho</span>
            </Link>
          )}
        </div>
        <p className="mt-2.5 text-caption text-ink-faint">Uma por meta. O mural é seu.</p>
      </section>

      {metaEmAndamento && (
        <Link href="/planejamento/metas" className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:p-5">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{metaEmAndamento.nome}</span>
              <span className="block text-caption text-ink-faint">
                {metaEmAndamento.prazo ? `${metaEmAndamento.prazo} · ` : ""}{money(metaEmAndamento.alvo, { round: true })}
              </span>
            </span>
            <span className="text-base font-semibold tabular-nums text-ink">{metaEmAndamento.pct}%</span>
          </div>
          <div className="relative mt-3 h-2.5 rounded-full bg-surface-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${metaEmAndamento.pct}%` }} />
          </div>
          <p className="mt-2.5 text-sm text-ink">
            {maisPerto > 0 ? (
              <>Você ficou <b>{money(maisPerto, { round: true })} mais perto</b> de {metaEmAndamento.nome.toLowerCase()} este mês.</>
            ) : (
              <>Cada aporte ligado a esta meta aparece aqui.</>
            )}
          </p>
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Sem filtro */

function HeroSemFiltro({ dados, money }: { dados: DadosDoTema; money: Money }) {
  const c = dados.campeao;
  if (!c) return null;
  const voz = vozDoTema("semfiltro");
  return (
    <Link href="/mensal/gastos" className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption font-semibold uppercase tracking-wider text-ink-faint">{voz.titulos.campeaoTitulo}</span>
        <span aria-hidden className="text-lg">😂</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold text-ink">{c.label}</span>
          <span className="block text-caption text-ink-muted">
            {c.count} {c.count === 1 ? "lançamento" : "lançamentos"} em {c.diasDecorridos} dias
          </span>
        </span>
        <span className="shrink-0 text-xl font-semibold tabular-nums text-danger">{money(c.amount, { round: true })}</span>
      </div>
      <p className="mt-2.5 text-sm text-ink">{voz.titulos.campeaoPergunta(c.key, c.label)}</p>
    </Link>
  );
}
