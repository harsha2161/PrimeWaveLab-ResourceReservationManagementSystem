import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthUser } from "@/lib/security/role-guard";
import { computeProgressStatus } from "@/lib/security/validations/reservation";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/security/errors";

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

// PATCH: Admin approves/confirms or rejects a reservation
export const PATCH = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    const authUser = await requireAuthUser(request);
    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Reservation ID parameter is required");
    }

    // Only Admin can confirm or approve reservations
    if (authUser.role !== "ADMIN") {
      throw new ForbiddenError(
        "Only administrators can confirm or approve reservations"
      );
    }

    const body = await request.json().catch(() => {
      throw new BadRequestError("Invalid JSON request body");
    });

    const { status, action } = body;
    const requested =
      status?.toUpperCase() ||
      (action === "CONFIRM"
        ? "COMFORMED"
        : action === "REJECT"
        ? "CANCEL"
        : null);

    if (
      !requested ||
      !["COMFORMED", "PENDING", "CANCEL", "REJECT"].includes(requested)
    ) {
      throw new BadRequestError(
        "Invalid status or action. Allowed values: COMFORMED, PENDING, or CANCEL/REJECT"
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new NotFoundError(`Reservation with ID '${id}' was not found`);
    }

    if (reservation.cancelledAt && requested !== "CANCEL") {
      throw new BadRequestError(
        "Cannot update a reservation that has already been cancelled"
      );
    }

    if (requested === "CANCEL" || requested === "REJECT") {
      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
        },
      });
      return successResponse(
        updated,
        "Reservation rejected and cancelled successfully"
      );
    }

    if (requested === "COMFORMED") {
      // Check for overlapping confirmed reservations on the same resource
      const conflict = await prisma.reservation.findFirst({
        where: {
          id: { not: id },
          resourceId: reservation.resourceId,
          status: "COMFORMED",
          cancelledAt: null,
          StartTime: { lt: reservation.Endtime },
          Endtime: { gt: reservation.StartTime },
        },
      });

      if (conflict) {
        throw new ConflictError(
          "Cannot confirm this reservation: Another reservation is already confirmed for this resource during this time slot."
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          status: "COMFORMED",
        },
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

      return successResponse(
        {
          reservation: {
            ...updated,
            progressStatus: computeProgressStatus(updated),
          },
        },
        "Reservation confirmed successfully by administrator"
      );
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: "PENDING" },
    });

    return successResponse(updated, "Reservation reset to pending status");
  }
);

