import type { MetadataRoute } from "next";

/**
 * Manifest do PWA (Next injeta o <link rel="manifest"> automaticamente por ser convenção de
 * arquivo em app/). Cores seguem o tema PADRÃO do app, que hoje é o claro "SPI" (#faf9f4) —
 * não o dark. `display: standalone` + `orientation: portrait` = comportamento de app nativo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SPI Finance",
    short_name: "SPI Finance",
    description: "Organize seu patrimônio, metas e investimentos em um só lugar.",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    background_color: "#faf9f4",
    theme_color: "#faf9f4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
