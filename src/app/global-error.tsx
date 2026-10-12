"use client";

/**
 * Última linha de defesa: erro no PRÓPRIO layout raiz (error.tsx não cobre esse caso).
 * Renderiza um documento completo, aqui não há tema nem fontes carregadas, então o estilo
 * é inline e mínimo, só pra nunca mostrar a tela técnica em inglês do Next.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#f6f5f2",
          color: "#141414",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Ops, algo deu errado por aqui</h1>
        <p style={{ maxWidth: 380, fontSize: 14, lineHeight: 1.6, color: "#46433e", margin: 0 }}>
          Foi um erro nosso, não seu, seus dados estão seguros. Tente recarregar a página.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "10px 22px",
            borderRadius: 999,
            border: "none",
            background: "#141414",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
