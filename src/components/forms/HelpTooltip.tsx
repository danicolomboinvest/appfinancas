export function HelpTooltip({ text }: { text: React.ReactNode }) {
  return (
    <span className="group relative ml-1 inline-flex cursor-help items-center">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-2 text-[10px] text-ink-faint">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-2 px-2 py-1.5 text-xs text-ink opacity-0 shadow-premium-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
