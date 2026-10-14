import { describe, it, expect } from "vitest";
import {
  createReservationSchema,
  computeProgressStatus,
} from "@/lib/security/validations/reservation";


function isIntervalOverlap(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string
): boolean {
  const eStart = new Date(existingStart).getTime();
  const eEnd = new Date(existingEnd).getTime();
  const nStart = new Date(newStart).getTime();
  const nEnd = new Date(newEnd).getTime();

  return eStart < nEnd && eEnd > nStart;
}

describe("Reservation Engine Unit Tests", () => {
  describe("1. Reservation Input Validation (Zod)", () => {
    it("TC-RES-001: should pass validation with valid reservation payload", () => {
      const result = createReservationSchema.safeParse({
        resourceId: "resource-uuid-101",
        title: "Quantum Physics Lab Simulation",
        startTime: "2026-10-25T09:00:00Z",
        endTime: "2026-10-25T12:00:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.resourceId).toBe("resource-uuid-101");
        expect(result.data.title).toBe("Quantum Physics Lab Simulation");
      }
    });

    it("TC-RES-002: should fail validation when resourceId is missing or empty", () => {
      const result = createReservationSchema.safeParse({
        resourceId: "",
        title: "Simulation",
        startTime: "2026-10-25T09:00:00Z",
        endTime: "2026-10-25T12:00:00Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const idIssue = result.error.issues.find((i) => i.path.includes("resourceId"));
        expect(idIssue?.message).toContain("Resource ID is required");
      }
    });

    it("TC-RES-003: should fail validation when startTime or endTime is missing", () => {
      const result = createReservationSchema.safeParse({
        resourceId: "resource-uuid-101",
        startTime: "",
        endTime: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("2. Double-Booking Overlap Detection Matrix", () => {
    // Existing baseline confirmed booking: 10:00 to 12:00
    const exStart = "2026-10-25T10:00:00Z";
    const exEnd = "2026-10-25T12:00:00Z";

    it("TC-RES-004: should detect conflict when new booking has exact same time window (10:00 - 12:00)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T10:00:00Z", "2026-10-25T12:00:00Z");
      expect(overlap).toBe(true);
    });

    it("TC-RES-005: should detect conflict on left overlap (starts before, ends inside: 09:30 - 11:00)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T09:30:00Z", "2026-10-25T11:00:00Z");
      expect(overlap).toBe(true);
    });

    it("TC-RES-006: should detect conflict on right overlap (starts inside, ends after: 11:00 - 13:00)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T11:00:00Z", "2026-10-25T13:00:00Z");
      expect(overlap).toBe(true);
    });

    it("TC-RES-007: should detect conflict when nested completely inside existing booking (10:30 - 11:30)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T10:30:00Z", "2026-10-25T11:30:00Z");
      expect(overlap).toBe(true);
    });

    it("TC-RES-008: should detect conflict when enclosing existing booking (09:00 - 13:00)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T09:00:00Z", "2026-10-25T13:00:00Z");
      expect(overlap).toBe(true);
    });

    it("TC-RES-009: should ALLOW back-to-back adjacent booking ending exactly when existing starts (08:00 - 10:00)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T08:00:00Z", "2026-10-25T10:00:00Z");
      expect(overlap).toBe(false);
    });

    it("TC-RES-010: should ALLOW back-to-back adjacent booking starting exactly when existing ends (12:00 - 14:00)", () => {
      const overlap = isIntervalOverlap(exStart, exEnd, "2026-10-25T12:00:00Z", "2026-10-25T14:00:00Z");
      expect(overlap).toBe(false);
    });
  });

  describe("3. Live Progress Status Lifecycle", () => {
    const now = new Date();

    it("TC-RES-011: should calculate status as UPCOMING when currentTime is before StartTime", () => {
      const futureStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const futureEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

      const status = computeProgressStatus({
        StartTime: futureStart,
        Endtime: futureEnd,
      });

      expect(status).toBe("UPCOMING");
    });

    it("TC-RES-012: should calculate status as IN_PROGRESS when currentTime is between StartTime and Endtime", () => {
      const pastStart = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      const ongoingEnd = new Date(now.getTime() + 1 * 60 * 60 * 1000);

      const status = computeProgressStatus({
        StartTime: pastStart,
        Endtime: ongoingEnd,
      });

      expect(status).toBe("IN_PROGRESS");
    });

    it("TC-RES-013: should calculate status as COMPLETED when currentTime has passed Endtime", () => {
      const pastStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const pastEnd = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const status = computeProgressStatus({
        StartTime: pastStart,
        Endtime: pastEnd,
      });

      expect(status).toBe("COMPLETED");
    });

    it("TC-RES-014: should calculate status as CANCELLED when cancelledAt timestamp is present", () => {
      const futureStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const futureEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

      const status = computeProgressStatus({
        StartTime: futureStart,
        Endtime: futureEnd,
        cancelledAt: new Date(),
      });

      expect(status).toBe("CANCELLED");
    });
  });
});
