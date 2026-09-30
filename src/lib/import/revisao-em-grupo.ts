import { normalizeMerchant, padraoAprendivel } from "./classify";

/**
 * A revisão da importação decidindo os IGUAIS de uma vez.
 *
 * Antes cada linha pedia o seu toque: cinco Pix pra mesma pessoa eram cinco perguntas iguais, e
 * trocar a categoria do iFood na conferência mudava só aquele iFood. O app já sabia que eram a
 * mesma coisa (é a mesma chave que ele usa pra aprender pra próxima importação), só não usava
 * isso dentro da importação.
 *
 * Puro, sem React: a tela chama e aplica o resultado.
 */

/** O mínimo de uma linha da revisão que esta lógica precisa (ReviewItem tem tudo isso). */
export type LinhaDaRevisao = {
  key: number;
  description: string;
  category: string;
  parentCategory: string | null;
  customCategoryId: string | null;
  autoClassified: boolean;
  profileId: string | null;
  ignorar?: boolean;
  duvida?: string | null;
};

/**
 * A chave que diz "é o mesmo lugar": a mesma do aprendizado (normalizeMerchant). Chave genérica
 * demais ("no", "enviado", de "Compra no débito" e "PIX ENVIADO") não junta nada — juntaria todo
 * Pix e toda compra no débito numa categoria só, que é justamente o que o aprendizado evita.
 */
export function chaveDeIguais(description: string): string | null {
  const chave = normalizeMerchant(description);
  return chave && padraoAprendivel(chave) ? chave : null;
}

/** Gasto que ainda não tem categoria nenhuma (nem a fixa, nem a que ela criou). */
export function semCategoria(it: LinhaDaRevisao): boolean {
  return it.category === "EXPENSE" && !it.parentCategory && !it.customCategoryId;
}

/**
 * As OUTRAS linhas que devem receber a categoria que ela acabou de escolher pra `alvoKey`: mesma
 * chave, também gasto, no mesmo perfil de destino, ainda sem categoria ou com a categoria que o
 * app pôs sozinho. O que ELA já escolheu numa linha nunca é sobrescrito, nem o que ficou de fora
 * ou ainda é pergunta ("isso é dinheiro seu mudando de lugar?").
 */
export function iguaisPraAplicar<T extends LinhaDaRevisao>(items: T[], alvoKey: number): number[] {
  const alvo = items.find((it) => it.key === alvoKey);
  if (!alvo) return [];
  const chave = chaveDeIguais(alvo.description);
  if (!chave) return [];
  return items
    .filter(
      (it) =>
        it.key !== alvoKey &&
        it.category === "EXPENSE" &&
        !it.ignorar &&
        !it.duvida &&
        (it.profileId ?? null) === (alvo.profileId ?? null) &&
        (semCategoria(it) || it.autoClassified) &&
        chaveDeIguais(it.description) === chave,
    )
    .map((it) => it.key);
}

/**
 * A próxima posição da fila que ainda precisa de resposta, depois de `atual`. Os iguais que
 * ganharam categoria junto com o anterior são pulados: perguntar de novo o que ela acabou de
 * responder é o que fazia a revisão parecer infinita. `null` = acabou a fila.
 */
export function proximaPendente(fila: number[], atual: number, pendente: (key: number) => boolean): number | null {
  for (let i = atual + 1; i < fila.length; i += 1) {
    if (pendente(fila[i])) return i;
  }
  return null;
}
