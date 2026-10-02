/**
 * A onda de volume do gravador pode abrir um SEGUNDO acesso ao microfone (getUserMedia) junto
 * com o reconhecimento de fala?
 *
 * No Safari (iPhone, iPad e Mac) não: o segundo acesso corta o reconhecimento, que termina com
 * erro "aborted" e a pessoa via "Não foi possível gravar agora" (01/10/2026). Só acontecia da
 * segunda vez em diante, porque a onda só liga quando a permissão já foi dada. Todo navegador
 * do iPhone usa o motor do Safari, inclusive o Chrome de lá (CriOS).
 */
export function ondaPodeAbrirMicrofone(userAgent: string): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return false;
  const safari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(userAgent);
  return !safari;
}
