"use client";

import { useActionState, useTransition } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { addProductAction, toggleProductAction, removeProductAction, type ProductFormState } from "./actions";

type Product = {
  id: string;
  name: string;
  hublaProductId: string | null;
  source: "MANUAL" | "HUBLA";
  active: boolean;
};

const initialState: ProductFormState = {};

export function ProductsSection({ products }: { products: Product[] }) {
  const [state, formAction, isPending] = useActionState(addProductAction, initialState);
  useSuccessToast(isPending, state.error, state.ok ? "Produto salvo." : undefined);

  const noneActive = products.every((p) => !p.active);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-sm font-medium text-ink">Produtos do Hubla que liberam acesso</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Só compras destes produtos liberam o app automaticamente. Cada produto vendido também aparece aqui sozinho
          (desligado) para você decidir.
        </p>
      </div>

      {noneActive && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          Nenhum produto está liberando acesso. Enquanto isso, compras novas não liberam ninguém sozinhas (a lista de
          e-mails abaixo continua funcionando na mão).
        </p>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        {state.error && <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
        <Field
          label="Nome do produto (igual ao Hubla)"
          id="name"
          name="name"
          className="w-72"
          placeholder="Ex.: Do Zero à Liberdade Financeira"
        />
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Salvando..." : "Adicionar produto"}
        </Button>
      </form>

      {products.length > 0 && (
        <div className="flex flex-col divide-y divide-border/60">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProductRow({ product }: { product: Product }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className={`flex items-center gap-3 py-2.5 ${!product.active ? "opacity-60" : ""}`}>
      <div className="flex-1">
        <div className="text-sm text-ink">{product.name}</div>
        {product.source === "HUBLA" && !product.active && (
          <div className="text-xs text-ink-faint">Visto numa compra. Ligue se este produto deve dar acesso.</div>
        )}
      </div>
      <Badge tone={product.active ? "success" : "neutral"}>{product.active ? "Libera" : "Não libera"}</Badge>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => toggleProductAction(product.id, !product.active))}
        className={`text-xs transition-opacity hover:underline disabled:opacity-40 ${product.active ? "text-danger" : "text-success"}`}
      >
        {product.active ? "Desligar" : "Ligar"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (confirm(`Remover "${product.name}" da lista?`)) {
            startTransition(() => removeProductAction(product.id));
          }
        }}
        className="text-xs text-ink-faint transition-opacity hover:text-danger hover:underline disabled:opacity-40"
      >
        Remover
      </button>
    </div>
  );
}
