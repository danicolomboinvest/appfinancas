import Link from "next/link";
import { Cabecalho } from "../_ajustes/Lista";

export const metadata = { title: "Backup · SPI Finance" };

/**
 * Backup (protótipo, #configuracoes-backup): a cópia automática e cifrada de todo dia e o botão
 * para ela levar uma cópia dela em CSV (a página Exportar). A hora exata não aparece: ela depende
 * do servidor e o app não inventa número.
 */
export default function BackupPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Backup" />
      <div className="flex flex-col gap-1 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
          <span>Última cópia</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink">automático</span>
        </div>
        <b className="text-[1.5rem] font-light text-ink">todo dia, de madrugada</b>
        <p className="text-sm text-ink-muted">O app guarda uma cópia cifrada todo dia. Você não precisa fazer nada.</p>
      </div>
      <Link href="/configuracoes/dados" className="flex min-h-12 items-center justify-center rounded-full bg-surface text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
        Quero uma cópia minha (CSV)
      </Link>
    </div>
  );
}
