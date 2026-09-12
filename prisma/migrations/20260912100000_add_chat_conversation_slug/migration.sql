BEGIN;

-- A conversation remains attached to its appointment but has its own stable URL.
-- This volatile default generates a different 48-bit identifier for each existing row.
ALTER TABLE "appointment" ADD COLUMN "chatSlug" VARCHAR(12)
    NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

-- Resolve a possible collision during backfill before enforcing uniqueness.
DO $$
BEGIN
    WHILE EXISTS (SELECT 1 FROM "appointment" GROUP BY "chatSlug" HAVING count(*) > 1) LOOP
        UPDATE "appointment" SET "chatSlug" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
        WHERE "id" IN (
            SELECT "id" FROM (
                SELECT "id", row_number() OVER (PARTITION BY "chatSlug" ORDER BY "id") AS duplicate_number
                FROM "appointment"
            ) duplicates WHERE duplicate_number > 1
        );
    END LOOP;
END $$;

CREATE UNIQUE INDEX "appointment_chatSlug_key" ON "appointment"("chatSlug");
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_chatSlug_format"
    CHECK ("chatSlug" ~ '^[0-9a-f]{12}$');

COMMIT;
