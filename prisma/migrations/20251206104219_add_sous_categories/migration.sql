-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "sous_categorie_id" INTEGER,
ALTER COLUMN "description" DROP NOT NULL;

-- CreateTable
CREATE TABLE "sous_categorie" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "categorie_id" INTEGER NOT NULL,
    "statut" "Statut" NOT NULL DEFAULT 'ACTIF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_categorie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sous_categorie_categorie_id_idx" ON "sous_categorie"("categorie_id");

-- CreateIndex
CREATE INDEX "sous_categorie_statut_idx" ON "sous_categorie"("statut");

-- CreateIndex
CREATE INDEX "transaction_sous_categorie_id_idx" ON "transaction"("sous_categorie_id");

-- AddForeignKey
ALTER TABLE "sous_categorie" ADD CONSTRAINT "sous_categorie_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_sous_categorie_id_fkey" FOREIGN KEY ("sous_categorie_id") REFERENCES "sous_categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
