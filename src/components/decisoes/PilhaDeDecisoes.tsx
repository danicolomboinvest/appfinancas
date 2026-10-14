"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, PiggyBank, Receipt, Repeat, ShieldCheck, Target, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { isParentCategoryKey, PARENT_CATEGORY_ICON } from "@/lib/categories";
import { contadorDaPilha, juntarComE, ordenarPilha, type CartaoDaPilha, type RespostaDaPilha } from "@/lib/decisoes/pilha";
import { cobrirCategoriaAction } from "@/app/(app)/orcamento/actions";
import { definirTetoAction, desfazerTetoAction, dispensarAvisoAction } from "@/app/(app)/mensal/foco/actions";
import {
  apagarAporteDaPilhaAction,
  combinarSobraNaReservaAction,
  desfazerDispensaAction,
  desfazerSobraNaReservaAction,
  guardarMaisNaMetaAction,
  guardeiOQueFaltaAction,
  mudarDataDaMetaAction,
  restaurarMetaAction,
} from "@/app/(app)/decidir/actions";
import "./decidir.css";

const DURACAO_SAIDA_MS = 260;
const semAnimacao = () => typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || /semanim/.test(window.location.search));

/**
 * "Pra decidir hoje" (rodada 49, direção A): uma decisão por vez. O cartão da frente tem o número,
 * uma linha, a barra fina, a pergunta e 2 ou 3 respostas; atrás aparecem as bordas dos próximos.
 * Responder tira o cartão deslizando, mostra um toast com Desfazer e o próximo vem para a frente.
 * "Pular este" (ou deslizar o cartão para o lado) manda para o fim. Zerou: "Tudo resolvido por hoje".
 */
