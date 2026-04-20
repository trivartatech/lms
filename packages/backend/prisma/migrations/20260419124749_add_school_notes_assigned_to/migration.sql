-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_schools" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "assigned_to_id" INTEGER,
    "referred_by_school_id" INTEGER,
    "created_from_lead_id" INTEGER,
    "total_students" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schools_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "schools_referred_by_school_id_fkey" FOREIGN KEY ("referred_by_school_id") REFERENCES "schools" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "schools_created_from_lead_id_fkey" FOREIGN KEY ("created_from_lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_schools" ("contact_person", "created_at", "created_from_lead_id", "email", "id", "location", "name", "phone", "referred_by_school_id", "total_students", "updated_at") SELECT "contact_person", "created_at", "created_from_lead_id", "email", "id", "location", "name", "phone", "referred_by_school_id", "total_students", "updated_at" FROM "schools";
DROP TABLE "schools";
ALTER TABLE "new_schools" RENAME TO "schools";
CREATE UNIQUE INDEX "schools_created_from_lead_id_key" ON "schools"("created_from_lead_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
