import type { LucideIcon } from "lucide-react";

/** Estado vazio/primeiro uso, ícone contextual + mensagem, com espaço opcional para uma
 * ação (ex.: um link "Criar agora"). `icon` é opcional para não quebrar chamadas existentes. */
export function EmptyState({
  message,
  icon: Icon,
  action,
}: {
  message: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
          <Icon size={20} strokeWidth={1.75} />
        </span>
      )}
      <p className="max-w-xs text-sm text-ink-faint">{message}</p>
      {action}
    </div>
  );
}
