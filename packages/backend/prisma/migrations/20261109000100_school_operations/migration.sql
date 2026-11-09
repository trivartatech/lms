
CREATE TABLE "school_work" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schoolId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "outcome" TEXT,
    "dueAt" DATETIME,
    "checkedInAt" DATETIME,
    "latitude" REAL,
    "longitude" REAL,
    "assignedToId" INTEGER,
    "agreementId" INTEGER,
    "templateKey" TEXT,
    "paymentId" INTEGER,
    "followUpTaskId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_work_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "school_work_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "school_work_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "school_work_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "agreement_payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "school_work_kind_schoolId_idx" ON "school_work"("kind", "schoolId");
CREATE INDEX "school_work_assignedToId_idx" ON "school_work"("assignedToId");
CREATE INDEX "school_work_paymentId_idx" ON "school_work"("paymentId");
CREATE UNIQUE INDEX "school_work_agreementId_templateKey_key" ON "school_work"("agreementId", "templateKey");

CREATE TABLE "school_files" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schoolId" INTEGER NOT NULL,
    "workId" INTEGER,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BLOB NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_files_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "school_files_workId_fkey" FOREIGN KEY ("workId") REFERENCES "school_work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "school_files_schoolId_idx" ON "school_files"("schoolId");
CREATE INDEX "school_files_workId_idx" ON "school_files"("workId");

CREATE TABLE "school_work_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_work_events_workId_fkey" FOREIGN KEY ("workId") REFERENCES "school_work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "school_work_events_workId_createdAt_idx" ON "school_work_events"("workId", "createdAt");
