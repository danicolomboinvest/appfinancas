-- Viagem em assistente: a meta criada pela Viagem guarda o plano da viagem (destinos, dias,
-- pessoas, estilo, mês e valores trocados), para o "Editar" abrir o cartão de embarque.
-- Coluna nova e opcional: as metas que já existem ficam como estão (nulo).
ALTER TABLE "Goal" ADD COLUMN "viagem" JSONB;
