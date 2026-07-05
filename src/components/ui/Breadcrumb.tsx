import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/** Trilha de navegação padrão: "Início > Seção > ... > Página atual" (último item sem link). */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const allItems: BreadcrumbItem[] = [{ label: "Início", href: "/inicio" }, ...items];

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-faint">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight size={14} className="shrink-0 text-ink-faint" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-ink-muted" : ""}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
