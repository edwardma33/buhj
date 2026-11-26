import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { PreviewRow } from "../csv-import/csv";
import { payScheduleValues } from "../income";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const signupInvite = pgTable("signup_invite", {
  id: text("token_hash").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const paySchedule = pgEnum("pay_schedule", payScheduleValues);

export const incomeProfile = pgTable(
  "income_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    jobTitle: text("job_title").notNull(),
    grossAnnualCents: bigint("gross_annual_cents", { mode: "number" }).notNull(),
    takeHomePerPaycheckCents: bigint("take_home_per_paycheck_cents", {
      mode: "number",
    }).notNull(),
    paySchedule: paySchedule("pay_schedule").notNull(),
  },
  (table) => [
    check(
      "income_profile_job_title_length",
      sql`char_length(btrim(${table.jobTitle})) between 1 and 120`,
    ),
    check(
      "income_profile_gross_annual_range",
      sql`${table.grossAnnualCents} between 1 and 99999999999999`,
    ),
    check(
      "income_profile_take_home_range",
      sql`${table.takeHomePerPaycheckCents} between 1 and 99999999999999`,
    ),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const financialAccount = pgTable(
  "financial_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institution: text("institution").notNull(),
  },
  (table) => [index("financial_account_user_id_idx").on(table.userId)],
);

type ImportPreview = {
  columns: { date: string; description: string } & (
    | { amount: string; sign: "positive-inflow" | "positive-outflow" }
    | { debit: string; credit: string }
  );
  rows: PreviewRow[];
};

export const csvImport = pgTable(
  "csv_import",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull().references(() => financialAccount.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    filename: text("filename").notNull(),
    preview: jsonb("preview").$type<ImportPreview>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    transactionCount: integer("transaction_count"),
  },
  (table) => [
    uniqueIndex("csv_import_account_fingerprint_idx").on(table.accountId, table.fingerprint),
    index("csv_import_expiry_idx").on(table.expiresAt).where(sql`${table.expiresAt} is not null`),
    check("csv_import_lifecycle", sql`
      (${table.preview} is not null and ${table.expiresAt} is not null
       and ${table.confirmedAt} is null and ${table.transactionCount} is null)
      or
      (${table.preview} is null and ${table.expiresAt} is null
       and ${table.confirmedAt} is not null and ${table.transactionCount} is not null
       and ${table.transactionCount} > 0)
    `),
  ],
);

export const financialTransaction = pgTable(
  "financial_transaction",
  {
    importId: uuid("import_id").notNull().references(() => csvImport.id, { onDelete: "cascade" }),
    sourceRow: integer("source_row").notNull(),
    postedDate: date("posted_date").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    category: text("category").default("Uncategorized").notNull(),
    sourceId: text("source_id"),
    spendingKind: text("spending_kind", { enum: ["activity", "refund", "transfer"] }).default("activity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importId, table.sourceRow] }),
    check("financial_transaction_spending_kind", sql`
      ${table.spendingKind} in ('activity', 'transfer')
      or (${table.spendingKind} = 'refund' and ${table.amountCents} > 0)
    `),
  ],
);

export const aiDailyUsage = pgTable(
  "ai_daily_usage",
  {
    day: date("day").notNull(),
    bucket: text("bucket").notNull(),
    requests: integer("requests").notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.bucket] })],
);
