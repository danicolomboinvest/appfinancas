// Configuração única da jornada (e2e/jornada). Tudo local: Postgres na 54329 e o app na 3317.
// JORNADA_BANCO: outro banco quando duas worktrees rodam a jornada ao mesmo tempo.
export const BANCO = process.env.JORNADA_BANCO ?? "spi_jornada_teste";
// O nome entra num DROP DATABASE: só nomes da jornada.
if (!/^spi_jornada_[a-z0-9_]+$/.test(BANCO)) throw new Error(`JORNADA_BANCO inválido: ${BANCO}`);
export const URL_ADMIN = "postgresql://spi:spi_local@localhost:54329/postgres";
export const URL_DO_BANCO = `postgresql://spi:spi_local@localhost:54329/${BANCO}`;
export const PORTA = Number(process.env.JORNADA_PORTA ?? 3317);
export const BASE = `http://localhost:${PORTA}`;
// Senha das contas de teste (só existem no banco local; a mesma de scripts/semear-local.ts).
export const SENHA = "senha-de-teste-local";
// O dia em que as contas semeadas nascem (antes do primeiro dia da jornada).
export const INICIO_DA_SEMEADURA = "2026-10-14 20:00";
