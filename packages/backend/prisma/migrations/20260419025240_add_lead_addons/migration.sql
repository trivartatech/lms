-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_school_addons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "school_id" INTEGER,
    "lead_id" INTEGER,
    "addon_id" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "start_date" DATETIME NOT NULL,
    CONSTRAINT "school_addons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "school_addons_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "school_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addons" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_school_addons" ("addon_id", "id", "price", "school_id", "start_date") SELECT "addon_id", "id", "price", "school_id", "start_date" FROM "school_addons";
DROP TABLE "school_addons";
ALTER TABLE "new_school_addons" RENAME TO "school_addons";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
