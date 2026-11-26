ALTER TABLE "financial_transaction" ADD COLUMN "spending_kind" text DEFAULT 'activity' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_spending_kind" CHECK (
      "financial_transaction"."spending_kind" in ('activity', 'transfer')
      or ("financial_transaction"."spending_kind" = 'refund' and "financial_transaction"."amount_cents" > 0)
    );