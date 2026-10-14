import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A voz falhou (microfone bloqueado, sem rede, sem entender): a folha oferece o Digitar ali mesmo
 * (14/10/2026). Em produção foram 9 falhas de voz em 4 dias, e a saída era voltar e procurar.
 */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("voz que falha tem saída para o Digitar", () => {
  it("o Registrar passa o caminho do Digitar para o gravador", () => {
    expect(ler("src/components/shell/RegistrarDrawer.tsx")).toMatch(/onDigitar=\{\(\) => setMode\("type"\)\}/);
  });
  it("o gravador mostra o botão quando há erro e quando o aparelho não tem voz", () => {
    const fonte = ler("src/app/(app)/mensal/VoiceRecorder.tsx");
    expect(fonte).toMatch(/errorMessage && onDigitar && <BotaoDigitar/);
    expect(fonte).toMatch(/impVozNaoSuportado[\s\S]{0,120}onDigitar && <BotaoDigitar/);
  });
});
