CREATE TYPE "public"."pay_schedule" AS ENUM('weekly', 'biweekly', 'semimonthly', 'monthly');--> statement-breakpoint
CREATE TABLE "income_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"job_title" text NOT NULL,
	"gross_annual_cents" bigint NOT NULL,
	"take_home_per_paycheck_cents" bigint NOT NULL,
	"pay_schedule" "pay_schedule" NOT NULL,
	CONSTRAINT "income_profile_job_title_length" CHECK (char_length(btrim("income_profile"."job_title")) between 1 and 120),
	CONSTRAINT "income_profile_gross_annual_range" CHECK ("income_profile"."gross_annual_cents" between 1 and 99999999999999),
	CONSTRAINT "income_profile_take_home_range" CHECK ("income_profile"."take_home_per_paycheck_cents" between 1 and 99999999999999)
);
--> statement-breakpoint
ALTER TABLE "income_profile" ADD CONSTRAINT "income_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;