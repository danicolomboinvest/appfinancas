export function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex cursor-help items-center">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/10 text-[10px] text-black/60">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded bg-black px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
