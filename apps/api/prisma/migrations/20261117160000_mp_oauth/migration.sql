-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "mercadoPagoConnectedVia" TEXT,
ADD COLUMN     "mercadoPagoRefreshTokenEnc" TEXT,
ADD COLUMN     "mercadoPagoTokenExpiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "mercadoPagoUserId" TEXT;

