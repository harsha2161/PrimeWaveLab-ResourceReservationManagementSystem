import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/security/role-guard";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/security/errors";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const DELETE = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    const admin = await requireAdmin(request);
    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("User ID is required");
    }

    if (id === admin.userId) {
      throw new ForbiddenError("You cannot delete your own administrator account.");
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Reservations reference users with RESTRICT, so remove their bookings in
    // the same transaction before removing the account.
    await prisma.$transaction(async (tx) => {
      await tx.reservation.deleteMany({ where: { userId: id } });
      await tx.users.delete({ where: { id } });
    });

    return successResponse(null, "User and their reservations deleted successfully");
  },
);
