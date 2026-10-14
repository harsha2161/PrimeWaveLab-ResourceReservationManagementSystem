import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireRole, requireAdmin } from "@/lib/security/role-guard";
import {
  createMaintenanceSchema,
  validateMaintenanceData,
} from "@/lib/security/validations/maintenance";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, NotFoundError } from "@/lib/security/errors";

export const GET = withErrorHandler(async (request: NextRequest) => {
  // Role validation
  await requireRole(request, ["USER", "ADMIN"]);

  //Query filters
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get("resourceId")?.trim();
  const status = searchParams.get("status")?.trim();

  const where: any = {};

  if (resourceId) {
    where.resourceId = resourceId;
  }

  if (status && (status === "INPROGRESS" || status === "COMPLETE")) {
    where.maintenancestatus = status;
  }

  //Fetch maintenance records
  const maintenances = await prisma.resourceMaintenance.findMany({
    where,
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
    orderBy: {
      createdAt: "desc",
    },
  });

  return successResponse(
    {
      count: maintenances.length,
      maintenances,
    },
    "Maintenance records retrieved successfully"
  );
});

//create maintenance
export const POST = withErrorHandler(async (request: NextRequest) => {
  //Role validation
  await requireAdmin(request);

  // Parse request body
  const body = await request.json().catch(() => {
    throw new BadRequestError("Invalid JSON request body");
  });

  //Input validation
  const validated = validateMaintenanceData(createMaintenanceSchema, body);

  //Verify resource exists
  const resource = await prisma.resource.findUnique({
    where: { id: validated.resourceId },
  });

  if (!resource) {
    throw new NotFoundError(
      `Resource with ID '${validated.resourceId}' does not exist`
    );
  }

  //Validate dates
  const start = validated.startTime ? new Date(validated.startTime) : new Date();
  const end = new Date(validated.endTime);

  if (isNaN(start.getTime())) {
    throw new BadRequestError("Invalid startTime format. Please provide a valid ISO date string.");
  }

  if (isNaN(end.getTime())) {
    throw new BadRequestError("Invalid endTime format. Please provide a valid ISO date string.");
  }

  if (end <= start) {
    throw new BadRequestError("Maintenance endTime must be after startTime.");
  }

  const maintenanceId = crypto.randomUUID();
  const status = validated.maintenancestatus || "INPROGRESS";

  // Create maintenance record
  const maintenance = await prisma.resourceMaintenance.create({
    data: {
      id: maintenanceId,
      resourceId: validated.resourceId,
      description: validated.description,
      startTime: start,
      endTime: end,
      maintenancestatus: status,
    },
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

  //If maintenance is INPROGRESS, mark the resource status as WAITING
  if (status === "INPROGRESS") {
    await prisma.resource.update({
      where: { id: validated.resourceId },
      data: { status: "WAITING" },
    });
  }

  return successResponse(
    { maintenance },
    "Maintenance record created successfully",
    201
  );
});
