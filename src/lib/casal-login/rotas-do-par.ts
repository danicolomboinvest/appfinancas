/**
 * O que o par abre no app. Ele vê SÓ o Nós dois da titular: Carteira, Decidir, Análises, Visão
 * geral, Perfis e o resto respondem 404, e não 403, porque ele nem precisa saber que existem
 * (proposta aprovada, seção "Permissões").
 *
 * Quem barra é o proxy (src/proxy.ts), antes de qualquer página rodar. As consultas também não
 * deixam passar nada (o par entra com o próprio userId e as tabelas filtram por ele), então isto
 * aqui é a primeira porta, não a única.
 */

/** Telas do par. Prefixos: "/divisao" vale para "/divisao" e "/divisao/qualquer-coisa". */
// Dados: o par exporta e exclui a PRÓPRIA conta (LGPD). Tudo ali filtra pelo userId dele.
export const ROTAS_DO_PAR = ["/divisao", "/configuracoes/nos-dois", "/configuracoes/dados", "/configuracoes/apagar", "/par"] as const;

/** Onde o par cai quando entra (o destino padrão de todo mundo é a Visão geral, que não é dele). */
export const CASA_DO_PAR = "/divisao";

/** Caminhos que mandam o par pra casa dele em vez do 404: a raiz e o destino padrão do login. */
const VAI_PRA_CASA = new Set(["/", "/mensal/foco", "/inicio", "/comecar"]);

/** As Configurações dele são só as do Nós dois. */
export const CONFIGURACOES_DO_PAR = "/configuracoes/nos-dois";

function sob(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export type DecisaoDaRota = "segue" | "casa" | "configuracoes" | "nao-existe";

/**
 * A rota pode abrir para o par? API passa (cada rota confere a própria sessão, e o par só tem o
 * userId dele). Arquivos do Next e do PWA nem chegam aqui (matcher do proxy).
 */
export function decidirRotaDoPar(pathname: string): DecisaoDaRota {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (sob(p, "/api")) return "segue";
  if (ROTAS_DO_PAR.some((r) => sob(p, r))) return "segue";
  if (VAI_PRA_CASA.has(p)) return "casa";
  if (p === "/configuracoes") return "configuracoes";
  // Telas públicas (termos, privacidade, suporte, login): ele pode ler, e o login devolve pra casa.
  if (["/termos", "/privacidade", "/suporte", "/confirmar-email", "/redefinir-senha", "/esqueci-senha"].some((r) => sob(p, r))) return "segue";
  if (sob(p, "/login") || sob(p, "/register")) return "casa";
  return "nao-existe";
}
