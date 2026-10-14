import { z } from "zod";
import { ValidationError } from "@/lib/security/errors";
import { formatZodErrors } from "@/lib/response/api-response";


//Validation schema for Creating a Resource (ADMIN only)
export const createResourceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Resource name must be at least 2 characters")
    .max(100, "Resource name cannot exceed 100 characters"),

  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters long"),

  code: z
    .string()
    .trim()
    .min(2, "Resource code must be at least 2 characters")
    .max(50, "Resource code cannot exceed 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Resource code can only contain letters, numbers, hyphens, and underscores (e.g. LAB-01, CONF_ROOM_A)"
    ),

  categoryId: z
    .string()
    .trim()
    .min(1, "Category ID is required"),

  location: z
    .string()
    .trim()
    .max(255, "Location cannot exceed 255 characters")
    .optional(),

  maxCapacity: z
    .number()
    .int("Capacity must be an integer")
    .min(1, "Capacity must be at least 1")
    .optional(),

  status: z
    .enum(["ACTIVE", "WAITING", "INACTIVE"])
    .default("ACTIVE")
    .optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

/**
 * Validation schema for Updating a Resource (ADMIN only)
 */
export const updateResourceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Resource name must be at least 2 characters")
    .max(100, "Resource name cannot exceed 100 characters")
    .optional(),

  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters long")
    .optional(),

  code: z
    .string()
    .trim()
    .min(2, "Resource code must be at least 2 characters")
    .max(50, "Resource code cannot exceed 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Resource code can only contain letters, numbers, hyphens, and underscores"
    )
    .optional(),

  categoryId: z
    .string()
    .trim()
    .min(1, "Category ID cannot be empty")
    .optional(),

  location: z
    .string()
    .trim()
    .max(255)
    .optional(),

  maxCapacity: z
    .number()
    .int()
    .min(1)
    .optional(),

  status: z
    .enum(["ACTIVE", "WAITING", "INACTIVE"])
    .optional(),
});

export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

/**
 * Validation schema for Resource Categories
 */
export const categorySchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, "Category ID must be at least 2 characters")
    .max(50)
    .optional(),

  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100),

  description: z
    .string()
    .trim()
    .max(500)
    .optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

/**
 * Validates input data with Zod schema, throwing ValidationError exception if invalid
 */
export function validateResourceData<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Validation failed", formatZodErrors(result.error));
  }
  return result.data;
}
