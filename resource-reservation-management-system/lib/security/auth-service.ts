import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "./errors";
import { AuthTokenPayload, verifyAuthToken } from "./jwt";

const SALT_ROUNDS = 12;

 //Hash a plain text password securely using bcrypt
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}
//Compare plain text password against hashed password
export async function comparePassword(
  plainText: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainText, hashedPassword);
}


 //remove sensitive fields like password
export function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, "password"> {
  const { password: _, ...safeUser } = user;
  return safeUser;
}

 //Extract auth token from incoming request (Cookie or Authorization Bearer header)
export function getAuthTokenFromRequest(request: NextRequest): string | null {
  //Check HttpOnly cookie first
  const cookieToken = request.cookies.get("auth_token")?.value;
  if (cookieToken) {
    return cookieToken;
  }

  //Check Authorization Header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

//Authenticate request and return token payload if valid, or null
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthTokenPayload | null> {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return null;
  }
  return await verifyAuthToken(token);
}

//Enforce authentication. Throws UnauthorizedError exception if not authenticated.
export async function requireAuth(request: NextRequest): Promise<AuthTokenPayload> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new UnauthorizedError("Unauthorized. Please log in to access this resource.");
  }
  return user;
}

export { requireRole, requireAdmin, requireAuthUser } from "./role-guard";
