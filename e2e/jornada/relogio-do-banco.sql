-- Relógio de teste do BANCO da jornada (só em spi_jornada_teste, criado por preparar.ts).
-- O Prisma preenche @default(now()) e @updatedAt no motor dele, com a hora real, fora do alcance
-- do relógio de teste do Node. Este gatilho empurra para o dia simulado todo carimbo que chega
-- "agora" (até 10 s da hora real); datas que o app calculou (já no dia simulado) ficam como estão.
CREATE TABLE IF NOT EXISTS "_jornada_relogio" (id int PRIMARY KEY, desvio interval NOT NULL);
INSERT INTO "_jornada_relogio" VALUES (1, interval '0') ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION _jornada_carimbo() RETURNS trigger AS $$
DECLARE
  d interval;
  agora timestamp := clock_timestamp() AT TIME ZONE 'UTC';
  col text;
  v timestamp;
  novo jsonb := to_jsonb(NEW);
  mudou boolean := false;
BEGIN
  SELECT desvio INTO d FROM "_jornada_relogio" WHERE id = 1;
  IF d IS NULL OR d = interval '0' THEN RETURN NEW; END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF novo ? col AND novo->>col IS NOT NULL THEN
      v := (novo->>col)::timestamp;
      IF abs(extract(epoch FROM v - agora)) < 10 THEN
        IF TG_OP = 'UPDATE' AND col = 'createdAt' THEN CONTINUE; END IF;
        novo := jsonb_set(novo, ARRAY[col], to_jsonb(v + d));
        mudou := true;
      END IF;
    END IF;
  END LOOP;
  IF mudou THEN NEW := jsonb_populate_record(NEW, novo); END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name, array_agg(c.column_name::text) AS cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.data_type LIKE 'timestamp%' AND c.table_name NOT LIKE '\_%'
    GROUP BY c.table_name
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS _jornada_carimbo ON %I', t.table_name);
    EXECUTE format('CREATE TRIGGER _jornada_carimbo BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION _jornada_carimbo(%s)',
      t.table_name, (SELECT string_agg(quote_literal(x), ',') FROM unnest(t.cols) x));
  END LOOP;
END $$;
