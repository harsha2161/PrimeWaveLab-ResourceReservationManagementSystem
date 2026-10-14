import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "./auth-service";
import { UnauthorizedError, ForbiddenError } from "./errors";
import { AuthTokenPayload } from "./jwt";

export type AllowedRole = "USER" | "ADMIN";

 //Validates that the request has a valid, non-expired JWT token and active user status.
export async function requireAuthUser(request: NextRequest): Promise<AuthTokenPayload> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw new UnauthorizedError("Authentication required. Please provide a valid Bearer token or login cookie.");
  }

  if (user.status === "BLOCKED") {
    throw new ForbiddenError("Your account has been blocked. Please contact system administrator.");
  }

  if (user.status === "SUSPENDED") {
    throw new ForbiddenError("Your account is currently suspended. Please contact support.");
  }

  return user;
}

//Role-Based Access Control (RBAC) Guard
export async function requireRole(
  request: NextRequest,
  allowedRoles: AllowedRole[]
): Promise<AuthTokenPayload> {
  const user = await requireAuthUser(request);

  if (!allowedRoles.includes(user.role as AllowedRole)) {
    throw new ForbiddenError(
      `Access denied. Requires one of the following roles: [${allowedRoles.join(
        ", "
      )}]. Your current role is: ${user.role}`
    );
  }

  return user;
}

//Admin-Only Guard
export async function requireAdmin(request: NextRequest): Promise<AuthTokenPayload> {
  return await requireRole(request, ["ADMIN"]);
}
