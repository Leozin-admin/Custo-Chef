/*
  Warnings:

  - You are about to drop the column `altura` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the column `peso` on the `Usuario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "altura",
DROP COLUMN "meta",
DROP COLUMN "peso";

-- CreateTable
CREATE TABLE "Restaurante" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "Restaurante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingrediente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "precoPorUnidade" DOUBLE PRECISION NOT NULL,
    "restauranteId" INTEGER NOT NULL,

    CONSTRAINT "Ingrediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prato" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "precoVenda" DOUBLE PRECISION NOT NULL,
    "restauranteId" INTEGER NOT NULL,

    CONSTRAINT "Prato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichaTecnica" (
    "id" SERIAL NOT NULL,
    "pratoId" INTEGER NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FichaTecnica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurante_usuarioId_key" ON "Restaurante"("usuarioId");

-- AddForeignKey
ALTER TABLE "Restaurante" ADD CONSTRAINT "Restaurante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingrediente" ADD CONSTRAINT "Ingrediente_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prato" ADD CONSTRAINT "Prato_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaTecnica" ADD CONSTRAINT "FichaTecnica_pratoId_fkey" FOREIGN KEY ("pratoId") REFERENCES "Prato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaTecnica" ADD CONSTRAINT "FichaTecnica_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "Ingrediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
