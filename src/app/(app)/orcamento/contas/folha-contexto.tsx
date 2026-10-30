"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { FolhaDaConta, type CategoriaPropria, type InicioDaFolha } from "./FolhaDaConta";

const Ctx = createContext<(inicio: InicioDaFolha) => void>(() => {});

/** Quem abre a folha da conta: a semana (num dia), as Contas, as Contas do ano. Uma folha só. */
export function useAbrirConta() {
  return useContext(Ctx);
}

export function FolhaDasContas({ hoje, abrirNova, personalizadas = [], children }: { hoje: string; abrirNova: boolean; personalizadas?: CategoriaPropria[]; children: ReactNode }) {
  const [inicio, setInicio] = useState<InicioDaFolha | null>(abrirNova ? {} : null);
  const router = useRouter();
  const abrir = useCallback((i: InicioDaFolha) => setInicio(i), []);
  const fechar = () => {
    setInicio(null);
    // Quem chegou pelo "+" com ?nova=1 não pode ver a folha de novo ao atualizar a tela.
    if (abrirNova) router.replace("/orcamento/contas");
  };
  const titulo = inicio?.conta ? "Editar conta" : inicio?.doAno ? "Nova conta do ano" : "Nova conta";
  return (
    <Ctx.Provider value={abrir}>
      {children}
      <Modal open={inicio !== null} onClose={fechar} title={titulo}>
        {inicio !== null && <FolhaDaConta key={inicio.conta?.id ?? `${inicio.dia ?? ""}${inicio.doAno ? "ano" : ""}`} inicio={inicio} hoje={hoje} personalizadas={personalizadas} onFeito={fechar} />}
      </Modal>
    </Ctx.Provider>
  );
}
