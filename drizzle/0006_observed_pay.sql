ALTER TABLE "financial_transaction" DROP CONSTRAINT "financial_transaction_spending_kind";--> statement-breakpoint
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_spending_kind" CHECK (
      "financial_transaction"."spending_kind" in ('activity', 'transfer')
      or ("financial_transaction"."spending_kind" in ('regular_pay', 'bonus', 'reimbursement', 'refund') and "financial_transaction"."amount_cents" > 0)
    );