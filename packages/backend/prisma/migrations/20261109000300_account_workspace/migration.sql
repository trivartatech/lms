-- CreateTable
CREATE TABLE "renewal_cases" (
    "agreementId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "stage" TEXT NOT NULL DEFAULT 'UPCOMING',
    "risk" TEXT NOT NULL DEFAULT 'NORMAL',
    "proposedValue" DECIMAL,
    "notes" TEXT,
    "nextActionAt" DATETIME,
    "nextTaskId" INTEGER,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "renewal_cases_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "renewal_cases_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "school_portal_access" (
    "schoolId" INTEGER NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contactId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_portal_access_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portal_quotes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schoolId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "respondedBy" TEXT,
    "respondedAt" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portal_quotes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portal_quotes_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "quotation_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portal_documents" (
    "fileId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schoolId" INTEGER NOT NULL,
    "uploadedBySchool" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portal_documents_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "school_files" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portal_documents_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "school_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schoolId" INTEGER NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "versionNumber" INTEGER,
    "agreementId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_orders_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "school_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "school_orders_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "school_order_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "seats" INTEGER,
    "activationDate" DATETIME,
    "activatedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "blocker" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "school_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "payment_reviews" (
    "paymentId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reference" TEXT,
    "proofFileId" INTEGER,
    "bankEntryId" INTEGER,
    "matchedById" INTEGER,
    "matchedAt" DATETIME,
    "receiptNumber" TEXT,
    "receiptIssuedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_reviews_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "agreement_payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_reviews_proofFileId_fkey" FOREIGN KEY ("proofFileId") REFERENCES "school_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_reviews_bankEntryId_fkey" FOREIGN KEY ("bankEntryId") REFERENCES "bank_entries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_territories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "territory_schools" (
    "schoolId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "territoryId" INTEGER NOT NULL,
    CONSTRAINT "territory_schools_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "territory_schools_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "sales_territories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_targets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "period" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "salespersonId" INTEGER,
    "territoryId" INTEGER,
    "visits" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "collections" DECIMAL NOT NULL,
    "renewals" INTEGER NOT NULL,
    CONSTRAINT "sales_targets_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_targets_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "sales_territories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbox_reads" (
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "key"),
    CONSTRAINT "inbox_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "renewal_cases_ownerId_nextActionAt_idx" ON "renewal_cases"("ownerId", "nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "school_portal_access_contactId_key" ON "school_portal_access"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "school_portal_access_tokenHash_key" ON "school_portal_access"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "portal_quotes_versionId_key" ON "portal_quotes"("versionId");

-- CreateIndex
CREATE INDEX "portal_quotes_schoolId_published_idx" ON "portal_quotes"("schoolId", "published");

-- CreateIndex
CREATE INDEX "portal_documents_schoolId_idx" ON "portal_documents"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "school_orders_quotationId_key" ON "school_orders"("quotationId");

-- CreateIndex
CREATE INDEX "school_orders_schoolId_idx" ON "school_orders"("schoolId");

-- CreateIndex
CREATE INDEX "school_order_items_orderId_idx" ON "school_order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_entries_reference_key" ON "bank_entries"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reviews_bankEntryId_key" ON "payment_reviews"("bankEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reviews_receiptNumber_key" ON "payment_reviews"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_territories_name_key" ON "sales_territories"("name");

-- CreateIndex
CREATE INDEX "territory_schools_territoryId_idx" ON "territory_schools"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_period_subject_key" ON "sales_targets"("period", "subject");

