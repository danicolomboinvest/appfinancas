import { BrandMark } from "@/components/brand/BrandMark";
import { Cabecalho } from "../_ajustes/Lista";

export const metadata = { title: "Sobre · SPI Finance" };

const VERSAO = "0.1.0";
const DATA_DA_VERSAO = "outubro de 2026";

/** Sobre (protótipo): cartão branco com o logo, o nome, a versão com a data e "Feito por Dani Colombo". */
export default function SobrePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Sobre" />
      <div className="flex items-center gap-4 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <BrandMark size={56} />
        <span className="min-w-0">
          <b className="block text-[17px] font-medium text-ink">SPI Finance</b>
          <small className="block text-sm text-ink-muted">
            Versão {VERSAO} · {DATA_DA_VERSAO}
          </small>
          <small className="block text-sm text-ink-muted">Feito por Dani Colombo</small>
        </span>
      </div>
    </div>
  );
}
