"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apagarCartaoAction } from "./cartoes-actions";

/** Mudar o nome e os dias (o cadastro de novo, já preenchido) e apagar o cartão, em dois toques. */
export function AcoesDoCartao({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <Link href={`/orcamento/cartao/novo?id=${encodeURIComponent(id)}`} className="flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:underline">
        Mudar nome ou dias
      </Link>
      <DeleteButton
        label="Apagar cartão"
        onDelete={async () => {
          await apagarCartaoAction(id);
          router.refresh();
        }}
      />
    </div>
  );
}
