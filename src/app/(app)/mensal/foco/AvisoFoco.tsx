"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { isParentCategoryKey } from "@/lib/categories";
import type { FocoItem } from "@/lib/decisoes/foco";
import { ajustarOrcamentoAction, definirTetoAction, dispensarAvisoAction, registrarAporteDoMesAction } from "./actions";

const arredonda10 = (v: number) => Math.ceil(v / 10) * 10;

/**
 * Um aviso do Foco. "Ver o que fazer" abre a resposta ali mesmo: o que está acontecendo, em
 * números, e os botões que resolvem (teto, subir o orçamento, "já transferi", "foi pontual").
 * Antes o botão só levava pra outra tela, e parecia que não fazia nada.
 */
export function AvisoFoco({ item, hrefMes }: { item: FocoItem; hrefMes: string }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, start] = useTransition();
  const { showToast } = useToast();
  const faixa = item.nivel === 1 ? "bg-danger" : item.nivel === 2 ? "bg-accent" : "bg-ink-faint";
  const d = item.detalhe;

  // A confirmação vai num toast: resolvido, o aviso sai da lista e o cartão (com a janela) some.
  const fazer = (acao: () => Promise<unknown>, mensagem: string) =>
    start(async () => {
      try {
        await acao();
        setAberto(false);
        showToast(mensagem);
        router.refresh();
      } catch {
        showToast("Não consegui salvar agora. Tenta de novo em instantes.");
      }
    });

  const primario = "w-full rounded-2xl bg-pill px-4 py-3 text-left text-sm font-semibold text-on-pill disabled:opacity-60";
  const secundario = "w-full rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold text-ink-muted disabled:opacity-60";
  const link = "block w-full rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold text-accent-strong";

  let corpo: React.ReactNode = null;
  if (d?.tipo === "estouro") {
    corpo = (
      <>
        <p className="text-sm text-ink">
          Em {d.label}, já saíram <b>{m(d.gasto)}</b> de {m(d.planejado)} planejados: <b>{m(d.gasto - d.planejado)} a mais</b>, e ainda {d.dias === 1 ? "falta 1 dia" : `faltam ${d.dias} dias`}.
        </p>
        <p className="text-sm text-ink-muted">Ou o plano estava baixo, ou foi um mês fora da curva. Você decide:</p>
        <button type="button" disabled={salvando} className={primario} onClick={() => fazer(() => definirTetoAction({ categoria: d.categoria, valor: 0 }), `Combinado: nada mais em ${d.label} até o fim do mês.`)}>
          Não gastar mais nada em {d.label} este mês
        </button>
        {isParentCategoryKey(d.categoria) && (
          <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => ajustarOrcamentoAction(d.categoria, arredonda10(d.gasto)), `${d.label} agora tem ${m(arredonda10(d.gasto))} este mês.`)}>
            O plano estava baixo: subir {d.label} pra {m(arredonda10(d.gasto))} este mês
          </button>
        )}
        <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => dispensarAvisoAction(item.id, "mes"), "Anotado. Esse aviso some até o mês que vem.")}>
          Foi pontual, sigo o plano
        </button>
        <Link href={hrefMes} className={link}>
          Ver os gastos do mês
        </Link>
      </>
    );
  } else if (d?.tipo === "ritmo") {
    corpo = (
      <>
        <p className="text-sm text-ink">
          Em {d.label}, já foram <b>{m(d.gasto)}</b> de {m(d.planejado)}. Sobram <b>{m(d.sobra)}</b> pra {d.dias === 1 ? "1 dia" : `${d.dias} dias`}.
        </p>
        <p className="text-sm text-ink-muted">Nesse ritmo, {d.label.toLowerCase()} estoura antes do fim do mês.</p>
        <button type="button" disabled={salvando} className={primario} onClick={() => fazer(() => definirTetoAction({ categoria: d.categoria, valor: d.sobra }), `Teto de ${m(d.sobra)} em ${d.label} até o fim do mês.`)}>
          Teto de {m(d.sobra)} em {d.label} até o fim do mês
        </button>
        <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => dispensarAvisoAction(item.id, "mes"), "Anotado. Esse aviso some até o mês que vem.")}>
          Foi pontual, sigo o plano
        </button>
      </>
    );
  } else if (d?.tipo === "fora") {
    corpo = (
      <>
        <p className="text-sm text-ink">
          <b>{m(d.valor)}</b> saíram este mês em gastos que não têm categoria no seu orçamento. Eles saem do mesmo dinheiro, por isso o livre caiu pra {m(d.livre)}.
        </p>
        <p className="text-sm text-ink-muted">Se for gasto de todo mês, vale incluir no orçamento. Se for aplicação ou pagamento de fatura, não é gasto: dá pra corrigir no lançamento.</p>
        <Link href={hrefMes} className={link}>
          Ver esses lançamentos
        </Link>
        <Link href="/orcamento" className={link}>
          Incluir no orçamento
        </Link>
        <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => dispensarAvisoAction(item.id, "mes"), "Anotado. Esse aviso some até o mês que vem.")}>
          Entendi
        </button>
      </>
    );
  } else if (d?.tipo === "aporte") {
    corpo = (
      <>
        <p className="text-sm text-ink">
          Você planejou guardar <b>{m(d.planejado)}</b> este mês e já foram {m(d.guardado)}. Faltam <b>{m(d.falta)}</b>.
        </p>
        <p className="text-sm text-ink-muted">Como na aula: primeiro você se paga, depois o resto do mês.</p>
        <button type="button" disabled={salvando} className={primario} onClick={() => fazer(() => registrarAporteDoMesAction(), `${m(d.falta)} guardados. Entrou no seu mês.`)}>
          Já transferi
        </button>
        <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => dispensarAvisoAction(item.id, "semana"), "Combinado. Eu lembro de novo na semana que vem.")}>
          Vou transferir essa semana
        </button>
      </>
    );
  } else if (d?.tipo === "meta") {
    corpo = (
      <>
        <p className="text-sm text-ink">
          {d.vencida ? (
            <>A data de {d.nome} já passou e ela ainda não chegou lá.</>
          ) : d.ultimoMes ? (
            <>
              O prazo de {d.nome} é este mês e ainda faltam <b>{m(d.porMes)}</b>.
            </>
          ) : (
            <>
              Pra {d.nome} chegar em {d.quando}, você precisaria guardar <b>{m(d.porMes)}</b> por mês a partir de agora.
            </>
          )}
        </p>
        <p className="text-sm text-ink-muted">Dá pra aumentar o quanto guarda por mês, ou escolher uma data que caiba no seu mês.</p>
        <Link href={`/planejamento/metas/${d.metaId}`} className={link}>
          Ver a meta e ajustar
        </Link>
        <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => dispensarAvisoAction(item.id, "mes"), "Anotado. Esse aviso some até o mês que vem.")}>
          Entendi
        </button>
      </>
    );
  } else if (d?.tipo === "reserva") {
    corpo = (
      <>
        <p className="text-sm text-ink">
          Sua reserva cobre <b>{d.meses < 1 ? "menos de 1 mês" : `${d.meses.toLocaleString("pt-BR")} ${d.meses === 1 ? "mês" : "meses"}`}</b> do seu custo de vida. A sua meta é {d.minimo} meses.
        </p>
        <p className="text-sm text-ink-muted">A reserva é o que segura um imprevisto sem virar dívida. Ela vem antes dos outros sonhos.</p>
        <Link href="/planejamento/reserva-emergencia" className={link}>
          Ver minha reserva
        </Link>
        <button type="button" disabled={salvando} className={secundario} onClick={() => fazer(() => dispensarAvisoAction(item.id, "mes"), "Anotado. Esse aviso some até o mês que vem.")}>
          Entendi
        </button>
      </>
    );
  }

  return (
    <Card className="flex gap-4 p-5">
      <span className={`w-1 shrink-0 rounded-full ${faixa}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{item.titulo}</p>
        <p className="mt-1 text-caption text-ink-muted">{item.texto}</p>
        {d && d.tipo !== "raiox" ? (
          <button type="button" onClick={() => setAberto(true)} className="mt-3 inline-flex rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
            {item.acao}
          </button>
        ) : (
          <Link href={item.href} className="mt-3 inline-flex rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
            {item.acao}
          </Link>
        )}
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={item.titulo}>
        <div className="flex flex-col gap-3">{corpo}</div>
      </Modal>
    </Card>
  );
}
