import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/security/role-guard";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, NotFoundError } from "@/lib/security/errors";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export const POST = withErrorHandler(
  async (request: NextRequest, context: RouteContext) => {
    // Role validation
    await requireAdmin(request);

    const { id } = await Promise.resolve(context.params);

    if (!id) {
      throw new BadRequestError("Maintenance ID parameter is required");
    }

    //Check record existence
    const existing = await prisma.resourceMaintenance.findUnique({
      where: { id },
      include: {
        resource: true,
      },
    });

    if (!existing) {
      throw new NotFoundError(`Maintenance record with ID '${id}' was not found`);
    }

    if (existing.maintenancestatus === "COMPLETE") {
      return successResponse(
        { maintenance: existing },
        "Maintenance is already marked as COMPLETE"
      );
    }

    //Mark maintenance as COMPLETE and set actual completion time
    const completedMaintenance = await prisma.resourceMaintenance.update({
      where: { id },
      data: {
        maintenancestatus: "COMPLETE",
        endTime: new Date(),
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

    //Restore the resource to ACTIVE status
    await prisma.resource.update({
      where: { id: existing.resourceId },
      data: { status: "ACTIVE" },
    });

    return successResponse(
      { maintenance: completedMaintenance },
      "Maintenance marked as finished successfully and resource restored to ACTIVE"
    );
  }
);

//Support PATCH as well
export const PATCH = POST;
