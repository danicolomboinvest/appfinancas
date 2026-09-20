"use client";

/**
 * Manda um evento nomeado pro rastreio do app.
 *
 * O rastreio só registrava "pageview", e por isso o relatório conseguia dizer QUAIS telas a
 * pessoa abre, mas nunca o que ela fez dentro delas. Digitar um gasto e ditar um gasto acontecem
 * na mesma tela e acabam no mesmo lugar do banco — não existe como separar depois. Se ninguém
 * medir na hora, a pergunta "a galera usa o áudio?" fica sem resposta pra sempre.
 *
 * Melhor esforço, igual ao pageview: falha silenciosa, nada aqui atrapalha quem está usando.
 */
export function trackEvent(name: string, path: string): void {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path }),
    keepalive: true,
  }).catch(() => {
    // Offline ou bloqueado: o evento se perde e está tudo bem.
  });
}
