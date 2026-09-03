ALTER TABLE "contracts" ADD COLUMN "notification_emails" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
UPDATE "contracts"
SET "notification_emails" = ARRAY['gestao.contratos@webcontinental.com.br']
WHERE cardinality("notification_emails") = 0;
