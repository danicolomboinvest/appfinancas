#!/bin/bash
# Envelope do backup diário, chamado pelo agendador do macOS (launchd).
#
# Existe por dois motivos: o launchd roda com um PATH quase vazio (não acha o node do nvm), e um
# backup que falha calado é pior que não ter backup — então tudo vai pro log, com data.
#
# O log fica em ~/Library/Logs e NÃO em Documentos: o macOS bloqueia o acesso do bash a
# Documentos quando quem chama é o launchd ("Operation not permitted"), e aí o próprio registro
# de erro sumia. Quem escreve dentro de Documentos é o node, que tem a permissão.
set -uo pipefail

PROJETO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$HOME/Library/Logs/spi-finance-backup.log"
mkdir -p "$(dirname "$LOG")"

# Procura o node: o do nvm (versão mais nova), depois os lugares comuns do Homebrew/sistema.
NODE="$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1)"
[ -x "${NODE:-}" ] || NODE="$(command -v node || true)"
for tentativa in /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "${NODE:-}" ] && break
  [ -x "$tentativa" ] && NODE="$tentativa"
done

if [ ! -x "${NODE:-}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M')] FALHOU: não encontrei o node no Mac." >> "$LOG"
  exit 1
fi

cd "$PROJETO" || exit 1
SAIDA="$("$NODE" --env-file=.env scripts/backup-db.mjs 2>&1)"
STATUS=$?

if [ $STATUS -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M')] OK — $(echo "$SAIDA" | tail -1)" >> "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M')] FALHOU (código $STATUS):" >> "$LOG"
  echo "$SAIDA" | sed 's/^/    /' >> "$LOG"
fi
exit $STATUS
