import net from "node:net";

/**
 * Uma caixa de e-mail SÓ LOCAL para a jornada: um servidor SMTP mínimo em 127.0.0.1 que aceita
 * tudo e guarda as mensagens na memória. O app da jornada é ligado a ele por SMTP_HOST=127.0.0.1 e
 * SMTP_PORT=JORNADA_SMTP_PORTA (servidor.sh herda o ambiente). Nada sai da máquina.
 */
export type EmailRecebido = { para: string; assunto: string; corpo: string };

export function abrirCaixaLocal(porta: number): { recebidos: EmailRecebido[]; fechar: () => Promise<void> } {
  const recebidos: EmailRecebido[] = [];
  const servidor = net.createServer((s) => {
    let dados = false;
    let buffer = "";
    let para = "";
    s.write("220 caixa-local ESMTP\r\n");
    s.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (dados) {
          const fim = buffer.indexOf("\r\n.\r\n");
          if (fim < 0) return;
          const msg = buffer.slice(0, fim);
          buffer = buffer.slice(fim + 5);
          dados = false;
          const assunto = /^Subject: (.*(?:\r\n[ \t].*)*)/im.exec(msg)?.[1]?.replace(/\r\n[ \t]/g, " ") ?? "";
          recebidos.push({ para, assunto: decodificar(assunto), corpo: msg });
          s.write("250 ok\r\n");
          continue;
        }
        const i = buffer.indexOf("\r\n");
        if (i < 0) return;
        const linha = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const cmd = linha.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") s.write("250-caixa-local\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (cmd === "HELO") s.write("250 caixa-local\r\n");
        else if (cmd === "AUTH") s.write(/^AUTH PLAIN \S+/i.test(linha) ? "235 ok\r\n" : "334 \r\n");
        else if (linha.length > 12 && /^[A-Za-z0-9+/=]+$/.test(linha)) s.write("235 ok\r\n");
        else if (cmd === "MAIL") s.write("250 ok\r\n");
        else if (cmd === "RCPT") {
          para = /<([^>]+)>/.exec(linha)?.[1] ?? "";
          s.write("250 ok\r\n");
        } else if (cmd === "DATA") {
          dados = true;
          s.write("354 manda\r\n");
        } else if (cmd === "QUIT") {
          s.write("221 tchau\r\n");
          s.end();
        } else s.write("250 ok\r\n");
      }
    });
    s.on("error", () => undefined);
  });
  servidor.listen(porta, "127.0.0.1");
  return { recebidos, fechar: () => new Promise((r) => servidor.close(() => r())) };
}

/** "=?UTF-8?B?...?=" e "=?UTF-8?Q?...?=" de volta para texto. */
function decodificar(s: string): string {
  return s.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, tipo: string, t: string) =>
    tipo.toLowerCase() === "b" ? Buffer.from(t, "base64").toString("utf8") : Buffer.from(t.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"),
  ).replace(/\?=\s+=\?/g, "");
}
