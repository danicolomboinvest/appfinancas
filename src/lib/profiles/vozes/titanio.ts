import { padrao } from "./padrao";
import type { Voz } from "../voice-base";

/**
 * A voz do Titânio (versão nova, 11/10/2026): calma, adulta e com os pés no chão. Fala como o
 * Padrão, direto ao número, sem apelido nem comemoração; o que muda é a roupa (metal escovado
 * com laranja nos detalhes). Quem vinha do Disciplina ou do Game cai aqui.
 */
export const titanio: Voz = { ...padrao };
