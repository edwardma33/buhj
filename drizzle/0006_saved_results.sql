CREATE TABLE "saved_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"saved_at" timestamp with time zone,
	CONSTRAINT "saved_result_snapshot_kind" CHECK ("saved_result"."snapshot"->>'kind' is not distinct from "saved_result"."kind")
);
--> statement-breakpoint
ALTER TABLE "saved_result" ADD CONSTRAINT "saved_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_result_owner_kind_saved_idx" ON "saved_result" USING btree ("user_id","kind","saved_at") WHERE "saved_result"."saved_at" is not null;--> statement-breakpoint
CREATE INDEX "saved_result_draft_created_idx" ON "saved_result" USING btree ("created_at") WHERE "saved_result"."saved_at" is null;