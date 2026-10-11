/**
 * Marca do SPI Finance: o logo Aurora (um sol nascendo sobre ondas), na variante do tema
 * escolhido (versão nova, 11/10/2026). O mesmo ícone no claro e no escuro; só o texto "SPI
 * Finance" ao lado, quando existe, segue a cor do texto.
 *
 * O arquivo do tema chega por variável CSS (`--logo-tema`, ver themes.ts), e não por prop: assim
 * a marca do menu, da primeira tela e do login acertam a variante sem saber qual é o tema. Fora
 * do app (login, cadastro), sem tema carregado, vale a variante do Padrão.
 *
 * Os desenhos de cada variante moram em public/brand/aurora/<tema>/ (icone.svg, simbolo.svg e
 * favicon.svg), copiados de estudo-apps-financas/logo-aurora.
 */
export function BrandMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="SPI Finance"
      className={`inline-block shrink-0 overflow-hidden bg-cover bg-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        backgroundImage: "var(--logo-tema, url(/brand/aurora/padrao/icone.svg))",
      }}
    />
  );
}
