
ALTER TABLE "quotations" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "quotations" ADD COLUMN "approvedById" INTEGER;
ALTER TABLE "quotations" ADD COLUMN "approvedAt" DATETIME;
CREATE TABLE "quotation_versions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotation_versions_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "quotation_versions_quotationId_number_key" ON "quotation_versions"("quotationId", "number");
