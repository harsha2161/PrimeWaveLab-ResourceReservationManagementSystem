import { z } from "zod";
import { ValidationError } from "@/lib/security/errors";
import { formatZodErrors } from "@/lib/response/api-response";


//Validation schema for Creating a Maintenance Record (ADMIN only)
export const createMaintenanceSchema = z.object({
  resourceId: z
    .string()
    .trim()
    .min(1, "Resource ID is required"),

  description: z
    .string()
    .trim()
    .min(3, "Description must be at least 3 characters long"),

  startTime: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),

  endTime: z
    .string()
    .min(1, "End time is required"),

  maintenancestatus: z
    .enum(["INPROGRESS", "COMPLETE"])
    .default("INPROGRESS")
    .optional(),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;

 //Validation schema for Updating a Maintenance Record (ADMIN only)
export const updateMaintenanceSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, "Description must be at least 3 characters long")
    .optional(),

  startTime: z
    .string()
    .optional(),

  endTime: z
    .string()
    .optional(),

  maintenancestatus: z
    .enum(["INPROGRESS", "COMPLETE"])
    .optional(),
});

export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;

 //Validates maintenance input data, throwing ValidationError if invalid 
export function validateMaintenanceData<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Validation failed", formatZodErrors(result.error));
  }
  return result.data;
}
