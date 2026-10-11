/**
 * Prévia dos e-mails, sem enviar nada: escreve o HTML de cada e-mail nos quatro temas, com os
 * números da Ana canônica (src/lib/email/exemplos.ts), numa pasta.
 *
 *   npx tsx scripts/previa-emails.ts /caminho/da/pasta
 *
 * Cada arquivo sai como <email>-<tema>.html, mais um assuntos.json com o assunto de cada um.
 * Para ver no escuro, abra no navegador com o modo escuro do sistema ligado.
 */
import fs from "node:fs";
import path from "node:path";
import { exemplosDeEmail } from "@/lib/email/exemplos";
import { PROFILE_THEMES } from "@/lib/profiles/themes";

const pasta = process.argv[2];
if (!pasta) {
  console.error("Uso: npx tsx scripts/previa-emails.ts <pasta>");
  process.exit(1);
}
fs.mkdirSync(pasta, { recursive: true });
const assuntos: { arquivo: string; assunto: string }[] = [];
for (const { key } of PROFILE_THEMES) {
  for (const { nome, email } of exemplosDeEmail(key)) {
    const arquivo = `${nome}-${key}.html`;
    fs.writeFileSync(path.join(pasta, arquivo), email.html);
    assuntos.push({ arquivo, assunto: email.subject });
  }
}
fs.writeFileSync(path.join(pasta, "assuntos.json"), JSON.stringify(assuntos, null, 2));
console.log(`${assuntos.length} e-mails em ${pasta}`);
