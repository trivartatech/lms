
CREATE TABLE "agreement_payments" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "agreement_id" INTEGER NOT NULL,
 "amount" DECIMAL NOT NULL,
 "due_date" DATETIME NOT NULL,
 "paid_at" DATETIME,
 "reference" TEXT,
 "created_by_id" INTEGER NOT NULL,
 "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("agreement_id") REFERENCES "agreements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "agreement_payments_agreement_id_idx" ON "agreement_payments"("agreement_id");
CREATE TABLE "agreement_renewal_reminders" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "agreement_id" INTEGER NOT NULL,
 "renewal_date" DATETIME NOT NULL,
 "days_before" INTEGER NOT NULL,
 "task_id" INTEGER NOT NULL,
 FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "agreement_renewal_reminders_task_id_key" ON "agreement_renewal_reminders"("task_id");
CREATE UNIQUE INDEX "agreement_renewal_reminders_agreement_id_renewal_date_days_before_key" ON "agreement_renewal_reminders"("agreement_id", "renewal_date", "days_before");
