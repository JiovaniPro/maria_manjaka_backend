-- CreateEnum
CREATE TYPE "TypeTransaction" AS ENUM ('RECETTE', 'DEPENSE');

-- CreateEnum
CREATE TYPE "TypeCompte" AS ENUM ('CAISSE', 'BANQUE');

-- CreateEnum
CREATE TYPE "Statut" AS ENUM ('ACTIF', 'INACTIF');

-- CreateEnum
CREATE TYPE "TypeTransactionBancaire" AS ENUM ('RETRAIT', 'DEPOT');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mot_de_passe" VARCHAR(255) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorie" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "code_budgetaire" VARCHAR(20) NOT NULL,
    "type" "TypeTransaction" NOT NULL,
    "statut" "Statut" NOT NULL DEFAULT 'ACTIF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compte" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(50) NOT NULL,
    "type" "TypeCompte" NOT NULL,
    "solde_actuel" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" SERIAL NOT NULL,
    "categorie_id" INTEGER NOT NULL,
    "compte_id" INTEGER NOT NULL,
    "date_transaction" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "montant" DECIMAL(15,2) NOT NULL,
    "type" "TypeTransaction" NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_bancaire" (
    "id" SERIAL NOT NULL,
    "compte_id" INTEGER NOT NULL,
    "date_operation" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "montant" DECIMAL(15,2) NOT NULL,
    "type" "TypeTransactionBancaire" NOT NULL,
    "numero_cheque" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_bancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametre" (
    "id" SERIAL NOT NULL,
    "cle" VARCHAR(50) NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "table_name" VARCHAR(50) NOT NULL,
    "record_id" INTEGER NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categorie_code_budgetaire_key" ON "categorie"("code_budgetaire");

-- CreateIndex
CREATE INDEX "categorie_code_budgetaire_idx" ON "categorie"("code_budgetaire");

-- CreateIndex
CREATE INDEX "categorie_type_statut_idx" ON "categorie"("type", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "compte_nom_key" ON "compte"("nom");

-- CreateIndex
CREATE INDEX "compte_type_idx" ON "compte"("type");

-- CreateIndex
CREATE INDEX "transaction_categorie_id_idx" ON "transaction"("categorie_id");

-- CreateIndex
CREATE INDEX "transaction_compte_id_idx" ON "transaction"("compte_id");

-- CreateIndex
CREATE INDEX "transaction_created_by_idx" ON "transaction"("created_by");

-- CreateIndex
CREATE INDEX "transaction_date_transaction_idx" ON "transaction"("date_transaction");

-- CreateIndex
CREATE INDEX "transaction_type_idx" ON "transaction"("type");

-- CreateIndex
CREATE INDEX "transaction_bancaire_compte_id_idx" ON "transaction_bancaire"("compte_id");

-- CreateIndex
CREATE INDEX "transaction_bancaire_date_operation_idx" ON "transaction_bancaire"("date_operation");

-- CreateIndex
CREATE INDEX "transaction_bancaire_type_idx" ON "transaction_bancaire"("type");

-- CreateIndex
CREATE UNIQUE INDEX "parametre_cle_key" ON "parametre"("cle");

-- CreateIndex
CREATE INDEX "parametre_cle_idx" ON "parametre"("cle");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_table_name_record_id_idx" ON "audit_log"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_bancaire" ADD CONSTRAINT "transaction_bancaire_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
