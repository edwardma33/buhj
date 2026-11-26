CREATE TABLE "financial_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"institution" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_account" ADD CONSTRAINT "financial_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_account_user_id_idx" ON "financial_account" USING btree ("user_id");