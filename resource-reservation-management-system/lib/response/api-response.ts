import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../security/errors";

//success responce
export function successResponse<T = any>(
  data?: T,
  message?: string,
  statusCode: number = 200
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status: statusCode }
  );
}

//Error Response
export function errorResponse(
  error: string,
  statusCode: number = 400,
  details?: any
) {
  return NextResponse.json(
    {
      success: false,
      error,
      details,
    },
    { status: statusCode }
  );
}


 //Formats Zod validation issues into an organized key-value object
export function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "general";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

function isReservationOverlapConstraintError(error: unknown): boolean {
  const constraintName = "reservations_no_overlapping_active_time";
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const candidate = current as {
      code?: unknown;
      message?: unknown;
      meta?: unknown;
      cause?: unknown;
    };
    const code = String(candidate.code ?? "");
    const details = `${String(candidate.message ?? "")} ${JSON.stringify(candidate.meta ?? {})}`.toLowerCase();

    if (code === "23P01" || details.includes(constraintName)) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}


 //Centralized Exception Handler for all API Route Exceptions
export function handleApiException(error: unknown): NextResponse {

  // Concurrent reservation inserts can race past the application-level precheck.
  // The PostgreSQL exclusion constraint is authoritative and becomes a conflict response.
  if (isReservationOverlapConstraintError(error)) {
    return errorResponse(
      "This resource is already booked during the selected time period. Please select another slot or resource.",
      409
    );
  }
 
  // Domain / Application Exceptions
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  //Direct Zod Validation Exceptions
  if (error instanceof ZodError) {
    const formatted = formatZodErrors(error);
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: formatted,
      },
      { status: 422 }
    );
  }

  // 3. Database (Prisma) Specific Exceptions
  if (typeof error === "object" && error !== null && "code" in error) {
    const prismaError = error as { code: string; meta?: Record<string, any> };

    // Unique Constraint Violation (Duplicate entry)
    if (prismaError.code === "P2002") {
      const target = (prismaError.meta?.target as string[]) || [];
      const field = target.length > 0 ? target.join(", ") : "field";
      return NextResponse.json(
        {
          success: false,
          error: `A record with this ${field} already exists.`,
          details: { [field]: [`This ${field} is already in use`] },
        },
        { status: 409 }
      );
    }

    // Foreign Key Constraint Failure
    if (prismaError.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "Foreign key reference constraint failed.",
        },
        { status: 400 }
      );
    }

    // Record Not Found
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: "The requested record was not found.",
        },
        { status: 404 }
      );
    }
  }

  // 4. Unexpected / Unhandled System Exceptions
  console.error("Unhandled API Exception:", error);

  return NextResponse.json(
    {
      success: false,
      error: "Internal server error. Please try again later.",
    },
    { status: 500 }
  );
}

/**
 * Higher-order Route Handler wrapper that catches all thrown exceptions
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiException(error);
    }
  }) as T;
}
