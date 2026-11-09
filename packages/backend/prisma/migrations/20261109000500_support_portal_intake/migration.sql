-- AlterTable
ALTER TABLE "school_work" ADD COLUMN "portalContactId" INTEGER;
ALTER TABLE "school_work" ADD COLUMN "portalRequestId" TEXT;
ALTER TABLE "school_work" ADD COLUMN "supportCategory" TEXT;

-- CreateTable
CREATE TABLE "portal_push_devices" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "accessId" INTEGER NOT NULL,
    CONSTRAINT "portal_push_devices_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "school_portal_access" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portal_reply_reads" (
    "accessId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,

    PRIMARY KEY ("accessId", "messageId"),
    CONSTRAINT "portal_reply_reads_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "school_portal_access" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portal_reply_reads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "portal_push_devices_accessId_idx" ON "portal_push_devices"("accessId");

-- CreateIndex
CREATE INDEX "portal_reply_reads_messageId_idx" ON "portal_reply_reads"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "school_work_portalContactId_portalRequestId_key" ON "school_work"("portalContactId", "portalRequestId");

