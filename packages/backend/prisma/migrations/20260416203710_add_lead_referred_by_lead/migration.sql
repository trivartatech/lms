-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_leads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "school_name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "pipeline_stage" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assigned_to" INTEGER,
    "referred_by_school_id" INTEGER,
    "referral_notes" TEXT,
    "referred_by_lead_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_referred_by_school_id_fkey" FOREIGN KEY ("referred_by_school_id") REFERENCES "schools" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_referred_by_lead_id_fkey" FOREIGN KEY ("referred_by_lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_leads" ("assigned_to", "contact_person", "created_at", "email", "id", "location", "notes", "phone", "pipeline_stage", "referral_notes", "referred_by_school_id", "school_name", "status", "updated_at") SELECT "assigned_to", "contact_person", "created_at", "email", "id", "location", "notes", "phone", "pipeline_stage", "referral_notes", "referred_by_school_id", "school_name", "status", "updated_at" FROM "leads";
DROP TABLE "leads";
ALTER TABLE "new_leads" RENAME TO "leads";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
