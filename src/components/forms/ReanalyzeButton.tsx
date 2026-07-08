"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { reanalyzeSheetAction } from "@/app/(app)/fichas/actions";

export function ReanalyzeButton({ id, basePath }: { id: string; basePath: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => reanalyzeSheetAction(id, basePath))}
    >
      <RefreshCw size={14} />
      {isPending ? "Criando..." : "Reanalisar"}
    </Button>
  );
}
