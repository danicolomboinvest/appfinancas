import { del, get } from "@vercel/blob";
import { ARQUIVO_MAX_BYTES, pastaDoEnvio } from "./limites";

/**
 * Arquivo grande (19/10/2026): acima de 4 MB a Vercel recusa o envio antes de o app rodar, então o
 * aparelho manda o arquivo direto para o armazenamento privado (rota /api/importar/envio) e põe no
 * formulário só o caminho dele ("blob"). Aqui o servidor busca, coloca no lugar de "file" e apaga
 * do armazenamento na hora: o arquivo do banco não fica guardado lá.
 *
 * Só lê da pasta de quem está pedindo (importar/<userId>/): ninguém busca o arquivo de outra pessoa.
 */
export class ArquivoGrandeSumiu extends Error {}

export async function trazerArquivoGrande(formData: FormData, userId: string): Promise<void> {
  const caminho = formData.get("blob");
  if (typeof caminho !== "string" || !caminho) return;
  formData.delete("blob");
  if (!caminho.startsWith(pastaDoEnvio(userId)) || caminho.includes("..")) throw new ArquivoGrandeSumiu("caminho fora da pasta");
  const achado = await get(caminho, { access: "private", useCache: false });
  if (!achado || achado.statusCode !== 200) throw new ArquivoGrandeSumiu("não está no armazenamento");
  if (achado.blob.size > ARQUIVO_MAX_BYTES) {
    await apagar(caminho);
    throw new ArquivoGrandeSumiu("grande demais");
  }
  const bytes = new Uint8Array(await new Response(achado.stream).arrayBuffer());
  await apagar(caminho);
  const nome = String(formData.get("nomeDoArquivo") ?? "") || caminho.split("/").pop() || "arquivo";
  formData.delete("nomeDoArquivo");
  formData.set("file", new File([bytes], nome, { type: achado.blob.contentType || "application/octet-stream" }));
}

async function apagar(caminho: string): Promise<void> {
  try {
    await del(caminho);
  } catch (err) {
    // A faxina diária (cron saude-importacao) apaga o que sobrar.
    console.error("arquivo grande: não consegui apagar do armazenamento", err);
  }
}

/**
 * Faxina (cron diário saude-importacao): o que ficou no armazenamento por mais de 1 hora (o envio
 * subiu mas a leitura nunca veio, ou o apagar falhou) sai. Sem o armazenamento ligado, não faz nada.
 */
export async function apagarArquivosGrandesEsquecidos(agora = Date.now()): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  const { list } = await import("@vercel/blob");
  let apagados = 0;
  let cursor: string | undefined;
  do {
    const pagina = await list({ prefix: "importar/", cursor, limit: 500 });
    const velhos = pagina.blobs.filter((b) => agora - new Date(b.uploadedAt).getTime() > 3_600_000).map((b) => b.url);
    if (velhos.length) {
      await del(velhos);
      apagados += velhos.length;
    }
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return apagados;
}
