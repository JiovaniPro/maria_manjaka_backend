/*
  Warnings:

  - Made the column `sous_categorie_id` on table `transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_sous_categorie_id_fkey";

-- AlterTable
ALTER TABLE "transaction" ALTER COLUMN "sous_categorie_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_sous_categorie_id_fkey" FOREIGN KEY ("sous_categorie_id") REFERENCES "sous_categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
