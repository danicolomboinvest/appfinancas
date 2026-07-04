import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function HomeSectionCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gold-strong/40 hover:bg-surface-hover hover:shadow-premium"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-soft text-gold-strong transition-colors duration-200 group-hover:bg-gold group-hover:text-black">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{subtitle}</p>
      </div>
      <ArrowUpRight
        size={18}
        className="absolute right-5 top-5 text-ink-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
    </Link>
  );
}
