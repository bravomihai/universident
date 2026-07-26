-- Add routeKey temporarily as nullable so existing locations can be backfilled
ALTER TABLE "student_location"
ADD COLUMN "routeKey" TEXT;

-- Generate a six-character lowercase hexadecimal routeKey
-- unique within each student profile
DO $$
DECLARE
    location_row RECORD;
    generated_route_key TEXT;
BEGIN
    FOR location_row IN
        SELECT "id", "studentProfileId"
        FROM "student_location"
        ORDER BY "id"
    LOOP
        LOOP
            generated_route_key := substr(
                md5(
                    random()::text
                    || clock_timestamp()::text
                    || location_row."id"
                ),
                1,
                6
            );

            EXIT WHEN NOT EXISTS (
                SELECT 1
                FROM "student_location"
                WHERE "studentProfileId" = location_row."studentProfileId"
                  AND "routeKey" = generated_route_key
            );
        END LOOP;

        UPDATE "student_location"
        SET "routeKey" = generated_route_key
        WHERE "id" = location_row."id";
    END LOOP;
END
$$;

-- Every location must have a routeKey after the backfill
ALTER TABLE "student_location"
ALTER COLUMN "routeKey" SET NOT NULL;

-- Enforce the exact lowercase hexadecimal format
ALTER TABLE "student_location"
ADD CONSTRAINT "student_location_route_key_format_check"
CHECK ("routeKey" ~ '^[0-9a-f]{6}$');

-- routeKey only needs to be unique for each student profile
CREATE UNIQUE INDEX "student_location_studentProfileId_routeKey_key"
ON "student_location"("studentProfileId", "routeKey");