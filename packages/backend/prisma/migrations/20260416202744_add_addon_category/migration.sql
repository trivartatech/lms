-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_addons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ADDON',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_addons" ("created_at", "description", "id", "name", "price") SELECT "created_at", "description", "id", "name", "price" FROM "addons";
DROP TABLE "addons";
ALTER TABLE "new_addons" RENAME TO "addons";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
