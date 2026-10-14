"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFolhaDaMeta, type MetaParaEditar } from "./FolhaDaMeta";

/**
 * O selo "prazo apertado" (14/10/2026): a meta pede por mês mais do que cabe (ver
 * lib/metas/prazo-que-cabe). Fica no canto da foto do cartão; o toque abre a folha da meta direto
 * no "Para quando?", com a sugestão de prazo. Não muda nada sozinho.
 */
export function SeloPrazoApertado({ meta, className = "" }: { meta: MetaParaEditar; className?: string }) {
  const { abrir } = useFolhaDaMeta();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Prazo apertado em ${meta.nome}: ver um prazo que cabe`}
      onClick={() => abrir(meta, 3)}
      className={`md-vidro inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ${className}`}
    >
      <i className="size-1.5 rounded-full bg-[#ffe3a3]" aria-hidden />
      Prazo apertado
    </button>
  );
}

/**
 * Vindo do Decidir (`/planejamento/metas?prazo=<id>`): abre a mesma sugestão da meta e limpa o
 * endereço, para voltar e recarregar não abrirem de novo.
 */
export function AbrirPrazoPelaUrl({ metas }: { metas: MetaParaEditar[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const { abrir } = useFolhaDaMeta();
  const feito = useRef(false);
  const id = params.get("prazo");
  useEffect(() => {
    if (!id || feito.current) return;
    feito.current = true;
    const meta = metas.find((x) => x.id === id);
    router.replace(caminho, { scroll: false });
    if (meta) abrir(meta, 3);
  }, [id, metas, abrir, router, caminho]);
  return null;
}
