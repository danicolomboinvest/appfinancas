/**
 * Erro que acontece NO APARELHO (12/10/2026). O caso da Hadas: no iPhone ela não conseguia subir o
 * CSV, gravar a voz nem lançar uma entrada, e o servidor não tinha nenhum registro, porque o erro
 * nascia e morria no celular. Agora cada um vai para o mesmo AppError do servidor, marcado como
 * "client", com onde aconteceu e a mensagem (nunca o conteúdo do arquivo, valores ou nomes).
 */
export type ErroDoCliente = { onde: string; mensagem: string; rota: string };

const ONDES = new Set(["importar-ler", "importar-gravar", "lancar", "voz", "janela", "promessa", "comeco-arquivo"]);

/** Monta o que vai para o servidor, já cortado e sem nada que identifique a pessoa. */
export function montarErroDoCliente(onde: string, erro: unknown, rota: string): ErroDoCliente {
  const bruto = erro instanceof Error ? `${erro.name}: ${erro.message}` : typeof erro === "string" ? erro : JSON.stringify(erro ?? null);
  const mensagem = (bruto || "sem mensagem")
    // e-mails, números longos (CPF, conta, valores) e trechos entre aspas saem antes de gravar
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\d[\d.,/-]{5,}\d/g, "[número]")
    .slice(0, 300);
  return { onde: ONDES.has(onde) ? onde : "outro", mensagem, rota: rota.split(/[?#]/)[0].slice(0, 200) || "/" };
}

/** Manda sem esperar e sem nunca virar outro erro. */
export function registrarErroNoCliente(onde: string, erro: unknown): void {
  try {
    if (typeof window === "undefined") return;
    const corpo = montarErroDoCliente(onde, erro, window.location.pathname);
    void fetch("/api/erro-do-cliente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), keepalive: true }).catch(() => {});
  } catch {
    // telemetria nunca derruba a tela
  }
}
