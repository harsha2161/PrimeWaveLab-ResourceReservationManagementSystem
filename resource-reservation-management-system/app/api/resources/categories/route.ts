import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireRole, requireAdmin } from "@/lib/security/role-guard";
import { categorySchema, validateResourceData } from "@/lib/security/validations/resource";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, ConflictError } from "@/lib/security/errors";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(request, ["USER", "ADMIN"]);

  const categories = await prisma.resourceCategory.findMany({
    include: {
      _count: {
        select: { resource: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return successResponse(
    { categories },
    "Resource categories retrieved successfully"
  );
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  await requireAdmin(request);

  const body = await request.json().catch(() => {
    throw new BadRequestError("Invalid JSON request body");
  });

  const validated = validateResourceData(categorySchema, body);
  const categoryId = validated.id || crypto.randomUUID();

  // Check duplicate ID
  const existingCategory = await prisma.resourceCategory.findUnique({
    where: { id: categoryId },
  });

  if (existingCategory) {
    throw new ConflictError(`Category with ID '${categoryId}' already exists`);
  }

  const newCategory = await prisma.resourceCategory.create({
    data: {
      id: categoryId,
      name: validated.name,
      description: validated.description || null,
    },
  });

  return successResponse(
    { category: newCategory },
    "Resource category created successfully",
    201
  );
});