export function PilhaDeDecisoes({ pilha, depois }: { pilha: CartaoDaPilha[]; depois: CartaoDaPilha[] }) {
  const router = useRouter();
  const { key: tema } = useProfileTheme();
  const { showToast, showError } = useToast();
  const [pendente, iniciar] = useTransition();
  const [pulos, setPulos] = useState<Record<string, number>>({});
  // O que ela já resolveu nesta visita: some na hora, sem esperar o servidor (o Desfazer devolve).
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [saindo, setSaindo] = useState<{ id: string; lado: "sai" | "pula" } | null>(null);
  // O total do "1 de 3" não encolhe enquanto ela resolve: conta todos que passaram pela pilha.
  const [vistos, setVistos] = useState<Set<string>>(() => new Set(pilha.map((c) => c.id)));
  const toqueX = useRef<number | null>(null);

  const visiveis = ordenarPilha(
    pilha.filter((c) => !feitos.has(c.id)),
    pulos,
  );
  const novos = visiveis.filter((c) => !vistos.has(c.id));
  if (novos.length) setVistos((v) => new Set([...v, ...novos.map((c) => c.id)]));
  const frente = visiveis[0];
  const { atual, total } = contadorDaPilha(Math.max(vistos.size, visiveis.length), visiveis.length);
  const soNome = tema === "titanio" || tema === "manifestacao";

  const animar = (id: string, lado: "sai" | "pula", depois: () => void) => {
    if (semAnimacao()) return depois();
    setSaindo({ id, lado });
    setTimeout(() => {
      setSaindo(null);
      depois();
    }, DURACAO_SAIDA_MS);
  };

  const pular = () => {
    if (!frente || visiveis.length < 2) return;
    animar(frente.id, "pula", () => setPulos((p) => ({ ...p, [frente.id]: (p[frente.id] ?? 0) + 1 })));
  };

  /** Aplica a resposta e devolve o Desfazer (ou null quando não há o que desfazer). */
  async function aplicar(c: CartaoDaPilha, r: RespostaDaPilha): Promise<{ texto: string; desfazer: (() => Promise<unknown>) | null }> {
    const a = c.aplicar ?? {};
    switch (r.id) {
      case "tirar": {
        const origens = a.origens ?? [];
        for (const o of origens) {
          const res = await cobrirCategoriaAction({ de: o.key, para: c.categoria ?? "", valor: o.valor });
          if (res.error) throw new Error(res.error);
        }
        return {
          texto: `${c.assunto} resolvida`,
          desfazer: async () => {
            for (const o of origens) await cobrirCategoriaAction({ de: c.categoria ?? "", para: o.key, valor: o.valor });
          },
        };
      }
      case "livre":
      case "deixar":
        await dispensarAvisoAction(c.id, "mes");
        return { texto: r.id === "livre" ? `${c.assunto}: coberta pelo livre do mês` : `${c.assunto} fica como está`, desfazer: () => desfazerDispensaAction(c.id, "mes") };
      case "guardar_mais": {
        const antes = await guardarMaisNaMetaAction(c.metaId ?? "", a.porMes ?? 0);
        if (!antes) throw new Error("meta");
        return { texto: `${c.assunto}: ${r.titulo.replace(/^Guardar mais /, "+")}`, desfazer: () => restaurarMetaAction(antes) };
      }
      case "mudar_data": {
        if (!a.chega) throw new Error("data");
        const antes = await mudarDataDaMetaAction(c.metaId ?? "", a.chega.ano, a.chega.mes);
        if (!antes) throw new Error("meta");
        return { texto: `${c.assunto}: nova data ${r.sub?.replace(/^para /, "") ?? ""}`.trim(), desfazer: () => restaurarMetaAction(antes) };
      }
      case "sobra_reserva":
        await combinarSobraNaReservaAction(a.sobra ?? 0);
        return { texto: "Combinado: no fechamento, a sobra vai para a reserva", desfazer: () => desfazerSobraNaReservaAction() };
      case "teto":
        await definirTetoAction({ categoria: c.categoria ?? "", valor: a.teto ?? 0 });
        return { texto: `${c.assunto}: ${r.titulo.toLowerCase()} até o fim do mês`, desfazer: () => desfazerTetoAction(c.categoria ?? "") };
      case "ja_guardei": {
        const id = await guardeiOQueFaltaAction();
        return { texto: "Guardado do mês anotado", desfazer: id ? () => apagarAporteDaPilhaAction(id) : null };
      }
      case "guardo_na_semana":
        await dispensarAvisoAction(c.id, "semana");
        return { texto: "Combinado: esta semana", desfazer: () => desfazerDispensaAction(c.id, "semana") };
      default:
        return { texto: "Feito", desfazer: null };
    }
  }

  const responder = (c: CartaoDaPilha, r: RespostaDaPilha) => {
    if (r.href) {
      router.push(r.href);
      return;
    }
    iniciar(async () => {
      try {
        const feito = await aplicar(c, r);
        animar(c.id, "sai", () => setFeitos((f) => new Set([...f, c.id])));
        const desfazer = feito.desfazer;
        showToast(
          feito.texto,
          desfazer
            ? {
                label: "Desfazer",
                onClick: () =>
                  iniciar(async () => {
                    // Sem o try, uma falha aqui derrubava a tela inteira (erro solto na transição).
                    try {
                      await desfazer();
                    } catch {
                      return showError("Não consegui desfazer. Tente de novo.");
                    }
                    setFeitos((f) => {
                      const n = new Set(f);
                      n.delete(c.id);
                      return n;
                    });
                    router.refresh();
                  }),
              }
            : undefined,
        );
        router.refresh();
      } catch {
        showError("Não consegui salvar. Tente de novo.");
      }
    });
  };

  const esperam = depois.filter((c) => !feitos.has(c.id) && !visiveis.some((v) => v.id === c.id));

  return (
    <section className="flex flex-col gap-3" aria-labelledby="dc-hoje" data-tour="pilha">
      <div className="dc-cab">
        <b id="dc-hoje">Para decidir hoje</b>
        {frente && (
          <span>
            {atual} de {total}
          </span>
        )}
      </div>
      {frente ? (
        <>
          <div className="dc-tracos" aria-hidden>
            {Array.from({ length: total }, (_, k) => (
              <i key={k} className={k < atual ? "on" : ""} />
            ))}
          </div>
          <div className={`dc-pilha n${Math.min(visiveis.length, 3)}`}>
            <div
              key={frente.id}
              className={`dc-pc ${frente.tom}${saindo?.id === frente.id ? ` ${saindo.lado}` : ""}`}
              data-cartao={frente.id}
              onPointerDown={(e) => {
                if (!(e.target as HTMLElement).closest("button")) toqueX.current = e.clientX;
              }}
              onPointerUp={(e) => {
                if (toqueX.current === null) return;
                const dx = e.clientX - toqueX.current;
                toqueX.current = null;
                if (Math.abs(dx) > 60) pular();
              }}
            >
              <div className="dc-pc-t">
                <span className="dc-pc-ic" aria-hidden>
                  <IconeDoCartao c={frente} />
                </span>
                <span>{soNome ? frente.assunto : frente.titulo}</span>
              </div>
              <ValorGrande texto={frente.numero} />
              <span className="dc-pc-l">{frente.linha}</span>
              {frente.prazoApertado && (
                <Link href={frente.prazoApertado} className="dc-apertado" aria-label={`Prazo apertado em ${frente.assunto}: ver um prazo que cabe`}>
                  Prazo apertado
                </Link>
              )}
              <span className="dc-pc-b" aria-hidden>
                <i style={{ width: `${(Math.min(1, frente.progresso) * 100).toFixed(1)}%` }} />
              </span>
              <p className="dc-pc-q">{frente.pergunta}</p>
              <div className="dc-pc-ops">
                {frente.respostas.map((r) => (
                  <button key={r.id} type="button" disabled={pendente} className={`dc-pc-op${r.principal ? " p" : ""}`} onClick={() => responder(frente, r)}>
                    <span>
                      {r.titulo}
                      {r.etiqueta && <em className="dc-tag">{r.etiqueta}</em>}
                    </span>
                    {r.sub && <small>{r.sub}</small>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {visiveis.length > 1 && (
            <p className="dc-depois">
              <span>Depois: {juntarComE(visiveis.slice(1).map((c) => c.curto))}</span>
              <button type="button" onClick={pular} disabled={pendente}>
                Pular este
              </button>
            </p>
          )}
          {esperam.length > 0 && (
            <p className="dc-espera">
              Mais {esperam.length} {esperam.length === 1 ? "pode" : "podem"} esperar: <b>{juntarComE(esperam.map((c) => c.curto))}</b>
            </p>
          )}
        </>
      ) : (
        <div className="dc-zero" role="status">
          <span className="dc-zero-c" aria-hidden>
            <Check size={22} strokeWidth={1.8} />
          </span>
          <b>Tudo resolvido por hoje</b>
          <small>Volto a chamar quando algo mudar.</small>
        </div>
      )}
    </section>
  );
}

function ValorGrande({ texto }: { texto: string }) {
  const i = texto.search(/\d/);
  if (i <= 0) return <b className="dc-pc-n">{texto}</b>;
  return (
    <b className="dc-pc-n">
      <span className="mr-[0.2em] text-base tracking-normal">{texto.slice(0, i).trim()}</span>
      {texto.slice(i)}
    </b>
  );
}

function IconeDoCartao({ c }: { c: CartaoDaPilha }) {
  let Icone: LucideIcon = Tag;
  if ((c.tipo === "estouro" || c.tipo === "ritmo") && c.categoria && isParentCategoryKey(c.categoria)) Icone = PARENT_CATEGORY_ICON[c.categoria];
  else if (c.tipo === "meta") Icone = Target;
  else if (c.tipo === "reserva") Icone = ShieldCheck;
  else if (c.tipo === "raiox") Icone = Repeat;
  else if (c.tipo === "fora") Icone = Receipt;
  else if (c.tipo === "aporte") Icone = PiggyBank;
  return <Icone size={20} strokeWidth={1.6} />;
}
