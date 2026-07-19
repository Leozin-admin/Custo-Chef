-- AlterTable
ALTER TABLE "Restaurante" ADD COLUMN     "relatorioEmailAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relatorioFrequencia" TEXT NOT NULL DEFAULT 'semanal',
ADD COLUMN     "relatorioUltimoEnvio" TIMESTAMP(3);
