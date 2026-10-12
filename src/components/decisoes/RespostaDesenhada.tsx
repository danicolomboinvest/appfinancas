import type { ReactNode } from "react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import type { Bloco, Resposta, Veredito } from "@/lib/decisoes/respostas";

const SELO: Record<Veredito, string> = {
  bom: "bg-success-soft text-success",
  atencao: "bg-accent-soft text-accent-strong",
  ruim: "bg-danger-soft text-danger",
};
const BARRA: Record<Veredito, string> = { bom: "bg-success", atencao: "bg-accent", ruim: "bg-danger" };
const cartao = "flex flex-col rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]";

/**
 * Uma resposta do Decidir no desenho do protótipo (dcResposta, tema-padrao.html): o herói com o
 * selo, o número ou a palavra grande e o rótulo; os blocos (barra com a marca do ritmo, listas
 * com "passou R$ X", números lado a lado, comparação de dois meses); uma frase; e um botão preto
 * com o próximo passo. As contas são as do motor (lib/decisoes/respostas.ts), iguais às do app.
 */
export function RespostaDesenhada({ pergunta, resposta, depoisDoHeroi, botao }: { pergunta: string; resposta: Resposta; depoisDoHeroi?: ReactNode; botao?: ReactNode }) {
  const v = resposta.visual ?? { destaque: resposta.frase, blocos: [] as Bloco[] };
  // O bloco "Limite: 90% da renda" sozinho repete o herói (o protótipo tira).
  const blocos = v.blocos.filter((b) => !(b.tipo === "numeros" && b.itens.length === 1 && /90%/.test(b.itens[0].rotulo)));
  const destaque = v.destaque.replace(/^[−+-]\s?(?=R\$)/, "");
  const palavra = destaque.length > 14;
  const frase = resposta.detalhes[0] ?? "";
  const repete = /^Passou do plano/.test(frase) || /^Do que entrou, você guardou/.test(frase);
  return (
    <div className="flex flex-col gap-3" data-resposta-decidir>
      <span className="text-[13px] font-medium text-ink-muted">{pergunta}</span>
      <HeroiDoTema>
        <div className="flex flex-col gap-1">
          {v.selo && <span className={`mb-1 self-start rounded-full px-2 py-0.5 text-xs font-medium ${SELO[v.selo.tom]}`}>{v.selo.texto}</span>}
          {palavra ? <b className="text-[2.25rem] font-normal leading-tight tracking-[-0.02em]">{destaque}</b> : <ValorDestaque texto={destaque} />}
          {v.rotulo && <span className="text-[15px] text-heroi-suave">{v.rotulo}</span>}
        </div>
      </HeroiDoTema>
      {depoisDoHeroi}
      {blocos.map((b, i) => (
        <BlocoDaResposta key={i} b={b} />
      ))}
      {frase && !repete && <p className="px-1 text-[15px] leading-relaxed text-ink">{frase}</p>}
      {botao}
    </div>
  );
}

function BlocoDaResposta({ b }: { b: Bloco }) {
  if (b.tipo === "barra") {
    const pc = Math.min(100, (b.valor / Math.max(1, b.total)) * 100);
    const mk = b.marcador != null ? Math.min(100, (b.marcador / Math.max(1, b.total)) * 100) : null;
    return (
      <div className={`${cartao} gap-2`}>
        <div className="relative h-3 rounded-full bg-surface-2">
          <i className={`block h-full rounded-full ${BARRA[b.tom]}`} style={{ width: `${pc}%` }} />
          {mk != null && <b className="absolute -top-1 h-5 w-0.5 rounded bg-ink" style={{ left: `${mk}%` }} aria-hidden />}
        </div>
        <div className="flex justify-between gap-3 text-sm tabular-nums text-ink-muted">
          <span>{b.esquerda}</span>
          <span>{b.direita}</span>
        </div>
        {mk != null && <p className="text-xs text-ink-muted">A linha é o ritmo do mês.</p>}
      </div>
    );
  }
  if (b.tipo === "lista") {
    return (
      <div className={cartao}>
        {b.titulo && <b className="mb-1 text-[15px] font-medium text-ink">{b.titulo}</b>}
        {b.itens.map((it, i) => (
          <div key={it.nome + i} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
            <span className="min-w-0">
              <b className="block truncate font-medium text-ink">{it.nome}</b>
              {it.detalhe && <small className="text-[13px] text-ink-muted">{it.detalhe}</small>}
            </span>
            <span className="flex flex-col items-end gap-0.5 text-right text-sm tabular-nums text-ink">
              {it.valor}
              {it.selo && <em className={`rounded-full px-2 py-px text-xs font-medium not-italic ${it.selo.tom === "ruim" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink"}`}>{it.selo.texto.replace(/^\+\s?(?=R\$)/, "passou ")}</em>}
            </span>
            {it.pct != null && (
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <i className="block h-full rounded-full bg-ink" style={{ width: `${Math.min(100, it.pct * 100)}%` }} />
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (b.tipo === "numeros") {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
        {b.itens.map((it) => (
          <div key={it.rotulo} className={`${cartao} gap-0.5 p-3.5`}>
            <small className="text-[13px] text-ink-muted">{it.rotulo}</small>
            <b className={`text-lg font-medium tabular-nums ${it.tom === "ruim" ? "text-danger" : "text-ink"}`}>{it.valor}</b>
          </div>
        ))}
      </div>
    );
  }
  const mx = Math.max(1, ...b.linhas.flatMap((l) => [l.antes, l.agora]));
  const linhas = b.linhas.filter((l) => !(l.antes <= 1 && l.agora <= 1 && /renda/i.test(l.rotulo)));
  return (
    <div className={cartao}>
      <div className="flex justify-end gap-3.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-border-strong" /> {b.antes}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-accent" /> {b.agora}
        </span>
      </div>
      {linhas.map((l, i) => (
        <div key={l.rotulo} className={`flex flex-col gap-1 py-2 ${i > 0 ? "border-t border-border" : ""}`}>
          <span className="text-sm font-medium text-ink">{l.rotulo}</span>
          <div className="flex items-center gap-2">
            <i className="h-2 min-w-1 rounded-full bg-border-strong" style={{ width: `${(l.antes / mx) * 70}%` }} />
            <small className="text-xs tabular-nums text-ink-muted">{l.antesTexto}</small>
          </div>
          <div className="flex items-center gap-2">
            <i className="h-2 min-w-1 rounded-full bg-accent" style={{ width: `${(l.agora / mx) * 70}%` }} />
            <small className="text-xs tabular-nums text-ink">{l.agoraTexto}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
