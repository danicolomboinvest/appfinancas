"use client";

import { useRouter } from "next/navigation";
import { CadastroDoCartao } from "@/components/cartao/CadastroDoCartao";
import type { CartaoNaTela } from "../cartoes-actions";

/** O cadastro na página: salvou, volta para "Seu cartão". */
export function NovoCartao({ inicial }: { inicial: CartaoNaTela | null }) {
  const router = useRouter();
  return (
    <CadastroDoCartao
      inicial={inicial}
      onSalvo={() => {
        router.push("/orcamento/cartao");
        router.refresh();
      }}
    />
  );
}
