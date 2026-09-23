"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { deleteGoalAction } from "./actions";

export function DeleteGoalButton({ id }: { id: string }) {
  // O DeleteButton genérico diz "Remover" sozinho; aqui o rótulo vem da voz do tema.
  const { voz } = useProfileTheme();
  return <DeleteButton label={voz.titulos.formRemover} onDelete={() => deleteGoalAction(id)} />;
}
