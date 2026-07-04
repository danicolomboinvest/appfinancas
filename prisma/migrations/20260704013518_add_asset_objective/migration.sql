-- CreateEnum
CREATE TYPE "AssetObjective" AS ENUM ('RESERVA_EMERGENCIA', 'LIBERDADE_FINANCEIRA', 'META', 'OUTRO');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "objective" "AssetObjective" NOT NULL DEFAULT 'OUTRO';
