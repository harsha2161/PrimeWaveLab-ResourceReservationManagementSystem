import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireAuthUser } from "@/lib/security/role-guard";
import {
  createReservationSchema,
  validateReservationData,
  computeProgressStatus,
} from "@/lib/security/validations/reservation";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/security/errors";

//GET Reservations
export const GET = withErrorHandler(async (request: NextRequest) => {
  // Authenticate user
  const authUser = await requireAuthUser(request);

  //Query filters
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get("resourceId")?.trim();
  const filterUserId = searchParams.get("userId")?.trim();
  const status = searchParams.get("status")?.trim();

  const where: any = {};

  //If regular USER, restrict to only their own reservations
  if (authUser.role !== "ADMIN") {
    where.userId = authUser.userId;
  } else if (filterUserId) {
    // Admin can optionally filter by specific user
    where.userId = filterUserId;
  }

  if (resourceId) {
    where.resourceId = resourceId;
  }

  if (status) {
    where.status = status;
  }

  //Fetch reservations
  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: {
      StartTime: "desc",
    },
  });

  //Fetch resource details for the returned reservations
  const resourceIds = [...new Set(reservations.map((r) => r.resourceId))];
  const resources = await prisma.resource.findMany({
    where: {
      id: { in: resourceIds },
    },
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      status: true,
    },
  });

  const resourceMap = new Map(resources.map((res) => [res.id, res]));

  // Attach dynamic progressStatus and resource details
  const enrichedReservations = reservations.map((res) => ({
    ...res,
    progressStatus: computeProgressStatus(res),
    resource: resourceMap.get(res.resourceId) || null,
  }));

  return successResponse(
    {
      count: enrichedReservations.length,
      reservations: enrichedReservations,
    },
    "Reservations retrieved successfully"
  );
});

//POST Reservations
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Authenticate user
  const authUser = await requireAuthUser(request);

  //Parse request body
  const body = await request.json().catch(() => {
    throw new BadRequestError("Invalid JSON request body");
  });

  //Validate input
  const validated = validateReservationData(createReservationSchema, body);

  //Validate time range
  const start = new Date(validated.startTime);
  const end = new Date(validated.endTime);
  const now = new Date();

  if (isNaN(start.getTime())) {
    throw new BadRequestError("Invalid startTime format. Provide a valid ISO datetime.");
  }

  if (isNaN(end.getTime())) {
    throw new BadRequestError("Invalid endTime format. Provide a valid ISO datetime.");
  }

  if (end <= start) {
    throw new BadRequestError("Reservation endTime must be strictly after startTime.");
  }

  // Allow 5 minutes grace for clock drift
  const gracePeriod = 5 * 60 * 1000;
  if (start.getTime() < now.getTime() - gracePeriod) {
    throw new BadRequestError("Cannot book a reservation in the past.");
  }

  // 5. Verify resource exists and is active
  const resource = await prisma.resource.findUnique({
    where: { id: validated.resourceId },
  });

  if (!resource) {
    throw new NotFoundError(
      `Resource with ID '${validated.resourceId}' does not exist`
    );
  }

  if (resource.status === "INACTIVE") {
    throw new BadRequestError("This resource is currently inactive and cannot be reserved.");
  }

  //Atomic Transaction: Check Overlaps & Book Reservation
  const newReservation = await prisma.$transaction(async (tx) => {
    //Check overlapping active reservations
    const overlapping = await tx.reservation.findFirst({
      where: {
        resourceId: validated.resourceId,
        cancelledAt: null,
        StartTime: { lt: end },
        Endtime: { gt: start },
      },
    });

    if (overlapping) {
      throw new ConflictError(
        "This resource is already booked during the selected time period. Please select another slot or resource."
      );
    }

    //Check overlapping scheduled maintenance
    const maintenanceConflict = await tx.resourceMaintenance.findFirst({
      where: {
        resourceId: validated.resourceId,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });

    if (maintenanceConflict) {
      throw new ConflictError(
        "This resource is scheduled for maintenance during the selected time period."
      );
    }

    //Create the reservation
    const reservationId = crypto.randomUUID();

    return await tx.reservation.create({
      data: {
        id: reservationId,
        userId: authUser.userId,
        resourceId: validated.resourceId,
        title: validated.title || null,
        StartTime: start,
        Endtime: end,
        status: "COMFORMED",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  });

  return successResponse(
    {
      reservation: {
        ...newReservation,
        progressStatus: computeProgressStatus(newReservation),
        resource: {
          id: resource.id,
          name: resource.name,
          code: resource.code,
          location: resource.location,
        },
      },
    },
    "Resource booked successfully",
    201
  );
});
