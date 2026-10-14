"use client";

import { CurrencyField } from "@/components/ui/CurrencyField";
import { Explica } from "@/components/ui/Explica";

import { useActionState, type ElementType } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { updateProfileAction, type ProfileState } from "./actions";

const initialState: ProfileState = {};

export function ProfileForm({
  defaults,
  semMoldura = false,
}: {
  defaults: { name: string | null; email: string; phone: string | null; nascimento?: string | null; renda?: number | null };
  /** Dentro da janela do lápis (07/10/2026): sem o cartão em volta. */
  semMoldura?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);
  useSuccessToast(isPending, state.error);
  const { titulos: t } = useProfileTheme().voz;

  // Na janela do lápis, um <form> simples; na tela, o cartão de sempre.
  const Raiz = (semMoldura ? "form" : Card) as ElementType;

  return (
    <Raiz {...(semMoldura ? {} : { as: "form" })} action={formAction} className={semMoldura ? "flex flex-col gap-4" : "flex flex-col gap-4 p-5"}>
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      {/* Protótipo: Nome, E-mail, Celular, Data de nascimento e Renda mensal; Salvar preto da largura toda. */}
      <div className="grid grid-cols-1 gap-4">
        <Field label={t.cfgPerfilNome} name="name" defaultValue={defaults.name ?? ""} placeholder={t.cfgPerfilNomePlaceholder} maxLength={80} />
        {/* E-mail é a chave do acesso (vinculado à compra): não muda por aqui, só via suporte. */}
        <div className="flex flex-col gap-1.5">
          <Field
            label={t.cfgPerfilEmail}
            labelExtra={<span className="ml-1.5"><Explica>{t.cfgPerfilEmailDica}</Explica></span>}
            name="email"
            type="email"
            required
            defaultValue={defaults.email}
            readOnly
            className="cursor-not-allowed opacity-60"
          />
        </div>
        <Field
          label={t.cfgPerfilCelular}
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="(11) 98765-4321"
          defaultValue={defaults.phone ?? ""}
        />
        <Field label="Data de nascimento" name="nascimento" type="date" defaultValue={defaults.nascimento ?? ""} />
        <CurrencyField label="Renda mensal" name="renda" defaultValue={defaults.renda ?? undefined} />
      </div>
      <Button type="submit" disabled={isPending} className="min-h-12 w-full">
        {isPending ? t.cfgSalvando : t.cfgSalvar}
      </Button>
    </Raiz>
  );
}
