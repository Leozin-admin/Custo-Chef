-- CreateTable
CREATE TABLE "IngredienteFornecedor" (
    "id" SERIAL NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "fornecedorId" INTEGER NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredienteFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredienteFornecedor_ingredienteId_fornecedorId_key" ON "IngredienteFornecedor"("ingredienteId", "fornecedorId");

-- AddForeignKey
ALTER TABLE "IngredienteFornecedor" ADD CONSTRAINT "IngredienteFornecedor_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "Ingrediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredienteFornecedor" ADD CONSTRAINT "IngredienteFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
