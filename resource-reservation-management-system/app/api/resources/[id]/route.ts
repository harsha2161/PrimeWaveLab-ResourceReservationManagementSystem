import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, requireAdmin } from "@/lib/security/role-guard";
import {
  updateResourceSchema,
  validateResourceData,
} from "@/lib/security/validations/resource";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/security/errors";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export const GET = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    //Role validation
    await requireRole(request, ["USER", "ADMIN"]);

    const { id } = await Promise.resolve(context.params);
    if (!id) {
      throw new BadRequestError("Resource ID parameter is required");
    }

    //Fetch resource by ID or Code
    const resource = await prisma.resource.findFirst({
      where: {
        OR: [{ id: id }, { code: id }],
      },
      include: {
        resourceCategory: true,
        maintenanceRecords: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
    });

    if (!resource) {
      throw new NotFoundError(`Resource with ID '${id}' was not found`);
    }

    return successResponse({ resource }, "Resource retrieved successfully");
  }
);

export const PUT = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    //Role validation
    await requireAdmin(request);
  
    const { id } = await Promise.resolve(context.params);
    if (!id) {
      throw new BadRequestError("Resource ID parameter is required");
    }

    //Check resource existence
    const existingResource = await prisma.resource.findFirst({
      where: {
        OR: [{ id: id }, { code: id }],
      },
    });

    if (!existingResource) {
      throw new NotFoundError(`Resource with ID '${id}' was not found`);
    }

    //Parse & validate request body
    const body = await request.json().catch(() => {
      throw new BadRequestError("Invalid JSON request body");
    });

    const validatedData = validateResourceData(updateResourceSchema, body);

    //Validate category if provided
    if (validatedData.categoryId) {
      const categoryExists = await prisma.resourceCategory.findUnique({
        where: { id: validatedData.categoryId },
      });
      if (!categoryExists) {
        throw new NotFoundError(
          `Category with ID '${validatedData.categoryId}' does not exist`
        );
      }
    }

    //Check duplicate code if code is changed
    if (validatedData.code && validatedData.code !== existingResource.code) {
      const duplicateCode = await prisma.resource.findUnique({
        where: { code: validatedData.code },
      });
      if (duplicateCode) {
        throw new ConflictError(
          `Resource with code '${validatedData.code}' already exists`
        );
      }
    }

    //Update resource in database
    const updatedResource = await prisma.resource.update({
      where: { id: existingResource.id },
      data: {
        ...(validatedData.name ? { name: validatedData.name } : {}),
        ...(validatedData.description
          ? { description: validatedData.description }
          : {}),
        ...(validatedData.code ? { code: validatedData.code } : {}),
        ...(validatedData.categoryId
          ? { categoryId: validatedData.categoryId }
          : {}),
        ...(validatedData.location !== undefined
          ? { location: validatedData.location }
          : {}),
        ...(validatedData.maxCapacity !== undefined
          ? { maxCapacity: validatedData.maxCapacity }
          : {}),
        ...(validatedData.status
          ? { status: validatedData.status as any }
          : {}),
      },
      include: {
        resourceCategory: true,
      },
    });

    return successResponse(
      { resource: updatedResource },
      "Resource updated successfully"
    );
  }
);

export const DELETE = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    //Role validation:
    await requireAdmin(request);

    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Resource ID parameter is required");
    }

    //Check resource existence
    const existingResource = await prisma.resource.findFirst({
      where: {
        OR: [{ id: id }, { code: id }],
      },
    });

    if (!existingResource) {
      throw new NotFoundError(`Resource with ID '${id}' was not found`);
    }

    //Delete resource
    await prisma.resource.delete({
      where: { id: existingResource.id },
    });

    return successResponse(null, "Resource deleted successfully");
  }
);
