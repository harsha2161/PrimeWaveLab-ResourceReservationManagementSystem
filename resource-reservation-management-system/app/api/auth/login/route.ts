import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loginSchema, validateData } from "@/lib/security/validations/auth";
import { signAuthToken } from "@/lib/security/jwt";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, UnauthorizedError, ForbiddenError } from "@/lib/security/errors";
import { comparePassword, sanitizeUser } from "@/lib/security/auth-service";

export const POST = withErrorHandler(async (request: NextRequest) => {

  const body = await request.json().catch(() => {
    throw new BadRequestError("Invalid request body. Expected JSON payload.");
  });

  // 1. Validate request body - throws ValidationError exception (422) if invalid
  const { email, password } = validateData(loginSchema, body);

  // 2. Find user by email
  const user = await prisma.users.findUnique({
    where: {
      email: email,
    },
  });

  // 3. User existence check
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // 4. Verify account status
  if (user.status === "BLOCKED") {
    throw new ForbiddenError(
      "Your account has been blocked. Please contact system administrator."
    );
  }

  if (user.status === "SUSPENDED") {
    throw new ForbiddenError(
      "Your account is currently suspended. Please contact support."
    );
  }

  // 5. Compare password securely
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // 6. Sign JWT token
  const token = await signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  const safeUser = sanitizeUser(user); // remove password before making twt token

  // 7. Set HTTP-Only Cookie and return response
  const response = successResponse(
    {
      user: safeUser,
      token,
    },
    "Login successful"
  );

  response.cookies.set({
    name: "auth_token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return response;
});
