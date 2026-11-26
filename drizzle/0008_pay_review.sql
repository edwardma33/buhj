CREATE TABLE "pay_review_dismissal" (
	"user_id" text NOT NULL,
	"month_start" date NOT NULL,
	"evidence" text NOT NULL,
	CONSTRAINT "pay_review_dismissal_user_id_month_start_evidence_pk" PRIMARY KEY("user_id","month_start","evidence")
);
--> statement-breakpoint
CREATE TABLE "pay_review_month" (
	"user_id" text NOT NULL,
	"month_start" date NOT NULL,
	"schedule" "pay_schedule" NOT NULL,
	"expected_dates" date[] NOT NULL,
	"full_coverage" boolean NOT NULL,
	CONSTRAINT "pay_review_month_user_id_month_start_pk" PRIMARY KEY("user_id","month_start")
);
--> statement-breakpoint
ALTER TABLE "pay_review_dismissal" ADD CONSTRAINT "pay_review_dismissal_user_id_month_start_pay_review_month_user_id_month_start_fk" FOREIGN KEY ("user_id","month_start") REFERENCES "public"."pay_review_month"("user_id","month_start") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_review_month" ADD CONSTRAINT "pay_review_month_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;