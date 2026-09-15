import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs carregam um worker por caminho relativo em runtime — se o Turbopack
  // empacota, o worker some ("Cannot find module pdf.worker.mjs"). Externalizar mantém o
  // require nativo do Node, onde o worker resolve normalmente.
  // officecrypto-tool descriptografa Excel protegido por senha (extratos de banco). É CJS e usa
  // módulos nativos (crypto/cfb); externalizar evita problemas de empacotamento no Turbopack.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "nodemailer", "officecrypto-tool"],

  // A Vercel guarda uma cópia de tudo que cada rota "toca" — e são 68 rotas. O @prisma/client
  // publica os motores de TODOS os bancos que suporta (MySQL, SQLite, SQL Server, CockroachDB);
  // como o rastreador não sabe qual será usado, ele copia os quatro em cada rota: 45 MB de peso
  // morto × 68 rotas = mais de 3 GB por deploy, num banco que é Postgres e só Postgres.
  // O `datasource db` do schema trava o provider em postgresql, então os outros nunca carregam.
  // O motor NATIVO (libquery_engine-*) NÃO entra nesta lista: foi testado removendo o arquivo e
  // o cliente quebra com "could not locate the Query Engine" — o adapter Neon não dispensa ele.
  outputFileTracingExcludes: {
    "**/*": [
      "node_modules/@prisma/client/runtime/*mysql*",
      "node_modules/@prisma/client/runtime/*sqlite*",
      "node_modules/@prisma/client/runtime/*sqlserver*",
      "node_modules/@prisma/client/runtime/*cockroachdb*",
    ],
  },

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
