ALTER TABLE "appointment_review"
DROP CONSTRAINT "appointment_review_content_check";

ALTER TABLE "appointment_review"
ADD CONSTRAINT "appointment_review_content_check"
CHECK (
    "rating" BETWEEN 1 AND 5
    AND (
        "comment" IS NULL
        OR char_length(btrim("comment")) BETWEEN 10 AND 1000
    )
);
