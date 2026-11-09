-- CreateTable
CREATE TABLE "support_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workId" INTEGER NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderName" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_messages_workId_fkey" FOREIGN KEY ("workId") REFERENCES "school_work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "support_messages_workId_id_idx" ON "support_messages"("workId", "id");

-- CreateIndex
CREATE INDEX "support_messages_senderType_id_idx" ON "support_messages"("senderType", "id");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_workId_senderType_senderId_requestId_key" ON "support_messages"("workId", "senderType", "senderId", "requestId");

