/**
 * "Como funciona o casal" (pedido da dona em 13/10/2026): o tutorial curto do Casal simples.
 * Seis passos, um conceito por tela, cada um com uma mini-tela animada (TutorialDoCasal.tsx).
 *
 * Texto puro, sem React e sem banco, para dar para testar. Os nomes vêm dos dados, sem artigo
 * ("Mostrar para Lucas"). Sem par ainda (o atalho antes do convite), o texto fala "seu par".
 * Sem travessão, sem emoji, sem gênero e "para", nunca "pra".
 */

export type PessoaDoTutorial = { nome: string; papel: "titular" | "par" };

export type IdDoPasso = "cada-um" | "da-casa" | "acerto" | "o-que-ve" | "regras" | "fim";

export type PassoDoTutorial = { id: IdDoPasso; titulo: string; texto: string };

export type TextosDoTutorial = {
  passos: PassoDoTutorial[];
  /** As três regras rápidas do passo 5, na ordem da tela. */
  regras: string[];
  /** O botão do último passo: chamar o par, liberar o Casal ou fechar. */
  botaoFinal: string;
  /** A linha do preço no último passo, só quando a cobrança do Casal está ligada e ainda não há par. */
  preco: string | null;
};

/**
 * Como o tutorial termina:
 * - "pronto": os dois já estão na casa (o automático e o de Configurações › Casa).
 * - "convidar": ainda sem par, no lugar do convite. O botão chama o par.
 * - "liberar": ainda sem par e sem o Casal liberado. O botão leva para a compra.
 * - "esperando": o convite já foi mandado e o par ainda não entrou.
 */
export type FimDoTutorial = "pronto" | "convidar" | "liberar" | "esperando";

export function textosDoTutorial(outro: PessoaDoTutorial | null, opcoes: { preco?: string | null; fim?: FimDoTutorial } = {}): TextosDoTutorial {
  const nomeOutro = outro?.nome.trim() || null;
  const fim: FimDoTutorial = opcoes.fim ?? (nomeOutro ? "pronto" : "convidar");
  const ultimo: PassoDoTutorial =
    fim === "pronto"
      ? { id: "fim", titulo: "Pronto", texto: "Vocês já estão na mesma casa. Isso fica em Configurações › Casa." }
      : fim === "esperando"
        ? { id: "fim", titulo: `Falta ${nomeOutro ?? "o par"} entrar`, texto: "Quando o convite for aceito, a casa liga na hora." }
        : { id: "fim", titulo: "Agora, chame seu par", texto: "O par entra de graça, com o app completo." };
  const semPar = fim === "convidar" || fim === "liberar";
  return {
    passos: [
      { id: "cada-um", titulo: "Cada um no seu app", texto: "Cada um com o próprio login e o app completo. A casa junta os dois." },
      { id: "da-casa", titulo: "O que é da casa entra no acerto", texto: "Mercado, aluguel e contas entram sozinhos. Um toque troca. O app aprende." },
      { id: "acerto", titulo: "O acerto do mês", texto: "O app soma o que é da casa e mostra quem manda quanto para quem." },
      { id: "o-que-ve", titulo: `O que ${nomeOutro ?? "o par"} vê`, texto: `${nomeOutro ?? "O par"} vê o que é seu, menos o que for Só meu ou de conta escondida.` },
      { id: "regras", titulo: "Regras rápidas", texto: "Três combinados que valem para os dois." },
      ultimo,
    ],
    regras: ["Só quem gastou edita ou apaga", "Qualquer um pode sair da casa", "Cada um fica com o que é seu"],
    botaoFinal: fim === "convidar" ? "Convidar meu par" : fim === "liberar" ? "Liberar o Casal" : "Pronto",
    preco: semPar && opcoes.preco ? `O Casal custa ${opcoes.preco} por ano, para quem convida.` : null,
  };
}

export const TOTAL_DE_PASSOS_DO_CASAL = 6;

/** Evento que abre o tutorial de qualquer lugar do app (Configurações › Casa, Como funciona). */
export const ABRIR_TUTORIAL_CASAL = "spi:tutorial-casal";

/** Marca do aparelho, para não abrir de novo enquanto o servidor grava. */
export const CHAVE_LOCAL_TUTORIAL_CASAL = "tutorial-casal-visto";

/**
 * Abre sozinho uma vez: quem está numa casa e ainda não viu (nem neste aparelho). Se o "Tivemos
 * uma mudança" ainda vai aparecer, o do casal espera ele terminar (os dois não se cobrem).
 */
export function abreOTutorialDoCasal(p: { naCasa: boolean; vistoNaConta: boolean; vistoNesteAparelho: boolean }): boolean {
  return p.naCasa && !p.vistoNaConta && !p.vistoNesteAparelho;
}

/** Quem já viu, guardado no perfil Casal da titular (ConfigCasal.tutorialVisto): ids das contas. */
export function comVisto(lista: readonly string[] | undefined, userId: string): string[] {
  return [...new Set([...(lista ?? []), userId])].slice(-4);
}
