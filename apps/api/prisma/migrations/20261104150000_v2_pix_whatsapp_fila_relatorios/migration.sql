-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('NONE', 'DEPOSIT', 'FULL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'NOTIFIED', 'BOOKED', 'CANCELED');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "confirmedVia" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "depositPercent" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "mercadoPagoTokenEnc" TEXT,
ADD COLUMN     "paymentExpiryMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "segment" TEXT NOT NULL DEFAULT 'barbearia';

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "calendarFeedToken" TEXT,
ADD COLUMN     "commissionPercent" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleRefreshTokenEnc" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "qrCode" TEXT,
    "qrCodeBase64" TEXT,
    "ticketUrl" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "customerId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "kind" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "professionalId" TEXT,
    "customerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "token" TEXT NOT NULL,
    "notifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_appointmentId_key" ON "Payment"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MessageLog_businessId_createdAt_idx" ON "MessageLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_phone_createdAt_idx" ON "MessageLog"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_token_key" ON "WaitlistEntry"("token");

-- CreateIndex
CREATE INDEX "WaitlistEntry_businessId_date_status_idx" ON "WaitlistEntry"("businessId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_customerId_serviceId_date_key" ON "WaitlistEntry"("customerId", "serviceId", "date");

-- CreateIndex
CREATE INDEX "Appointment_status_reminderSentAt_startsAt_idx" ON "Appointment"("status", "reminderSentAt", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_calendarFeedToken_key" ON "Professional"("calendarFeedToken");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras de integridade
ALTER TABLE "Business" ADD CONSTRAINT "Business_deposit_range" CHECK ("depositPercent" BETWEEN 1 AND 100);
ALTER TABLE "Business" ADD CONSTRAINT "Business_payment_expiry_range" CHECK ("paymentExpiryMinutes" BETWEEN 5 AND 1440);
ALTER TABLE "Business" ADD CONSTRAINT "Business_reminder_range" CHECK ("reminderHoursBefore" BETWEEN 1 AND 72);
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_commission_range" CHECK ("commissionPercent" BETWEEN 0 AND 100);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountCents" > 0);
