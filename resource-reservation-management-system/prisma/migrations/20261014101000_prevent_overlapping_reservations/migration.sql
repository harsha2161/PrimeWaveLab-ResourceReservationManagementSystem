CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "reservations" AS first_booking
    JOIN "reservations" AS second_booking
      ON first_booking."resourceId" = second_booking."resourceId"
     AND first_booking."id" < second_booking."id"
    WHERE first_booking."cancelledAt" IS NULL
      AND second_booking."cancelledAt" IS NULL
      AND first_booking."StartTime" < second_booking."Endtime"
      AND second_booking."StartTime" < first_booking."Endtime"
  ) THEN
    RAISE EXCEPTION
      'Cannot prevent overlapping reservations until existing active overlaps are resolved.';
  END IF;
END $$;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlapping_active_time"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("StartTime", "Endtime", '[)') WITH &&
  )
  WHERE ("cancelledAt" IS NULL);
