import { NOMES_DOS_EVENTOS_DO_COMECO } from "@/lib/onboarding/comeco";

/**
 * Eventos aceitos. Lista fechada de propósito: o cliente não inventa nome de evento, senão o
 * relatório vira um saco de strings e ninguém confia no que está lendo.
 *
 * Os nomeados existem pra medir o que o banco não revela depois. Um gasto digitado e um gasto
 * ditado terminam idênticos na tabela — sem marcar na hora, não dá pra saber se o áudio serve
 * pra alguém.
 */
export const ALLOWED_EVENTS: ReadonlySet<string> = new Set([
  "pageview",
  "registro_voz",
  "registro_digitado",
  "registro_importacao",
  "posso_comprar",
  "conta_a_pagar",
  // 07/10/2026: a tela de assinar do iPhone e o tour de boas-vindas não deixavam rastro nenhum.
  "assinar_apple_viu",
  "assinar_apple_tocou",
  "tour_terminou",
  "tour_pulou",
  // 11/10/2026: o "Tivemos uma mudança" da versão nova.
  "novidades_terminou",
  "novidades_pulou",
  // 13/10/2026: o "Como funciona o casal" (Casal simples).
  "tutorial_casal_terminou",
  "tutorial_casal_pulou",
  // 13/10/2026: o "O casal ficou mais simples" (casa migrada do Nós dois).
  "aviso_casa_migrada_ver",
  "aviso_casa_migrada_agora_nao",
  // 13/10/2026: o "Sua Empresa está pronta" / "O Casal está liberado" (perfil comprado). Ficaram de
  // fora da lista quando o aviso nasceu: cada toque virava 400 no console e o funil não contava.
  "aviso_empresa_comprado_abrir",
  "aviso_empresa_comprado_depois",
  "aviso_casal_comprado_abrir",
  "aviso_casal_comprado_depois",
  // 11/10/2026: o funil do começo (onboarding) da versão nova. O path diz qual pergunta, porta ou
  // banco (ver caminhoDoEvento em lib/onboarding/comeco.ts); nunca o nome nem a renda.
  ...NOMES_DOS_EVENTOS_DO_COMECO,
]);
