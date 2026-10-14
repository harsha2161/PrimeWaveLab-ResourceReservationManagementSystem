import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthUser } from "@/lib/security/role-guard";
import { computeProgressStatus } from "@/lib/security/validations/reservation";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import {BadRequestError,ForbiddenError,NotFoundError,} from "@/lib/security/errors";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export const GET = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    const authUser = await requireAuthUser(request);
    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Reservation ID parameter is required");
    }

    //Fetch reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id },
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
    });

    if (!reservation) {
      throw new NotFoundError(`Reservation with ID '${id}' was not found`);
    }

    // 2. Ownership check: Regular users can only see their own reservations
    if (authUser.role !== "ADMIN" && reservation.userId !== authUser.userId) {
      throw new ForbiddenError(
        "You do not have permission to view this reservation"
      );
    }

    // 3. Fetch resource info
    const resource = await prisma.resource.findUnique({
      where: { id: reservation.resourceId },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        status: true,
      },
    });

    return successResponse(
      {
        reservation: {
          ...reservation,
          progressStatus: computeProgressStatus(reservation),
          resource,
        },
      },
      "Reservation retrieved successfully"
    );
  }
);


// DELETE 
export const DELETE = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    const authUser = await requireAuthUser(request);
    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Reservation ID parameter is required");
    }

    //Fetch reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new NotFoundError(`Reservation with ID '${id}' was not found`);
    }

    //Ownership check: Regular users can only cancel their own reservations
    if (authUser.role !== "ADMIN" && reservation.userId !== authUser.userId) {
      throw new ForbiddenError(
        "You do not have permission to cancel this reservation"
      );
    }

    //Check if already cancelled
    if (reservation.cancelledAt) {
      return successResponse(
        null,
        "Reservation has already been cancelled previously"
      );
    }

    //Cancel reservation (Frees up the slot for other bookings)
    await prisma.reservation.update({
      where: { id },
      data: {
        cancelledAt: new Date(),
      },
    });

    return successResponse(null, "Reservation cancelled successfully");
  }
);
