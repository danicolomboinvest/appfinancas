-- Conta a pagar e assinatura com categoria personalizada (30/10/2026): aditiva. Uma coluna
-- opcional na conta apontando para a CustomCategory dela; apagar a categoria só zera a coluna
-- (ON DELETE SET NULL), a conta fica. Nada do que existe muda.
ALTER TABLE "ContaAPagar" ADD COLUMN "customCategoryId" TEXT;

ALTER TABLE "ContaAPagar" ADD CONSTRAINT "ContaAPagar_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "CustomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
