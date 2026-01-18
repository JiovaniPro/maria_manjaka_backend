-- CreateEnum
CREATE TYPE "RoleUser" AS ENUM ('ADMIN', 'SECRETAIRE');

-- AlterEnum
ALTER TYPE "TypeCompte" ADD VALUE 'SECRETAIRE';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "compte_secretaire_id" INTEGER,
ADD COLUMN     "role" "RoleUser" NOT NULL DEFAULT 'ADMIN';

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_compte_secretaire_id_fkey" FOREIGN KEY ("compte_secretaire_id") REFERENCES "compte"("id") ON DELETE SET NULL ON UPDATE CASCADE;
