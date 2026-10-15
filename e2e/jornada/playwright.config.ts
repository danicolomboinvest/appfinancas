import { defineConfig, devices } from "@playwright/test";
import { BASE } from "./config";

// Jornada de uma semana de uso (e2e/jornada/LEIA-ME no CLAUDE.md do projeto).
// Roda com `npm run test:jornada`, que prepara o banco antes (e2e/jornada/preparar.ts).
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.jornada\.ts$/,
  // Uma cliente de cada vez: as jornadas mexem no relógio do servidor, que é um só.
  workers: 1,
  fullyParallel: false,
  timeout: 6 * 60_000,
  expect: { timeout: 15_000 },
  outputDir: "../../.jornada-resultados",
  reporter: [["list"], ["json", { outputFile: "../../.jornada-resultados/resultado.json" }]],
  use: {
    baseURL: BASE,
    ...devices["iPhone 13"],
    // Chromium em todos (o Playwright já tem ele no Mac); tamanho de celular pequeno.
    browserName: "chromium",
    viewport: { width: 375, height: 812 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "sh e2e/jornada/servidor.sh",
    cwd: "../..",
    url: `${BASE}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
