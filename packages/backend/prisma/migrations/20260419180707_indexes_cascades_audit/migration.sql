-- AlterTable
ALTER TABLE "users" ADD COLUMN "push_token" TEXT;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "replaced_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agreements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "school_id" INTEGER NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "renewal_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "value" DECIMAL NOT NULL,
    "advance_payment" DECIMAL NOT NULL DEFAULT 0,
    "total_instalments" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agreements_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_agreements" ("advance_payment", "created_at", "end_date", "id", "notes", "renewal_date", "school_id", "start_date", "status", "total_instalments", "updated_at", "value") SELECT "advance_payment", "created_at", "end_date", "id", "notes", "renewal_date", "school_id", "start_date", "status", "total_instalments", "updated_at", "value" FROM "agreements";
DROP TABLE "agreements";
ALTER TABLE "new_agreements" RENAME TO "agreements";
CREATE INDEX "agreements_school_id_idx" ON "agreements"("school_id");
CREATE INDEX "agreements_status_idx" ON "agreements"("status");
CREATE INDEX "agreements_end_date_idx" ON "agreements"("end_date");
CREATE TABLE "new_contacts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "designation" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "school_id" INTEGER,
    "lead_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contacts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_contacts" ("created_at", "designation", "email", "id", "is_primary", "lead_id", "name", "phone", "school_id", "updated_at") SELECT "created_at", "designation", "email", "id", "is_primary", "lead_id", "name", "phone", "school_id", "updated_at" FROM "contacts";
DROP TABLE "contacts";
ALTER TABLE "new_contacts" RENAME TO "contacts";
CREATE INDEX "contacts_school_id_idx" ON "contacts"("school_id");
CREATE INDEX "contacts_lead_id_idx" ON "contacts"("lead_id");
CREATE TABLE "new_quotations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lead_id" INTEGER,
    "school_id" INTEGER,
    "subtotal" DECIMAL NOT NULL,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "tax" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "quotations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quotations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_quotations" ("created_at", "discount", "id", "lead_id", "school_id", "status", "subtotal", "tax", "total", "updated_at") SELECT "created_at", "discount", "id", "lead_id", "school_id", "status", "subtotal", "tax", "total", "updated_at" FROM "quotations";
DROP TABLE "quotations";
ALTER TABLE "new_quotations" RENAME TO "quotations";
CREATE INDEX "quotations_lead_id_idx" ON "quotations"("lead_id");
CREATE INDEX "quotations_school_id_idx" ON "quotations"("school_id");
CREATE INDEX "quotations_status_idx" ON "quotations"("status");
CREATE INDEX "quotations_created_at_idx" ON "quotations"("created_at");
CREATE TABLE "new_referral_incentives" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "referring_school_id" INTEGER NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "converted_school_id" INTEGER,
    "bonus_type" TEXT NOT NULL,
    "bonus_value" DECIMAL NOT NULL,
    "calculated_commission" DECIMAL,
    "payout_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_incentives_referring_school_id_fkey" FOREIGN KEY ("referring_school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "referral_incentives_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "referral_incentives_converted_school_id_fkey" FOREIGN KEY ("converted_school_id") REFERENCES "schools" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_referral_incentives" ("bonus_type", "bonus_value", "calculated_commission", "converted_school_id", "created_at", "id", "lead_id", "payout_status", "referring_school_id") SELECT "bonus_type", "bonus_value", "calculated_commission", "converted_school_id", "created_at", "id", "lead_id", "payout_status", "referring_school_id" FROM "referral_incentives";
DROP TABLE "referral_incentives";
ALTER TABLE "new_referral_incentives" RENAME TO "referral_incentives";
CREATE UNIQUE INDEX "referral_incentives_lead_id_key" ON "referral_incentives"("lead_id");
CREATE UNIQUE INDEX "referral_incentives_converted_school_id_key" ON "referral_incentives"("converted_school_id");
CREATE INDEX "referral_incentives_referring_school_id_idx" ON "referral_incentives"("referring_school_id");
CREATE INDEX "referral_incentives_payout_status_idx" ON "referral_incentives"("payout_status");
CREATE TABLE "new_school_addons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "school_id" INTEGER,
    "lead_id" INTEGER,
    "addon_id" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "start_date" DATETIME NOT NULL,
    CONSTRAINT "school_addons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "school_addons_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "school_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addons" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_school_addons" ("addon_id", "id", "lead_id", "price", "school_id", "start_date") SELECT "addon_id", "id", "lead_id", "price", "school_id", "start_date" FROM "school_addons";
DROP TABLE "school_addons";
ALTER TABLE "new_school_addons" RENAME TO "school_addons";
CREATE INDEX "school_addons_school_id_idx" ON "school_addons"("school_id");
CREATE INDEX "school_addons_lead_id_idx" ON "school_addons"("lead_id");
CREATE INDEX "school_addons_addon_id_idx" ON "school_addons"("addon_id");
CREATE TABLE "new_tasks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "due_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reminder_sent_at" DATETIME,
    "assigned_to" INTEGER,
    "lead_id" INTEGER,
    "school_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("assigned_to", "created_at", "due_date", "id", "lead_id", "notes", "school_id", "status", "title", "type", "updated_at") SELECT "assigned_to", "created_at", "due_date", "id", "lead_id", "notes", "school_id", "status", "title", "type", "updated_at" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_assigned_to_idx" ON "tasks"("assigned_to");
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_lead_id_idx" ON "tasks"("lead_id");
CREATE INDEX "tasks_school_id_idx" ON "tasks"("school_id");
CREATE TABLE "new_timeline_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lead_id" INTEGER,
    "school_id" INTEGER,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_by" INTEGER,
    "diff" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "timeline_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timeline_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timeline_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_timeline_events" ("created_at", "created_by", "description", "event_type", "id", "lead_id", "school_id") SELECT "created_at", "created_by", "description", "event_type", "id", "lead_id", "school_id" FROM "timeline_events";
DROP TABLE "timeline_events";
ALTER TABLE "new_timeline_events" RENAME TO "timeline_events";
CREATE INDEX "timeline_events_lead_id_idx" ON "timeline_events"("lead_id");
CREATE INDEX "timeline_events_school_id_idx" ON "timeline_events"("school_id");
CREATE INDEX "timeline_events_event_type_idx" ON "timeline_events"("event_type");
CREATE INDEX "timeline_events_created_at_idx" ON "timeline_events"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");

-- CreateIndex
CREATE INDEX "leads_pipeline_stage_idx" ON "leads"("pipeline_stage");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_referred_by_school_id_idx" ON "leads"("referred_by_school_id");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "schools_assigned_to_id_idx" ON "schools"("assigned_to_id");

-- CreateIndex
CREATE INDEX "schools_referred_by_school_id_idx" ON "schools"("referred_by_school_id");

-- CreateIndex
CREATE INDEX "schools_created_at_idx" ON "schools"("created_at");
