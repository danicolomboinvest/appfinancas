/**
 * Tamanho máximo de arquivo que a importação aceita.
 *
 * Quem manda neste número não é o app: é a Vercel. Ela recusa qualquer requisição com corpo
 * acima de ~4,5 MB com um 413 ANTES de o servidor rodar — medido em produção: 4 MB passa,
 * 5 MB volta 413. Como a recusa acontece fora do app, nenhum diagnóstico é gravado: a pessoa
 * via "Não consegui enviar o arquivo. Confira a internet e tente de novo." (a culpa caindo na
 * internet dela) e, do nosso lado, a tentativa simplesmente não existia.
 *
 * O app barrava em 7,5 MB e prometia "máx. ~7 MB", então todo arquivo entre 4,5 e 7,5 MB era
 * aceito na tela, enviado, e morria em silêncio. Extrato e fatura de banco em PDF passam desse
 * tamanho com facilidade, e foto de extrato tirada com o celular quase sempre passa.
 *
 * 4 MB, e não 4,5: o envio vai como multipart, que soma as bordas e o nome do arquivo ao corpo.
 * A folga evita que um arquivo de 4,4 MB encoste no teto por causa do embrulho.
 */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/**
 * O que o campo de arquivo do extrato aceita (12/10/2026). O iPhone filtra o seletor de arquivos
 * pelo tipo: com só "text/csv", um CSV salvo pelo WhatsApp, pelo Mail ou baixado do banco (que o
 * iOS marca como "text/comma-separated-values" ou "application/vnd.ms-excel") aparecia apagado
 * e não dava para tocar. Vão as extensões E todos os tipos que esses arquivos costumam ter.
 */
export const ACEITA_ARQUIVO_DE_EXTRATO = [
  ".csv",
  ".ofx",
  ".txt",
  ".xlsx",
  ".xls",
  ".pdf",
  "text/csv",
  "text/comma-separated-values",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "application/x-ofx",
  "application/ofx",
].join(",");
