"use client";

import type { ReactNode } from "react";
import { BotaoMais, ItemComMenu, useMenuDoItem, type ApagarDoItem } from "@/components/ui/MenuDoItem";
import type { DividaDoSpi } from "@/lib/dividas/saude";
import { apagarDividaAction, desfazerApagarDividaAction } from "./actions";

/**
 * O "…" das dívidas (13/10/2026): no canhoto do bilhete, na lista das saudáveis e no topo do
 * detalhe. Editar abre o cadastro de sempre; Apagar tira só a dívida (ela não tem pagamentos
 * ligados: "Paguei uma parcela" só baixa o saldo), com Desfazer.
 */
function apagarDaDivida(d: DividaDoSpi, depois?: () => void): ApagarDoItem {
  return {
    titulo: `Apagar a dívida ${d.nome}?`,
    texto: "Os lançamentos dos seus meses não mudam.",
    aviso: "Dívida apagada",
    acao: () => apagarDividaAction(d.id),
    desfazer: (recibo) => desfazerApagarDividaAction(recibo),
    depois,
  };
}

export function ItemDaDivida({
  divida,
  onEditar,
  className,
  botao,
  miolo,
  style,
  children,
}: {
  divida: DividaDoSpi;
  onEditar: () => void;
  className?: string;
  botao: string;
  miolo?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <ItemComMenu nome={divida.nome} onEditar={onEditar} apagar={apagarDaDivida(divida)} className={className} botao={botao} miolo={miolo} style={style}>
      {children}
    </ItemComMenu>
  );
}

/** O "…" no cabeçalho do detalhe, antes do X. Apagou: o detalhe fecha. */
export function MaisDaDivida({ divida, onEditar, onApagou }: { divida: DividaDoSpi; onEditar: () => void; onApagou: () => void }) {
  const { abrirNoBotao, camadas } = useMenuDoItem({ nome: divida.nome, onEditar, apagar: apagarDaDivida(divida, onApagou) });
  return (
    <>
      <BotaoMais nome={divida.nome} onAbrir={abrirNoBotao} className="text-ink-muted hover:bg-surface-2 hover:text-ink" />
      {camadas}
    </>
  );
}
