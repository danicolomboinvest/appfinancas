-- A taxa em que ela comprou o título de renda fixa (decisão da dona, 11/10/2026). Aditiva e
-- opcional: em fração, lida com o indexador do ativo (prefixado ao ano, IPCA + x, % do CDI).
ALTER TABLE "Asset" ADD COLUMN "taxaCompra" DECIMAL(10,6);
