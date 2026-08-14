CREATE TABLE "university" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "university_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "university_slug_key" ON "university"("slug");
CREATE UNIQUE INDEX "university_shortName_key" ON "university"("shortName");
CREATE INDEX "university_isActive_sortOrder_shortName_idx"
  ON "university"("isActive", "sortOrder", "shortName");
