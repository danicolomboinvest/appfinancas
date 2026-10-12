import { Cabecalho } from "../_ajustes/Lista";
import { CopiarEmail } from "../_ajustes/Interativos";
import { SUPORTE_EMAIL } from "../_ajustes/suporte";

export const metadata = { title: "Falar com o suporte · SPI Finance" };

/** Falar com o suporte (protótipo): o cartão com o e-mail e o prazo de resposta. A resposta vem do app@. */
export default function SuportePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Falar com o suporte" />
      <div className="flex flex-col gap-2 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="text-sm text-ink-muted">E-mail do suporte</span>
        <a href={`mailto:${SUPORTE_EMAIL}`} className="break-all text-[19px] font-medium text-ink">
          {SUPORTE_EMAIL}
        </a>
        <p className="text-sm text-ink-muted">Respondemos em até 1 dia útil. Conte o que aconteceu e, se puder, mande um print.</p>
        <CopiarEmail />
      </div>
    </div>
  );
}
