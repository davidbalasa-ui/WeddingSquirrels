-- Add optional directory role labels for People hub display.
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "directoryLabel" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "directoryLabel" TEXT;
