import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireRole, requireAdmin } from "@/lib/security/role-guard";
import {createResourceSchema,validateResourceData,} from "@/lib/security/validations/resource";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import {BadRequestError,ConflictError,NotFoundError,} from "@/lib/security/errors";


export const GET = withErrorHandler(async (request: NextRequest) => {
  //Role validation: USER and ADMIN can view resources
  await requireRole(request, ["USER", "ADMIN"]);

  //Extract query filters
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const categoryId = searchParams.get("categoryId")?.trim();
  const status = searchParams.get("status")?.trim();
  const location = searchParams.get("location")?.trim();

  //Build Prisma where clause
  const where: any = {};

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status) {
    where.status = status;
  }

  if (location) {
    where.location = {
      contains: location,
      mode: "insensitive",
    };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  //Fetch resources with related category
  const resources = await prisma.resource.findMany({
    where,
    include: {
      resourceCategory: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return successResponse(
    {
      count: resources.length,
      resources,
    },
    "Resources retrieved successfully"
  );
});

//create new resourse
export const POST = withErrorHandler(async (request: NextRequest) => {
 
  await requireAdmin(request);

  //Parse request body
  const body = await request.json().catch(() => {
    throw new BadRequestError("Invalid JSON request body");
  });

  //Input validation
  const validatedData = validateResourceData(createResourceSchema, body);

  // Validate category existence
  const category = await prisma.resourceCategory.findUnique({
    where: { id: validatedData.categoryId },
  });

  if (!category) {
    throw new NotFoundError(
      `Resource category with ID '${validatedData.categoryId}' does not exist`
    );
  }

  //Check duplicate resource code
  const existingCode = await prisma.resource.findUnique({
    where: { code: validatedData.code },
  });

  if (existingCode) {
    throw new ConflictError(
      `Resource with code '${validatedData.code}' already exists`
    );
  }

  //Generate UUID for resource ID
  const resourceId = crypto.randomUUID();

  // Create resource in database
  const newResource = await prisma.resource.create({
    data: {
      id: resourceId,
      name: validatedData.name,
      description: validatedData.description,
      code: validatedData.code,
      categoryId: validatedData.categoryId,
      location: validatedData.location || null,
      maxCapacity: validatedData.maxCapacity || null,
      status: (validatedData.status as any) || "ACTIVE",
    },
    include: {
      resourceCategory: true,
    },
  });

  return successResponse(
    { resource: newResource },
    "Resource created successfully",
    201
  );
});
