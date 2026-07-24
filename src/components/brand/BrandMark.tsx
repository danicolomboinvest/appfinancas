/**
 * Marca do SPI Finance — direção "Âmbar moderno" (a que a Dani escolheu): um sol nascendo em
 * ondas concêntricas, com preenchimento em degradê âmbar, sobre um quadrado escuro. É o ícone
 * completo (fundo + símbolo), então serve igual no login, no menu e como ícone do app/favicon.
 * Fiel ao conceito apresentado — mesmas curvas, mesma composição.
 */
export function BrandMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="SPI Finance">
      <defs>
        <linearGradient id="spiMarkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4C86F" />
          <stop offset="1" stopColor="#C77A22" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="15" fill="#1B1610" />
      {/* ondas (raios do sol nascendo) */}
      <path d="M16 45 A16 16 0 0 1 48 45" fill="none" stroke="url(#spiMarkGrad)" strokeWidth="5.4" strokeLinecap="round" />
      <path
        d="M23.5 45 A8.5 8.5 0 0 1 40.5 45"
        fill="none"
        stroke="url(#spiMarkGrad)"
        strokeWidth="5.4"
        strokeLinecap="round"
        opacity="0.72"
      />
      {/* núcleo na base das ondas */}
      <circle cx="32" cy="45" r="3.1" fill="url(#spiMarkGrad)" />
      {/* sol */}
      <circle cx="45" cy="22" r="6" fill="url(#spiMarkGrad)" />
    </svg>
  );
}
