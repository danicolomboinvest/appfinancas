import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs carregam um worker por caminho relativo em runtime — se o Turbopack
  // empacota, o worker some ("Cannot find module pdf.worker.mjs"). Externalizar mantém o
  // require nativo do Node, onde o worker resolve normalmente.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "nodemailer"],
  experimental: {
    serverActions: {
      // Importação de extrato/carteira manda o arquivo em base64 pela Server Action —
      // o limite padrão de 1 MB derruba PDFs/Excels normais de banco. 8 MB dá folga
      // (base64 infla ~33%, então cobre arquivos de ~6 MB reais).
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
