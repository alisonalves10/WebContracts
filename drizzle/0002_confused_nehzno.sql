ALTER TABLE "users" ADD COLUMN "vertical" varchar(100) DEFAULT 'Corporativo' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sector" varchar(100) DEFAULT 'Não informado' NOT NULL;--> statement-breakpoint
UPDATE "users" SET
  "sector" = "area",
  "vertical" = CASE
    WHEN "area" IN ('Marketplace') THEN '3P'
    WHEN "area" IN ('Checkout') THEN '1P'
    WHEN "area" IN ('Produto', 'Atendimento') THEN '1P e 3P'
    WHEN "area" IN ('Plataforma') THEN 'TI'
    ELSE 'Corporativo'
  END;
