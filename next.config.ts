import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs carregam um worker por caminho relativo em runtime — se o Turbopack
  // empacota, o worker some ("Cannot find module pdf.worker.mjs"). Externalizar mantém o
  // require nativo do Node, onde o worker resolve normalmente.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
