/**
 * O lugar do "Continuar com Apple" e "Continuar com Google" no login e no cadastro.
 *
 * No Mockup A os dois apareciam apagados, com "em breve". Em produção não vai botão que não
 * funciona: enquanto as chaves não chegam, isto não desenha nada (nem o "ou"). O branch
 * versao-nova-login-social preenche aqui, com o divisor "ou" e um botão por provedor, no estilo
 * contorno do protótipo (54px, pílula, ícone à esquerda).
 */
export function LoginSocial({ modo }: { modo: "entrar" | "cadastro" }) {
  void modo;
  return null;
}
