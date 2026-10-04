/**
 * Criptografia do backup (04/10/2026).
 *
 * O backup saía em JSON aberto no Mac e no iCloud (a pasta Documentos também sobe pro iCloud),
 * com os dados financeiros de todo mundo. Agora cada backup vira UM arquivo `.tar.gz.enc`,
 * cifrado com AES-256-GCM. A chave mora só no Mac, em ~/.config/spi-finance/backup.key, fora do
 * iCloud: quem pegar o arquivo na nuvem não abre nada sem ela.
 *
 * SEM A CHAVE NÃO HÁ RESTORE. Guarde uma cópia dela no gerenciador de senhas.
 *
 * Formato: "SPIBK1" (6 bytes) + IV (12) + dados cifrados + tag de autenticação (16).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export const CHAVE_PADRAO = path.join(os.homedir(), ".config", "spi-finance", "backup.key");
const MAGICO = Buffer.from("SPIBK1");
const TAM_IV = 12;
const TAM_TAG = 16;

/** Lê a chave (64 caracteres hex). Com `criar`, gera uma na primeira vez, só legível pela dona. */
export function carregarChave({ criar = false, arquivo = process.env.SPI_BACKUP_KEY_FILE || CHAVE_PADRAO } = {}) {
  if (!fs.existsSync(arquivo)) {
    if (!criar) throw new Error(`Chave do backup não encontrada em ${arquivo}. Sem ela não dá para abrir o backup.`);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true, mode: 0o700 });
    fs.writeFileSync(arquivo, crypto.randomBytes(32).toString("hex") + "\n", { mode: 0o600, flag: "wx" });
  }
  const hex = fs.readFileSync(arquivo, "utf8").trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`A chave em ${arquivo} não tem o formato esperado.`);
  return Buffer.from(hex, "hex");
}

export async function cifrarArquivo(entrada, saida, chave) {
  const iv = crypto.randomBytes(TAM_IV);
  const cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const temporario = `${saida}.parcial`;
  const destino = fs.createWriteStream(temporario);
  destino.write(Buffer.concat([MAGICO, iv]));
  await pipeline(fs.createReadStream(entrada), cifra, destino, { end: false }).catch(async (e) => {
    destino.destroy();
    throw e;
  });
  await new Promise((ok, erro) => destino.end(cifra.getAuthTag(), (e) => (e ? erro(e) : ok())));
  // Só ganha o nome final depois de completo: arquivo pela metade nunca parece backup bom.
  fs.renameSync(temporario, saida);
}

export async function decifrarArquivo(entrada, saida, chave) {
  const tamanho = fs.statSync(entrada).size;
  const inicio = MAGICO.length + TAM_IV;
  if (tamanho < inicio + TAM_TAG) throw new Error("Arquivo de backup curto demais: está corrompido.");
  const fd = fs.openSync(entrada, "r");
  const cabecalho = Buffer.alloc(inicio);
  const tag = Buffer.alloc(TAM_TAG);
  fs.readSync(fd, cabecalho, 0, inicio, 0);
  fs.readSync(fd, tag, 0, TAM_TAG, tamanho - TAM_TAG);
  fs.closeSync(fd);
  if (!cabecalho.subarray(0, MAGICO.length).equals(MAGICO)) throw new Error("Isto não é um backup cifrado do SPI Finance.");
  const decifra = crypto.createDecipheriv("aes-256-gcm", chave, cabecalho.subarray(MAGICO.length));
  decifra.setAuthTag(tag);
  // A tag só confere no fim: se a chave estiver errada ou o arquivo mexido, isto lança erro.
  await pipeline(fs.createReadStream(entrada, { start: inicio, end: tamanho - TAM_TAG - 1 }), decifra, fs.createWriteStream(saida));
}
