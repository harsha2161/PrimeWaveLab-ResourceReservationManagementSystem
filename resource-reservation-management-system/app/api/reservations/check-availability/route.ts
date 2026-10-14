import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthUser } from "@/lib/security/role-guard";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, NotFoundError } from "@/lib/security/errors";


export const GET = withErrorHandler(async (request: NextRequest) => {
  // Authenticate user
  await requireAuthUser(request);

  // 2. Query parameters
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get("resourceId")?.trim();
  const startTime = searchParams.get("startTime")?.trim();
  const endTime = searchParams.get("endTime")?.trim();

  if (!resourceId || !startTime || !endTime) {
    throw new BadRequestError(
      "Missing required parameters. resourceId, startTime, and endTime are required."
    );
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestError("Invalid date format. Use ISO datetime strings.");
  }

  if (end <= start) {
    throw new BadRequestError("endTime must be strictly after startTime.");
  }

  // 3. Verify resource exists
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  });

  if (!resource) {
    throw new NotFoundError(`Resource with ID '${resourceId}' was not found`);
  }

  if (resource.status === "INACTIVE") {
    return successResponse({
      available: false,
      reason: "Resource is inactive and cannot be reserved.",
      resource,
    });
  }

  // 4. Check reservation conflict
  const existingReservation = await prisma.reservation.findFirst({
    where: {
      resourceId,
      cancelledAt: null,
      StartTime: { lt: end },
      Endtime: { gt: start },
    },
    select: {
      StartTime: true,
      Endtime: true,
    },
  });

  if (existingReservation) {
    return successResponse({
      available: false,
      reason: "Resource is already reserved during this time period.",
      conflictingSlot: {
        start: existingReservation.StartTime,
        end: existingReservation.Endtime,
      },
      resource,
    });
  }

  // 5. Check maintenance conflict
  const existingMaintenance = await prisma.resourceMaintenance.findFirst({
    where: {
      resourceId,
      startTime: { lt: end },
      endTime: { gt: start },
    },
    select: {
      startTime: true,
      endTime: true,
      description: true,
    },
  });

  if (existingMaintenance) {
    return successResponse({
      available: false,
      reason: "Resource is under scheduled maintenance during this time period.",
      maintenance: existingMaintenance,
      resource,
    });
  }

  // 6. Available!
  return successResponse({
    available: true,
    resource,
    requestedSlot: {
      start,
      end,
    },
  });
});
