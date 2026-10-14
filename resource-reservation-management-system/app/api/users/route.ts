import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/security/role-guard";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireAdmin(request);

  const users = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { resavation: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return successResponse({ users }, "Users retrieved successfully");
});
