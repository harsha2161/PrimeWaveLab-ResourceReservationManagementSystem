import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { NotFoundError, ForbiddenError } from "@/lib/security/errors";
import { requireAuth } from "@/lib/security/auth-service";

export const GET = withErrorHandler(async (request: NextRequest) => {
  // Authenticate
  const authPayload = await requireAuth(request);

  //Fetch fresh record from DB
  const user = await prisma.users.findUnique({
    where: {
      id: authPayload.userId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updateAlt: true,
    },
  });

  //Check user presence - throws NotFoundError exception
  if (!user) {
    throw new NotFoundError("User account not found or has been removed.");
  }

  //Verify account status
  if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
    throw new ForbiddenError("Account is currently disabled or blocked.");
  }

  return successResponse(user, "User profile retrieved successfully");
});
