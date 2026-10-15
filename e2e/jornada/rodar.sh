#!/bin/sh
# npm run test:jornada: banco limpo, build (pula com JORNADA_SEM_BUILD=1), servidor com o relógio
# de teste e as jornadas. Tudo local (Postgres na 54329, app na 3317). Nada vai para produção.
set -e
cd "$(dirname "$0")/../.."
export JORNADA_PORTA="${JORNADA_PORTA:-3317}"
if lsof -nP -iTCP:"$JORNADA_PORTA" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Já tem um servidor na porta $JORNADA_PORTA: a jornada vai usar ele (o relógio de teste precisa estar ligado nele)."
elif [ "$JORNADA_SEM_BUILD" != "1" ] && [ "$JORNADA_MODO" != "dev" ]; then
  echo "Build do app (uns 30 s)..."
  npx next build > .next-jornada-build.log 2>&1 || { tail -30 .next-jornada-build.log; exit 1; }
  rm -f .next-jornada-build.log
fi
npx tsx e2e/jornada/preparar.ts
rm -rf .jornada-resultados
npx playwright test -c e2e/jornada "$@"
