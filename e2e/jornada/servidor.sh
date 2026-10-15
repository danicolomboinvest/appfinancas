#!/bin/sh
# Sobe o app para a jornada: banco local da jornada + relógio de teste (só neste processo).
cd "$(dirname "$0")/../.."
export DATABASE_URL="postgresql://spi:spi_local@localhost:54329/${JORNADA_BANCO:-spi_jornada_teste}"
export SPI_RELOGIO_DE_TESTE="$PWD/e2e/jornada/.relogio.json"
export NODE_OPTIONS="--require $PWD/e2e/jornada/relogio-de-teste.cjs"
export RESUMO_NOVO_HOJE_DE_TESTE=1
export NEXT_TELEMETRY_DISABLED=1
PORTA="${JORNADA_PORTA:-3317}"
if [ "$JORNADA_MODO" = "dev" ]; then exec npx next dev -p "$PORTA"; fi
exec npx next start -p "$PORTA"
