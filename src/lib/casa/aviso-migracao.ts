/**
 * "O casal ficou mais simples" (pedido da dona em 13/10/2026): o aviso para quem teve a casa
 * passada do "Nós dois" antigo para o Casal simples (MembroCasal.modelo = "simples" com
 * migradoEm preenchido). Aparece uma vez para a titular e uma vez para o par, ANTES do "Como
 * funciona o casal", e termina com "Ver como funciona" (abre o tutorial) ou "Agora não".
 *
 * Texto puro, sem React e sem banco, para dar para testar. Sem travessão, sem emoji, sem gênero
 * e "para", nunca "pra".
 */

export type IconeDoPonto = "app" | "casa" | "completo" | "bolinha" | "acerto";

export type PontoDoAviso = { icone: IconeDoPonto; texto: string };

export type TextosDoAvisoDaMigracao = {
  titulo: string;
  /** No máximo quatro, cada um com o seu ícone. */
  pontos: PontoDoAviso[];
  rodape: string;
  ver: string;
  agoraNao: string;
};

export function textosDoAvisoDaMigracao(papel: "titular" | "par"): TextosDoAvisoDaMigracao {
  return {
    titulo: "O casal ficou mais simples",
    pontos: [
      { icone: "app", texto: "Não tem mais o perfil Nós dois. Tudo fica no seu app." },
      papel === "titular"
        ? { icone: "casa", texto: "As contas da casa foram para o seu Pessoal, marcadas como Da casa. O orçamento veio junto." }
        : { icone: "completo", texto: "Agora você tem o seu app completo, com o seu resumo e os seus cartões." },
      { icone: "bolinha", texto: "Os gastos de vocês dois aparecem juntos, com a bolinha de quem gastou." },
      { icone: "acerto", texto: "O acerto do mês fica no Resumo. Quer esconder algo? Toque em Só meu." },
    ],
    rodape: "Nada se perdeu.",
    ver: "Ver como funciona",
    agoraNao: "Agora não",
  };
}

/** Marca do aparelho, para não abrir de novo enquanto o servidor grava. */
export const CHAVE_LOCAL_AVISO_MIGRACAO = "aviso-casa-migrada-visto";

/**
 * O que abre sozinho ao entrar, um de cada vez: o aviso da migração vem antes do "Como funciona
 * o casal". Quem tem a casa migrada e ainda não viu o aviso vê só o aviso (o tutorial abre pelo
 * "Ver como funciona"); o "Agora não" fecha os dois. Casa criada já no simples e quem não tem
 * casa nunca veem o aviso. "Visto" junta a marca da conta e a do aparelho.
 */
export function oQueAbreSozinho(p: { naCasa: boolean; migrada: boolean; avisoVisto: boolean; tutorialVisto: boolean }): "aviso" | "tutorial" | null {
  if (!p.naCasa) return null;
  if (p.migrada && !p.avisoVisto) return "aviso";
  if (!p.tutorialVisto) return "tutorial";
  return null;
}
