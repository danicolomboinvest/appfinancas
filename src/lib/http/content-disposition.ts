/**
 * Cabeçalho de download que aceita qualquer nome de arquivo.
 *
 * Cabeçalho HTTP só carrega bytes até 0xFF. Nome que vem do iPhone/Mac com acento decomposto
 * ("março" como "c" + cedilha solta), travessão ou emoji fazia o NextResponse lançar
 * "Cannot convert argument to a ByteString" e o download dava 500 — justamente nos arquivos
 * que falharam e precisam ser lidos. Então vão dois nomes: um em ASCII puro, que qualquer
 * navegador entende, e o original codificado (RFC 5987), que os navegadores atuais preferem.
 */
export function contentDispositionAttachment(nome: string): string {
  // Surrogate solto (nome cortado no meio de um emoji pelo slice de 200) faz o
  // encodeURIComponent lançar: vira o caractere de substituição antes.
  const bemFormado = nome.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
  const ascii =
    bemFormado
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // "ç" decomposto vira "c", não "_"
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "")
      .trim() || "arquivo";
  // encodeURIComponent deixa passar ' ( ) * !, que não valem no filename* da RFC 5987.
  const codificado = encodeURIComponent(bemFormado).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}
