CREATE TYPE "public"."adjustment_index" AS ENUM('IPCA', 'IGP-M', 'INPC', 'none');--> statement-breakpoint
CREATE TYPE "public"."billing_format" AS ENUM('monthly', 'quarterly', 'semiannual', 'annual', 'usage', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('active', 'renewing', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."criticality" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('renew', 'renegotiate', 'cancel', 'end');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('contract', 'amendment', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."notice_unit" AS ENUM('calendar_days', 'business_days', 'months');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invite_pending', 'disabled');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(80) NOT NULL,
	"action" varchar(80) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(32) NOT NULL,
	"decision" "decision_type" NOT NULL,
	"effective_date" date,
	"supplier_notice_date" date,
	"assessed_penalty" numeric(14, 2),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(220) NOT NULL,
	"vendor" varchar(180) NOT NULL,
	"cnpj" varchar(18) NOT NULL,
	"destination" varchar(80) NOT NULL,
	"criticality" "criticality" NOT NULL,
	"status" "contract_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"automatic_renewal" boolean DEFAULT false NOT NULL,
	"renewal_period_months" integer,
	"notice_quantity" integer NOT NULL,
	"notice_unit" "notice_unit" DEFAULT 'calendar_days' NOT NULL,
	"decision_deadline" date NOT NULL,
	"cancellation_penalty" boolean DEFAULT false NOT NULL,
	"penalty_basis" text,
	"billing_format" "billing_format" NOT NULL,
	"value" numeric(14, 2),
	"adjustment_index" "adjustment_index" DEFAULT 'none' NOT NULL,
	"adjustment_anniversary" date,
	"cost_center" varchar(20) NOT NULL,
	"squad" varchar(100) NOT NULL,
	"manager_id" uuid,
	"manager_name" varchar(160) NOT NULL,
	"sla" text,
	"integrated_systems" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"lgpd_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_dates_check" CHECK ("contracts"."end_date" > "contracts"."start_date"),
	CONSTRAINT "contracts_notice_positive_check" CHECK ("contracts"."notice_quantity" > 0),
	CONSTRAINT "contracts_renewal_period_check" CHECK (NOT "contracts"."automatic_renewal" OR "contracts"."renewal_period_months" > 0),
	CONSTRAINT "contracts_penalty_basis_check" CHECK (NOT "contracts"."cancellation_penalty" OR length(trim("contracts"."penalty_basis")) > 0),
	CONSTRAINT "contracts_value_check" CHECK ("contracts"."value" IS NULL OR "contracts"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(32) NOT NULL,
	"type" "document_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"obsolete" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_size_check" CHECK ("documents"."size_bytes" > 0 AND "documents"."size_bytes" <= 20971520)
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(80) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text NOT NULL,
	"screen_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"recipients" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"schedule" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(32) NOT NULL,
	"rule_id" integer,
	"deduplication_key" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"screen_sent" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"initials" varchar(4) NOT NULL,
	"area" varchar(100) NOT NULL,
	"status" "user_status" DEFAULT 'invite_pending' NOT NULL,
	"last_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_decisions" ADD CONSTRAINT "contract_decisions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_decisions" ADD CONSTRAINT "contract_decisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contract_decisions_contract_idx" ON "contract_decisions" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_cnpj_id_uidx" ON "contracts" USING btree ("cnpj","id");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_end_date_idx" ON "contracts" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "contracts_decision_deadline_idx" ON "contracts" USING btree ("decision_deadline");--> statement-breakpoint
CREATE INDEX "contracts_manager_idx" ON "contracts" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "documents_contract_idx" ON "documents" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_rules_code_uidx" ON "notification_rules" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_deduplication_uidx" ON "notifications" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "notifications_contract_idx" ON "notifications" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
