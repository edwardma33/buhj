CREATE TABLE "ai_daily_usage" (
	"day" date NOT NULL,
	"bucket" text NOT NULL,
	"requests" integer NOT NULL,
	CONSTRAINT "ai_daily_usage_day_bucket_pk" PRIMARY KEY("day","bucket")
);
--> statement-breakpoint
CREATE TABLE "csv_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"filename" text NOT NULL,
	"preview" jsonb,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"transaction_count" integer,
	CONSTRAINT "csv_import_lifecycle" CHECK (
      ("csv_import"."preview" is not null and "csv_import"."expires_at" is not null
       and "csv_import"."confirmed_at" is null and "csv_import"."transaction_count" is null)
      or
      ("csv_import"."preview" is null and "csv_import"."expires_at" is null
       and "csv_import"."confirmed_at" is not null and "csv_import"."transaction_count" is not null
       and "csv_import"."transaction_count" > 0)
    )
);
--> statement-breakpoint
CREATE TABLE "financial_transaction" (
	"import_id" uuid NOT NULL,
	"source_row" integer NOT NULL,
	"posted_date" date NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"category" text DEFAULT 'Uncategorized' NOT NULL,
	"source_id" text,
	CONSTRAINT "financial_transaction_import_id_source_row_pk" PRIMARY KEY("import_id","source_row")
);
--> statement-breakpoint
ALTER TABLE "csv_import" ADD CONSTRAINT "csv_import_account_id_financial_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_import_id_csv_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."csv_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "csv_import_account_fingerprint_idx" ON "csv_import" USING btree ("account_id","fingerprint");--> statement-breakpoint
CREATE INDEX "csv_import_expiry_idx" ON "csv_import" USING btree ("expires_at") WHERE "csv_import"."expires_at" is not null;