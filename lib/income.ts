export const payScheduleValues = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
] as const

export const payScheduleLabels = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
} satisfies Record<(typeof payScheduleValues)[number], string>

export const jobTitleMaxLength = 120
