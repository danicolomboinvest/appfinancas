/**
 * A voz de cada tema: o que o app DIZ, não como ele pinta.
 *
 * É aqui que Girly vira Girly. A Dani apontou que tema só de cor "dá na mesma" — a pessoa já
 * escolhia a cor. O que separa um tema do outro é o texto: "Amiga, R$ 9.510 guardados! 💖"
 * contra "Você economizou R$ 9.510 este mês. 31% da renda." sobre o MESMO número.
 *
 * Duas regras que valem pros sete, as duas dela:
 *
 * 1. A frase muda com o ESTADO do mês, não só com o momento. "É pouco? Sim" só pode aparecer
 *    se for pouco. Então toda frase de resultado recebe bom/normal/ruim, calculado dos números
 *    antes de qualquer tema abrir a boca (ver `estadoDoMes`).
 * 2. A cobrança fala do NÚMERO, nunca da pessoa. "Você gastou mais do que ganhou" é sobre o
 *    mês. "Você é péssima com dinheiro" é sobre ela — e essa frase não existe em tema nenhum,
 *    nem no Sem filtro. O teste procura por adjetivo sobre a pessoa na coluna ruim.
 *
 * O Padrão está aqui com as frases EXATAS que o app já tinha, pra ele continuar como é hoje.
 * Se alguém mudar a frase no componente e esquecer aqui, o teste do Padrão cai.
 *
 * Texto puro, sem React, sem banco: dá pra testar cada frase de cada tema em cada estado.
 */


import type { ProfileThemeKey } from "./themes";
import { profileTheme } from "./themes";
import { ehEmpresa } from "./empresa";
import { comCamadaDaEmpresa } from "./vozes/empresa";
import type { ProfileKind } from "@prisma/client";
import type { Periodo, Voz } from "./voice-base";
import { padrao } from "./vozes/padrao";
import { girly } from "./vozes/girly";
import { minimalista } from "./vozes/minimalista";
import { disciplina } from "./vozes/disciplina";
import { semfiltro } from "./vozes/semfiltro";
import { game } from "./vozes/game";
import { manifestacao } from "./vozes/manifestacao";

export type { Estado, Periodo, Ritmo, SituacaoOrcamento, Money, Voz, Titulos } from "./voice-base";
export { estadoDoMes, estadoParaFrase } from "./voice-base";

const VOZES: Record<ProfileThemeKey, Voz> = { padrao, girly, minimalista, disciplina, semfiltro, game, manifestacao };

/** A voz do tema. Chave desconhecida fala como o Padrão, igual à paleta. */
/**
 * A voz de um perfil: o tema escolhe o jeito de falar; o TIPO do perfil escolhe do que se
 * fala. Um perfil Empresa no tema Girly continua fofo, mas diz "Faturou" e "Lucro" em vez
 * de "Entrou" e "Sobrou pra você". A camada da empresa só troca o vocabulário de negócio;
 * saudação, frases de estado e piadas continuam do tema.
 */
export function vozDoTema(key: string | null | undefined, kind?: ProfileKind | string | null): Voz {
  const base = VOZES[profileTheme(key).key];
  if (!ehEmpresa(kind)) return base;
  const cache = COM_EMPRESA.get(base);
  if (cache) return cache;
  const voz = comCamadaDaEmpresa(base);
  COM_EMPRESA.set(base, voz);
  return voz;
}
const COM_EMPRESA = new WeakMap<Voz, Voz>();

/** Manhã, tarde ou noite — a mesma régua que a saudação do app sempre usou. */
export function periodoDoDia(hora: number): Periodo {
  if (hora >= 5 && hora < 12) return "manha";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noite";
}
