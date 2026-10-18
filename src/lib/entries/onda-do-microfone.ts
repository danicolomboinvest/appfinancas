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

/**
 * A onda sem o segundo microfone (18/10/2026, a Dani: "no app ela fica parada, parece que não está
 * ouvindo"). No iPhone a onda não pode abrir o microfone (acima), então ela reage ao que o próprio
 * reconhecimento de fala avisa: cada pedaço de frase entendido (resultado parcial) e o começo da
 * fala dão um empurrão de energia, que vai caindo sozinho em ~0,5 s. Calada, a onda só respira
 * baixinho. Não é o volume de verdade, é "estou ouvindo você".
 */
export const ENERGIA_DO_EMPURRAO = 1;
const MEIA_VIDA_MS = 260;

/** Quanto sobra da energia depois de `ms` milissegundos. */
export function energiaDepois(energia: number, ms: number): number {
  return Math.max(0, energia * Math.pow(0.5, Math.max(0, ms) / MEIA_VIDA_MS));
}

/**
 * A altura (0,08 a 1) da barra `i` no instante `t` (ms) com a energia de agora. Duas ondas de
 * seno com fases diferentes por barra fazem o desenho mudar o tempo todo, sem sorteio (o mesmo
 * instante dá sempre a mesma onda, o que deixa testar).
 */
export function alturaDaBarra(i: number, t: number, energia: number): number {
  const respira = 0.1 + 0.03 * Math.sin(t / 420 + i * 0.5);
  const mexe = 0.5 + 0.3 * Math.sin(t / 95 + i * 1.7) + 0.2 * Math.sin(t / 61 + i * 0.9);
  const centro = 1 - Math.abs(i - 13.5) / 20; // o meio sobe mais que as pontas, como na voz
  return Math.min(1, Math.max(0.08, respira + Math.min(1, energia) * mexe * centro));
}
