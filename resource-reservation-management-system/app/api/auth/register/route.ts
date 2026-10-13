import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { registerSchema, validateData } from "@/lib/security/validations/auth";
import { signAuthToken } from "@/lib/security/jwt";
import { withErrorHandler, successResponse } from "@/lib/response/api-response";
import { BadRequestError, ConflictError } from "@/lib/security/errors";
import { hashPassword, sanitizeUser } from "@/lib/security/auth-service";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json().catch(() => {
    throw new BadRequestError("Invalid JSON request body");
  });

  // 1. Validation
  const { firstName, lastName, email, phone, password } = validateData(
    registerSchema,
    body
  );

  // 2. Duplicate Check
  const existingUser = await prisma.users.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });

  if (existingUser) {
    if (existingUser.email.toLowerCase() === email.toLowerCase()) {
      throw new ConflictError("Email is already registered");
    }
    if (existingUser.phone === phone) {
      throw new ConflictError("Phone number is already registered");
    }
  }

  // 4. Create user in database
  const newUser = await prisma.users.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      password: await hashPassword(password), //hash password
      role: "USER",
      status: "ACTIVE",
    },  
  });

  // 5. Generate JWT token
  const token = await signAuthToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    status: newUser.status,
  });

  // 6. Return response with cookie
  const response = successResponse(
    {
      user: sanitizeUser(newUser),
      token,
    },
    "User registered successfully",
    201
  );

  return response;
});
