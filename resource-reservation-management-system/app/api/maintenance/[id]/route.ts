import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, requireAdmin } from "@/lib/security/role-guard";
import {
  updateMaintenanceSchema,
  validateMaintenanceData,
} from "@/lib/security/validations/maintenance";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, NotFoundError } from "@/lib/security/errors";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export const GET = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    //Role validation
    await requireRole(request, ["USER", "ADMIN"]);

    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Maintenance ID parameter is required");
    }

    // Fetch record
    const maintenance = await prisma.resourceMaintenance.findUnique({
      where: { id },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            code: true,
            location: true,
            status: true,
          },
        },
      },
    });

    if (!maintenance) {
      throw new NotFoundError(`Maintenance record with ID '${id}' was not found`);
    }

    return successResponse(
      { maintenance },
      "Maintenance record retrieved successfully"
    );
  }
);


export const PUT = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    //Role validation
    await requireAdmin(request);

    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Maintenance ID parameter is required");
    }

    //Check existence
    const existing = await prisma.resourceMaintenance.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Maintenance record with ID '${id}' was not found`);
    }

    //Parse and validate body
    const body = await request.json().catch(() => {
      throw new BadRequestError("Invalid JSON request body");
    });

    const validated = validateMaintenanceData(updateMaintenanceSchema, body);

    const updateData: any = {};

    if (validated.description !== undefined) {
      updateData.description = validated.description;
    }

    if (validated.startTime !== undefined) {
      const start = new Date(validated.startTime);
      if (isNaN(start.getTime())) {
        throw new BadRequestError("Invalid startTime date format");
      }
      updateData.startTime = start;
    }

    if (validated.endTime !== undefined) {
      const end = new Date(validated.endTime);
      if (isNaN(end.getTime())) {
        throw new BadRequestError("Invalid endTime date format");
      }
      updateData.endTime = end;
    }

    if (validated.maintenancestatus !== undefined) {
      updateData.maintenancestatus = validated.maintenancestatus;
    }

    //Update in database
    const updated = await prisma.resourceMaintenance.update({
      where: { id },
      data: updateData,
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    //If marked as COMPLETE
    if (validated.maintenancestatus === "COMPLETE") {
      await prisma.resource.update({
        where: { id: existing.resourceId },
        data: { status: "ACTIVE" },
      });
    } else if (validated.maintenancestatus === "INPROGRESS") {
      await prisma.resource.update({
        where: { id: existing.resourceId },
        data: { status: "WAITING" },
      });
    }

    return successResponse(
      { maintenance: updated },
      "Maintenance record updated successfully"
    );
  }
);

//Deletes a maintenance record
export const DELETE = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    //Role validation
    await requireAdmin(request);

    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Maintenance ID parameter is required");
    }

    //Check existence
    const existing = await prisma.resourceMaintenance.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Maintenance record with ID '${id}' was not found`);
    }

    //Delete record
    await prisma.resourceMaintenance.delete({
      where: { id },
    });

    //Restore resource to ACTIVE if it was WAITING
    await prisma.resource.update({
      where: { id: existing.resourceId },
      data: { status: "ACTIVE" },
    });

    return successResponse(null, "Maintenance record deleted successfully");
  }
);
