import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { URL_DO_BANCO } from "./config";

/**
 * O dia simulado da jornada, em três lugares que andam juntos a partir do instante marcado:
 *  - o servidor (Node) lê `.relogio.json` (relogio-de-teste.cjs);
 *  - o banco empurra os carimbos do Prisma pelo desvio em `_jornada_relogio` (relogio-do-banco.sql);
 *  - o navegador usa o relógio do Playwright (page.clock).
 */
export const ARQUIVO_DO_RELOGIO = path.join(__dirname, ".relogio.json");

let agoraSimulado = Date.parse("2026-10-15T09:00:00-03:00");
let banco: PrismaClient | null = null;
function prisma() {
  banco ??= new PrismaClient({ datasourceUrl: URL_DO_BANCO });
  return banco;
}

/** "2026-10-15 09:00" no horário de Brasília. */
export function instante(diaHora: string): number {
  const [d, h = "09:00"] = diaHora.split(" ");
  return Date.parse(`${d}T${h}:00-03:00`);
}

/** Marca o dia no arquivo do servidor e no banco (sem páginas). */
export async function marcarDia(diaHora: string) {
  agoraSimulado = instante(diaHora);
  const real = Date.now();
  fs.writeFileSync(ARQUIVO_DO_RELOGIO, JSON.stringify({ base: agoraSimulado, real }));
  const desvioMs = agoraSimulado - real;
  await prisma().$executeRawUnsafe(`UPDATE "_jornada_relogio" SET desvio = make_interval(secs => ${desvioMs / 1000}) WHERE id = 1`);
}

/** Muda o dia do servidor, do banco e das páginas abertas. */
export async function irPara(diaHora: string, paginas: Page[] = []) {
  await marcarDia(diaHora);
  // O servidor relê o arquivo a cada 50 ms; espera passar com folga.
  await new Promise((r) => setTimeout(r, 150));
  for (const p of paginas) await p.clock.setSystemTime(agoraSimulado);
}

export function hojeSimulado(): number {
  return agoraSimulado;
}

/** Instala o relógio numa página nova (antes do primeiro goto). */
export async function relogioNaPagina(p: Page) {
  await p.clock.install({ time: agoraSimulado });
}

export async function fecharBanco() {
  await banco?.$disconnect();
  banco = null;
}
