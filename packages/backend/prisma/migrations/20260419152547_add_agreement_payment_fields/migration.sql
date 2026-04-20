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
    CONSTRAINT "agreements_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_agreements" ("created_at", "end_date", "id", "notes", "renewal_date", "school_id", "start_date", "status", "updated_at", "value") SELECT "created_at", "end_date", "id", "notes", "renewal_date", "school_id", "start_date", "status", "updated_at", "value" FROM "agreements";
DROP TABLE "agreements";
ALTER TABLE "new_agreements" RENAME TO "agreements";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
