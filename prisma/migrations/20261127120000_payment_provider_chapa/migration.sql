-- Add Chapa as a payment provider (additive, non-destructive).
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'chapa';
