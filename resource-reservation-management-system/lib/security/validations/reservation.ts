import { z } from "zod";
import { ValidationError } from "@/lib/security/errors";
import { formatZodErrors } from "@/lib/response/api-response";

 //Validation schema for Creating a Reservation
export const createReservationSchema = z.object({
  resourceId: z
    .string()
    .trim()
    .min(1, "Resource ID is required"),

  title: z
    .string()
    .trim()
    .max(255, "Title cannot exceed 255 characters")
    .optional(),

  startTime: z
    .string()
    .min(1, "Start time is required"),

  endTime: z
    .string()
    .min(1, "End time is required"),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

//Validates reservation input data, throwing ValidationError if invalid
export function validateReservationData<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Validation failed", formatZodErrors(result.error));
  }
  return result.data;
}

export function computeProgressStatus(reservation: {
  StartTime: Date;
  Endtime: Date;
  cancelledAt?: Date | null;
}): "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" {
  if (reservation.cancelledAt) {
    return "CANCELLED";
  }

  const now = new Date();
  const start = new Date(reservation.StartTime);
  const end = new Date(reservation.Endtime);

  if (now < start) {
    return "UPCOMING";
  }

  if (now >= start && now <= end) {
    return "IN_PROGRESS";
  }

  return "COMPLETED";
}
