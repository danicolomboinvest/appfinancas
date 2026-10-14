"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BotaoMais, ItemComMenu, useMenuDoItem, type ApagarDoItem } from "@/components/ui/MenuDoItem";
import { useFolhaDaMeta, type MetaParaEditar } from "./FolhaDaMeta";
import { apagarMetaAction, desfazerApagarMetaAction } from "./acoes";

/**
 * O "…" das metas (13/10/2026): no cartão da lista e no topo do detalhe, com Editar (a folha de
 * sempre, ou o assistente de Viagem para a meta que nasceu lá) e Apagar com Desfazer.
 */

function useAcoesDaMeta(meta: MetaParaEditar, editarEm: string | undefined, depois?: () => void) {
  const router = useRouter();
  const { abrir } = useFolhaDaMeta();
  const onEditar = () => (editarEm ? router.push(editarEm) : abrir(meta));
  const apagar: ApagarDoItem = {
    titulo: `Apagar a meta ${meta.nome}?`,
    // Verdade do modelo: os aportes ficam nos meses (sem meta) e os ativos na Carteira (sem objetivo).
    texto: "Os aportes continuam nos seus meses e os investimentos na Carteira.",
    aviso: "Meta apagada",
    acao: async () => {
      const r = await apagarMetaAction(meta.id);
      return r.ok ? r : { ok: false, erro: r.error };
    },
    desfazer: async (recibo) => {
      const r = await desfazerApagarMetaAction(recibo);
      return r.ok ? r : { ok: false, erro: r.error };
    },
    depois,
  };
  return { onEditar, apagar };
}

/** O cartão da lista com o "…" no canto de cima da foto e o tocar e segurar. */
export function CartaoComMenu({ meta, editarEm, children }: { meta: MetaParaEditar; editarEm?: string; children: ReactNode }) {
  const { onEditar, apagar } = useAcoesDaMeta(meta, editarEm);
  return (
    <ItemComMenu nome={meta.nome} onEditar={onEditar} apagar={apagar} botao="md-vidro right-3 top-3">
      {children}
    </ItemComMenu>
  );
}

/** O "…" no topo do detalhe, ao lado do X. Apagou: volta para Metas. */
export function MaisDaMeta({ meta, editarEm }: { meta: MetaParaEditar; editarEm?: string }) {
  const router = useRouter();
  const { onEditar, apagar } = useAcoesDaMeta(meta, editarEm, () => router.push("/planejamento/metas"));
  const { abrirNoBotao, camadas } = useMenuDoItem({ nome: meta.nome, onEditar, apagar });
  return (
    <>
      <BotaoMais nome={meta.nome} onAbrir={abrirNoBotao} className="md-vidro" />
      {camadas}
    </>
  );
}
