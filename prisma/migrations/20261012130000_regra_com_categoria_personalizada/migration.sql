-- Aditiva: a regra aprendida passa a guardar a categoria personalizada que ela escolheu
-- ("Dani Invest" para o ManyChat). Sem isso, a escolha era esquecida e perguntada todo mês.
ALTER TABLE "TransactionCategoryRule" ADD COLUMN "customCategoryId" TEXT;

ALTER TABLE "TransactionCategoryRule"
  ADD CONSTRAINT "TransactionCategoryRule_customCategoryId_fkey"
  FOREIGN KEY ("customCategoryId") REFERENCES "CustomCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
